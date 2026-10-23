create or replace function public.issue_certificate(
  p_version uuid,
  p_student uuid,
  p_locale text,
  p_achievement text,
  p_idempotency_key text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  version_row public.certificate_template_versions%rowtype;
  template_row public.certificate_templates%rowtype;
  student_name text;
  result uuid;
  serial text;
  code text;
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'admin_mfa_required';
  end if;
  if p_locale not in ('ar', 'en')
    or char_length(btrim(p_achievement)) not between 2 and 500
    or char_length(p_idempotency_key) not between 8 and 180 then
    raise exception using errcode = '22023', message = 'certificate_issue_invalid';
  end if;

  select id into result
  from public.certificates
  where idempotency_key = p_idempotency_key;
  if result is not null then
    return result;
  end if;

  select * into version_row
  from public.certificate_template_versions
  where id = p_version and status = 'published';
  if version_row.id is null then
    raise exception using errcode = 'P0001', message = 'certificate_template_not_published';
  end if;

  select * into template_row
  from public.certificate_templates
  where id = version_row.template_id and is_active;
  select full_name into student_name
  from public.students
  where id = p_student and status = 'active';
  if template_row.id is null or student_name is null then
    raise exception using errcode = 'P0001', message = 'certificate_subject_unavailable';
  end if;

  serial := 'NAW-' || extract(year from current_date)::integer || '-'
    || lpad(nextval('public.certificate_serial_seq')::text, 8, '0');
  code := encode(extensions.gen_random_bytes(24), 'hex');

  insert into public.certificates(
    template_version_id, student_id, kind, serial_no, verify_code, locale,
    payload_snapshot, template_snapshot, idempotency_key, issued_by
  ) values (
    version_row.id, p_student, template_row.kind, serial, code, p_locale,
    jsonb_build_object(
      'student_name', student_name,
      'achievement', btrim(p_achievement),
      'issued_on', current_date,
      'serial_no', serial
    ),
    to_jsonb(version_row) - array['created_by', 'published_by'],
    p_idempotency_key,
    (select auth.uid())
  ) returning id into result;

  perform private.notify_session_parties(
    p_student,
    'certificate_issued',
    jsonb_build_object('certificate_id', result, 'kind', template_row.kind)
  );
  return result;
end;
$$;

create or replace function public.verify_certificate(p_code text)
returns table(
  valid boolean,
  status text,
  student_name text,
  certificate_kind text,
  issued_on date,
  serial_no text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  headers jsonb;
  requester text;
  requester_digest text;
  bucket timestamptz;
  current_attempts integer;
  row record;
begin
  if p_code is null or char_length(p_code) not between 32 and 128
    or p_code !~ '^[a-zA-Z0-9_-]+$' then
    return query select false, 'not_found'::text, null::text, null::text, null::date, null::text;
    return;
  end if;

  begin
    headers := coalesce(current_setting('request.headers', true), '{}')::jsonb;
  exception when others then
    headers := '{}'::jsonb;
  end;
  requester := coalesce(
    headers ->> 'cf-connecting-ip',
    headers ->> 'x-real-ip',
    split_part(coalesce(headers ->> 'x-forwarded-for', 'unknown'), ',', 1),
    'unknown'
  ) || ':' || coalesce(headers ->> 'user-agent', 'unknown');
  requester_digest := encode(extensions.digest(requester, 'sha256'), 'hex');
  bucket := date_bin(
    interval '10 minutes',
    clock_timestamp(),
    timestamptz '2020-01-01 00:00:00+00'
  );

  insert into private.certificate_verification_limits(requester_hash, window_start, attempts)
  values (requester_digest, bucket, 1)
  on conflict (requester_hash, window_start) do update
  set attempts = private.certificate_verification_limits.attempts + 1
  returning attempts into current_attempts;
  if current_attempts > 15 then
    raise exception using errcode = 'P0001', message = 'certificate_verification_rate_limited';
  end if;

  select certificate.serial_no, certificate.kind, certificate.issued_at,
    certificate.revoked_at, student.full_name
  into row
  from public.certificates as certificate
  join public.students as student on student.id = certificate.student_id
  where certificate.verify_code = p_code;

  if row.serial_no is null then
    return query select false, 'not_found'::text, null::text, null::text, null::date, null::text;
    return;
  end if;

  return query select
    row.revoked_at is null,
    case when row.revoked_at is null then 'valid' else 'revoked' end,
    split_part(row.full_name, ' ', 1)
      || case
        when position(' ' in row.full_name) > 0
          then ' ' || left(regexp_replace(row.full_name, '^.*\s', '', 'g'), 1) || '.'
        else ''
      end,
    row.kind::text,
    row.issued_at::date,
    row.serial_no::text;
end;
$$;

create or replace function public.dispatch_intervention_notifications(
  p_at timestamptz default pg_catalog.now()
)
returns integer
language plpgsql
security definer
set search_path = ''
set statement_timeout = '30s'
as $$
declare
  candidate record;
  recipient record;
  stored_prefs jsonb;
  created_notification_id uuid;
  in_app_enabled boolean;
  email_enabled boolean;
  recipients integer;
  dispatched integer := 0;
  run_id bigint;
begin
  if current_user not in ('postgres', 'service_role') then
    raise exception using errcode = '42501', message = 'intervention_dispatcher_forbidden';
  end if;
  if p_at is null then
    raise exception using errcode = '22023', message = 'intervention_dispatch_time_invalid';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext('public.dispatch_intervention_notifications')
  );
  insert into public.job_runs(job_name, details)
  values ('dispatch_intervention_notifications', jsonb_build_object('dispatched_at', p_at))
  returning id into run_id;

  for candidate in
    select intervention_case.*,
      intervention_rule.rule_type,
      case
        when intervention_case.escalated_at is not null
          then 'escalated:' || intervention_case.priority::text
        else 'opened'
      end as event_key
    from public.intervention_cases as intervention_case
    join public.intervention_rules as intervention_rule
      on intervention_rule.id = intervention_case.rule_id
    where intervention_case.status in ('open', 'acknowledged')
      and not exists (
        select 1
        from public.intervention_notification_events as event
        where event.case_id = intervention_case.id
          and event.event_key = case
            when intervention_case.escalated_at is not null
              then 'escalated:' || intervention_case.priority::text
            else 'opened'
          end
      )
    order by intervention_case.priority desc,
      intervention_case.first_detected_at,
      intervention_case.id
    for update of intervention_case skip locked
  loop
    recipients := 0;
    for recipient in
      select profile.id, profile.preferred_locale
      from public.profiles as profile
      where profile.role = 'admin' and profile.is_active
      order by profile.id
    loop
      select preference.prefs into stored_prefs
      from public.notification_prefs as preference
      where preference.user_id = recipient.id;

      in_app_enabled := private.notification_pref_enabled(stored_prefs, 'in_app', true)
        and private.notification_pref_enabled(stored_prefs, 'intervention', true);
      email_enabled := private.notification_pref_enabled(
        stored_prefs,
        'intervention_email',
        true
      );
      if not in_app_enabled and not email_enabled then
        continue;
      end if;

      insert into public.notifications(user_id, type, source_key, in_app_visible, payload)
      values (
        recipient.id,
        case
          when candidate.event_key = 'opened' then 'intervention_opened'
          else 'intervention_escalated'
        end,
        candidate.id::text || ':' || candidate.event_key,
        in_app_enabled,
        jsonb_build_object(
          'case_id', candidate.id,
          'rule_type', candidate.rule_type,
          'priority', candidate.priority,
          'reason_code', candidate.reason_code,
          'action_href', '/' || recipient.preferred_locale
            || '/admin/control-center?caseStatus=' || candidate.status
        )
      )
      on conflict (user_id, type, source_key) where source_key is not null
      do update set payload = excluded.payload
      returning id into created_notification_id;

      if email_enabled then
        insert into public.notification_outbox(notification_id, channel)
        values (created_notification_id, 'email')
        on conflict (notification_id, channel) do nothing;
      end if;
      recipients := recipients + 1;
    end loop;

    if recipients > 0 then
      insert into public.intervention_notification_events(
        case_id,
        event_key,
        priority,
        recipient_count
      ) values (candidate.id, candidate.event_key, candidate.priority, recipients)
      on conflict (case_id, event_key) do nothing;
      dispatched := dispatched + 1;
    end if;
  end loop;

  update public.job_runs
  set finished_at = pg_catalog.clock_timestamp(),
    result = 'succeeded',
    affected_rows = dispatched,
    details = details || jsonb_build_object('dispatched_cases', dispatched)
  where id = run_id;
  return dispatched;
end;
$$;
