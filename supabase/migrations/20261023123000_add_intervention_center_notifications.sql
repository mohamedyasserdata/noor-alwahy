alter table public.notifications
  add column source_key text,
  add column in_app_visible boolean not null default true;

alter table public.notifications
  add constraint notifications_source_key_valid check (
    source_key is null or char_length(source_key) between 3 and 200
  );

create unique index notifications_source_once_idx
on public.notifications (user_id, type, source_key)
where source_key is not null;

create unique index notification_outbox_channel_once_idx
on public.notification_outbox (notification_id, channel);

drop policy notifications_read_own on public.notifications;
create policy notifications_read_own on public.notifications
for select to authenticated
using (user_id = (select auth.uid()) and in_app_visible);

create table public.intervention_notification_events (
  id bigint generated always as identity primary key,
  case_id uuid not null references public.intervention_cases(id) on delete cascade,
  event_key text not null check (event_key ~ '^(opened|escalated:[1-5])$'),
  priority smallint not null check (priority between 1 and 5),
  recipient_count integer not null check (recipient_count > 0),
  created_at timestamptz not null default now(),
  unique (case_id, event_key)
);

create index intervention_notification_events_case_idx
on public.intervention_notification_events (case_id, created_at desc);

alter table public.intervention_notification_events enable row level security;
revoke all on public.intervention_notification_events from public, anon, authenticated;
grant select on public.intervention_notification_events to authenticated;
grant select, insert, update, delete on public.intervention_notification_events to service_role;

create policy intervention_notification_events_admin_read
on public.intervention_notification_events for select to authenticated
using ((select public.is_admin()));

create or replace function public.get_intervention_center(
  p_status text default null,
  p_priority smallint default null,
  p_rule_type text default null,
  p_page integer default 1,
  p_page_size integer default 20
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set statement_timeout = '5s'
as $$
declare
  result jsonb;
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'admin_mfa_required';
  end if;
  if (p_status is not null and p_status not in ('open', 'acknowledged', 'resolved', 'dismissed'))
    or (p_priority is not null and p_priority not between 1 and 5)
    or (p_rule_type is not null and private.intervention_action_for_type(p_rule_type) is null)
    or p_page not between 1 and 100000
    or p_page_size not between 1 and 50 then
    raise exception using errcode = '22023', message = 'intervention_center_filters_invalid';
  end if;

  with filtered as (
    select intervention_case.*, intervention_rule.rule_type
    from public.intervention_cases as intervention_case
    join public.intervention_rules as intervention_rule on intervention_rule.id = intervention_case.rule_id
    where (p_status is null or intervention_case.status = p_status)
      and (p_priority is null or intervention_case.priority = p_priority)
      and (p_rule_type is null or intervention_rule.rule_type = p_rule_type)
  ), page_rows as (
    select filtered.*,
      case filtered.subject_type
        when 'student' then (select student.full_name from public.students as student where student.id = filtered.subject_id)
        when 'teacher' then (
          select profile.full_name from public.teachers as teacher
          join public.profiles as profile on profile.id = teacher.profile_id
          where teacher.id = filtered.subject_id
        )
        when 'subscription' then (
          select student.full_name from public.subscriptions as subscription
          join public.students as student on student.id = subscription.student_id
          where subscription.id = filtered.subject_id
        )
        when 'invoice' then (
          select student.full_name from public.invoices as invoice
          join public.students as student on student.id = invoice.student_id
          where invoice.id = filtered.subject_id
        )
        when 'report' then (
          select student.full_name from public.reports as report
          join public.students as student on student.id = report.student_id
          where report.id = filtered.subject_id
        )
      end as subject_name,
      case filtered.recommended_action
        when 'review_student_progress' then '/admin/students'
        when 'contact_guardian' then '/admin/students'
        when 'review_teacher_attendance' then '/admin/attendance'
        when 'contact_payer' then '/admin/subscriptions'
        when 'review_invoice' then '/admin/finance'
        when 'review_report' then '/admin/reports'
        when 'replenish_credit' then '/admin/subscriptions'
      end as action_path
    from filtered
    order by filtered.priority desc, filtered.first_detected_at, filtered.id
    limit p_page_size offset ((p_page - 1) * p_page_size)
  )
  select jsonb_build_object(
    'rows', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', row.id,
        'rule_type', row.rule_type,
        'subject_type', row.subject_type,
        'subject_id', row.subject_id,
        'subject_name', coalesce(row.subject_name, row.subject_id::text),
        'status', row.status,
        'priority', row.priority,
        'reason_code', row.reason_code,
        'evidence', row.evidence,
        'recommended_action', row.recommended_action,
        'action_path', row.action_path,
        'first_detected_at', row.first_detected_at,
        'last_detected_at', row.last_detected_at,
        'detection_count', row.detection_count,
        'escalated_at', row.escalated_at,
        'disposition_reason', row.disposition_reason
      ) order by row.priority desc, row.first_detected_at, row.id)
      from page_rows as row
    ), '[]'::jsonb),
    'total', (select count(*) from filtered),
    'page', p_page,
    'page_size', p_page_size,
    'counts', jsonb_build_object(
      'open', (select count(*) from filtered where status = 'open'),
      'acknowledged', (select count(*) from filtered where status = 'acknowledged'),
      'resolved', (select count(*) from filtered where status = 'resolved'),
      'dismissed', (select count(*) from filtered where status = 'dismissed')
    ),
    'generated_at', pg_catalog.clock_timestamp()
  ) into result;

  return result;
end;
$$;

revoke all on function public.get_intervention_center(text, smallint, text, integer, integer)
from public, anon, authenticated, service_role;
grant execute on function public.get_intervention_center(text, smallint, text, integer, integer)
to authenticated;

create or replace function private.notification_pref_enabled(
  p_prefs jsonb,
  p_key text,
  p_default boolean
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case
    when jsonb_typeof(p_prefs -> p_key) = 'boolean' then (p_prefs ->> p_key)::boolean
    else p_default
  end
$$;

revoke all on function private.notification_pref_enabled(jsonb, text, boolean)
from public, anon, authenticated, service_role;

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
  notification_id uuid;
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
      returning id into notification_id;

      if email_enabled then
        insert into public.notification_outbox (notification_id, channel)
        values (notification_id, 'email')
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

revoke all on function public.dispatch_intervention_notifications(timestamptz)
from public, anon, authenticated, service_role;
grant execute on function public.dispatch_intervention_notifications(timestamptz)
to service_role;

create or replace function public.claim_notification_outbox(p_limit integer default 25)
returns jsonb
language plpgsql
security definer
set search_path = ''
set statement_timeout = '5s'
as $$
declare
  claimed jsonb;
begin
  if current_user not in ('postgres', 'service_role') then
    raise exception using errcode = '42501', message = 'notification_worker_forbidden';
  end if;
  if p_limit not between 1 and 100 then
    raise exception using errcode = '22023', message = 'notification_claim_limit_invalid';
  end if;

  update public.notification_outbox
  set status = 'failed', next_attempt_at = pg_catalog.now(), last_error = 'processing_timeout'
  where status = 'processing' and updated_at < pg_catalog.now() - interval '15 minutes';

  with candidates as (
    select outbox.id
    from public.notification_outbox as outbox
    where outbox.status in ('pending', 'failed')
      and outbox.next_attempt_at <= pg_catalog.now()
      and outbox.attempts < 5
    order by outbox.next_attempt_at, outbox.created_at, outbox.id
    limit p_limit
    for update skip locked
  ), updated as (
    update public.notification_outbox as outbox
    set status = 'processing', attempts = outbox.attempts + 1, last_error = null
    from candidates
    where outbox.id = candidates.id
    returning outbox.id, outbox.notification_id, outbox.attempts
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'outbox_id', updated.id,
    'notification_id', notification.id,
    'attempts', updated.attempts,
    'recipient', private_profile.contact_email,
    'locale', profile.preferred_locale,
    'type', notification.type,
    'payload', notification.payload
  ) order by updated.id), '[]'::jsonb)
  into claimed
  from updated
  join public.notifications as notification on notification.id = updated.notification_id
  join public.profiles as profile on profile.id = notification.user_id
  left join public.profile_private as private_profile on private_profile.profile_id = profile.id;

  return claimed;
end;
$$;

revoke all on function public.claim_notification_outbox(integer)
from public, anon, authenticated, service_role;
grant execute on function public.claim_notification_outbox(integer) to service_role;

select cron.schedule(
  'dispatch-intervention-notifications',
  '*/10 * * * *',
  $$select public.dispatch_intervention_notifications()$$
)
where not exists (
  select 1 from cron.job where jobname = 'dispatch-intervention-notifications'
);

comment on function public.get_intervention_center(text, smallint, text, integer, integer) is
'P10-T04 stable intervention queue for MFA administrators with server-side filters and pagination.';
comment on function public.dispatch_intervention_notifications(timestamptz) is
'P10-T04 idempotent in-app/email outbox dispatcher for newly opened or escalated intervention cases.';
comment on function public.claim_notification_outbox(integer) is
'P10-T04 atomic bounded outbox claim with stale-worker recovery and maximum five attempts.';
