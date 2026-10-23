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
  queued_notification_id uuid;
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

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('public.dispatch_intervention_notifications'));
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
    join public.intervention_rules as intervention_rule on intervention_rule.id = intervention_case.rule_id
    where intervention_case.status in ('open', 'acknowledged')
      and not exists (
        select 1 from public.intervention_notification_events as event
        where event.case_id = intervention_case.id
          and event.event_key = case
            when intervention_case.escalated_at is not null
              then 'escalated:' || intervention_case.priority::text
            else 'opened'
          end
      )
    order by intervention_case.priority desc, intervention_case.first_detected_at, intervention_case.id
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
      email_enabled := private.notification_pref_enabled(stored_prefs, 'intervention_email', true);

      if not in_app_enabled and not email_enabled then
        continue;
      end if;

      insert into public.notifications (user_id, type, source_key, in_app_visible, payload)
      values (
        recipient.id,
        case when candidate.event_key = 'opened' then 'intervention_opened' else 'intervention_escalated' end,
        candidate.id::text || ':' || candidate.event_key,
        in_app_enabled,
        jsonb_build_object(
          'case_id', candidate.id,
          'rule_type', candidate.rule_type,
          'priority', candidate.priority,
          'reason_code', candidate.reason_code,
          'action_href', '/' || recipient.preferred_locale || '/admin/control-center?caseStatus=' || candidate.status
        )
      )
      on conflict (user_id, type, source_key) where source_key is not null
      do update set payload = excluded.payload
      returning id into queued_notification_id;

      if email_enabled then
        insert into public.notification_outbox (notification_id, channel)
        values (queued_notification_id, 'email')
        on conflict (notification_id, channel) do nothing;
      end if;
      recipients := recipients + 1;
    end loop;

    if recipients > 0 then
      insert into public.intervention_notification_events (case_id, event_key, priority, recipient_count)
      values (candidate.id, candidate.event_key, candidate.priority, recipients)
      on conflict (case_id, event_key) do nothing;
      dispatched := dispatched + 1;
    end if;
  end loop;

  update public.job_runs
  set finished_at = pg_catalog.clock_timestamp(), result = 'succeeded',
    affected_rows = dispatched,
    details = details || jsonb_build_object('dispatched_cases', dispatched)
  where id = run_id;
  return dispatched;
end;
$$;
