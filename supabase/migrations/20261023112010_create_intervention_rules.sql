create table public.intervention_rules (
  id uuid primary key default gen_random_uuid(),
  rule_type text not null unique,
  is_enabled boolean not null default true,
  priority smallint not null check (priority between 1 and 5),
  thresholds jsonb not null check (jsonb_typeof(thresholds) = 'object'),
  window_interval interval not null,
  cooldown_interval interval not null,
  action_code text not null,
  updated_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (window_interval between interval '1 hour' and interval '365 days'),
  check (cooldown_interval between interval '0 seconds' and interval '365 days')
);

create table public.intervention_cases (
  id uuid primary key default gen_random_uuid(),
  rule_id uuid not null references public.intervention_rules(id) on delete restrict,
  subject_type text not null check (
    subject_type in ('student', 'teacher', 'subscription', 'invoice', 'report')
  ),
  subject_id uuid not null,
  dedupe_key text not null check (char_length(dedupe_key) between 3 and 180),
  status text not null default 'open' check (
    status in ('open', 'acknowledged', 'resolved', 'dismissed')
  ),
  priority smallint not null check (priority between 1 and 5),
  reason_code text not null check (reason_code ~ '^[a-z][a-z0-9_]{2,79}$'),
  evidence jsonb not null check (jsonb_typeof(evidence) = 'object'),
  recommended_action text not null check (recommended_action ~ '^[a-z][a-z0-9_]{2,79}$'),
  first_detected_at timestamptz not null,
  last_detected_at timestamptz not null,
  detection_count integer not null default 1 check (detection_count > 0),
  escalated_at timestamptz,
  acknowledged_by uuid references public.profiles(id) on delete restrict,
  acknowledged_at timestamptz,
  resolved_by uuid references public.profiles(id) on delete restrict,
  resolved_at timestamptz,
  dismissed_by uuid references public.profiles(id) on delete restrict,
  dismissed_at timestamptz,
  disposition_reason text check (
    disposition_reason is null
    or char_length(btrim(disposition_reason)) between 2 and 500
  ),
  reopened_from_case_id uuid references public.intervention_cases(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (last_detected_at >= first_detected_at),
  check (escalated_at is null or escalated_at >= first_detected_at),
  check (
    (status = 'open'
      and acknowledged_by is null and acknowledged_at is null
      and resolved_by is null and resolved_at is null
      and dismissed_by is null and dismissed_at is null
      and disposition_reason is null)
    or (status = 'acknowledged'
      and acknowledged_by is not null and acknowledged_at is not null
      and resolved_by is null and resolved_at is null
      and dismissed_by is null and dismissed_at is null
      and disposition_reason is null)
    or (status = 'resolved'
      and resolved_at is not null
      and dismissed_by is null and dismissed_at is null)
    or (status = 'dismissed'
      and dismissed_by is not null and dismissed_at is not null
      and disposition_reason is not null)
  )
);

create index intervention_rules_enabled_idx
on public.intervention_rules (priority desc, rule_type)
where is_enabled;
create unique index intervention_cases_one_active_idx
on public.intervention_cases (dedupe_key)
where status in ('open', 'acknowledged');
create index intervention_cases_active_queue_idx
on public.intervention_cases (priority desc, first_detected_at, id)
where status in ('open', 'acknowledged');
create index intervention_cases_rule_history_idx
on public.intervention_cases (rule_id, last_detected_at desc, id);
create index intervention_cases_reopened_from_idx
on public.intervention_cases (reopened_from_case_id)
where reopened_from_case_id is not null;

create or replace function private.intervention_integer_between(
  p_value jsonb,
  p_key text,
  p_min integer,
  p_max integer
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case
    when jsonb_typeof(p_value -> p_key) <> 'number' then false
    when (p_value ->> p_key) !~ '^[0-9]+$' then false
    else (p_value ->> p_key)::integer between p_min and p_max
  end
$$;

create or replace function private.intervention_action_for_type(p_rule_type text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_rule_type
    when 'student_struggle' then 'review_student_progress'
    when 'student_absence' then 'contact_guardian'
    when 'teacher_late' then 'review_teacher_attendance'
    when 'renewal_due' then 'contact_payer'
    when 'payment_overdue' then 'review_invoice'
    when 'report_pending' then 'review_report'
    when 'credit_exhausted' then 'replenish_credit'
  end
$$;

create or replace function private.validate_intervention_rule()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  thresholds_valid boolean := false;
  expected_action text;
begin
  expected_action := private.intervention_action_for_type(new.rule_type);
  if expected_action is null then
    raise exception using errcode = '23514', message = 'intervention_rule_type_invalid';
  end if;

  if jsonb_typeof(new.thresholds) <> 'object' then
    raise exception using errcode = '23514', message = 'intervention_rule_thresholds_invalid';
  end if;

  thresholds_valid := case new.rule_type
    when 'student_struggle' then
      private.intervention_integer_between(new.thresholds, 'max_average', 0, 100)
      and private.intervention_integer_between(new.thresholds, 'min_evaluations', 1, 50)
      and new.thresholds - array['max_average', 'min_evaluations'] = '{}'::jsonb
    when 'student_absence' then
      private.intervention_integer_between(new.thresholds, 'min_absences', 1, 20)
      and new.thresholds - array['min_absences'] = '{}'::jsonb
    when 'teacher_late' then
      private.intervention_integer_between(new.thresholds, 'min_late_minutes', 1, 120)
      and private.intervention_integer_between(new.thresholds, 'min_occurrences', 1, 20)
      and new.thresholds - array['min_late_minutes', 'min_occurrences'] = '{}'::jsonb
    when 'renewal_due' then
      private.intervention_integer_between(new.thresholds, 'days_before', 1, 90)
      and new.thresholds - array['days_before'] = '{}'::jsonb
    when 'payment_overdue' then
      private.intervention_integer_between(new.thresholds, 'days_overdue', 1, 180)
      and new.thresholds - array['days_overdue'] = '{}'::jsonb
    when 'report_pending' then
      private.intervention_integer_between(new.thresholds, 'days_pending', 1, 90)
      and new.thresholds - array['days_pending'] = '{}'::jsonb
    when 'credit_exhausted' then
      private.intervention_integer_between(new.thresholds, 'max_remaining', 0, 10)
      and new.thresholds - array['max_remaining'] = '{}'::jsonb
    else false
  end;

  if not coalesce(thresholds_valid, false) then
    raise exception using errcode = '23514', message = 'intervention_rule_thresholds_invalid';
  end if;
  if new.window_interval not between interval '1 hour' and interval '365 days' then
    raise exception using errcode = '23514', message = 'intervention_rule_window_invalid';
  end if;
  if new.cooldown_interval not between interval '0 seconds' and interval '365 days' then
    raise exception using errcode = '23514', message = 'intervention_rule_cooldown_invalid';
  end if;

  new.action_code := expected_action;
  return new;
end;
$$;

revoke all on function private.intervention_integer_between(jsonb, text, integer, integer)
from public, anon, authenticated, service_role;
revoke all on function private.intervention_action_for_type(text)
from public, anon, authenticated, service_role;
revoke all on function private.validate_intervention_rule()
from public, anon, authenticated, service_role;

create trigger intervention_rules_validate
before insert or update on public.intervention_rules
for each row execute function private.validate_intervention_rule();
create trigger intervention_rules_set_updated_at
before update on public.intervention_rules
for each row execute function public.set_updated_at();
create trigger intervention_cases_set_updated_at
before update on public.intervention_cases
for each row execute function public.set_updated_at();
create trigger intervention_rules_audit
after insert or update or delete on public.intervention_rules
for each row execute function public.audit_row();
create trigger intervention_cases_audit
after insert or update or delete on public.intervention_cases
for each row execute function public.audit_row();

alter table public.intervention_rules enable row level security;
alter table public.intervention_cases enable row level security;

revoke all on public.intervention_rules, public.intervention_cases
from public, anon, authenticated;
grant select on public.intervention_rules, public.intervention_cases to authenticated;
grant select, insert, update, delete on public.intervention_rules, public.intervention_cases
to service_role;

create policy intervention_rules_admin_read
on public.intervention_rules for select to authenticated
using ((select public.is_admin()));
create policy intervention_cases_admin_read
on public.intervention_cases for select to authenticated
using ((select public.is_admin()));

create or replace function public.save_intervention_rule(
  p_rule_type text,
  p_priority smallint,
  p_thresholds jsonb,
  p_window_interval interval,
  p_cooldown_interval interval,
  p_is_enabled boolean default true,
  p_rule_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
set statement_timeout = '5s'
as $$
declare
  saved_id uuid;
  actor uuid := (select auth.uid());
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'admin_mfa_required';
  end if;
  if p_rule_type is null or p_priority is null or p_thresholds is null
    or p_window_interval is null or p_cooldown_interval is null or p_is_enabled is null then
    raise exception using errcode = '22023', message = 'intervention_rule_input_invalid';
  end if;

  if p_rule_id is null then
    insert into public.intervention_rules (
      rule_type, is_enabled, priority, thresholds, window_interval,
      cooldown_interval, action_code, updated_by
    ) values (
      p_rule_type, p_is_enabled, p_priority, p_thresholds, p_window_interval,
      p_cooldown_interval, coalesce(private.intervention_action_for_type(p_rule_type), ''), actor
    )
    returning id into saved_id;
  else
    update public.intervention_rules
    set is_enabled = p_is_enabled,
      priority = p_priority,
      thresholds = p_thresholds,
      window_interval = p_window_interval,
      cooldown_interval = p_cooldown_interval,
      updated_by = actor
    where id = p_rule_id and rule_type = p_rule_type
    returning id into saved_id;
    if saved_id is null then
      raise exception using errcode = 'P0002', message = 'intervention_rule_not_found';
    end if;
  end if;

  return saved_id;
end;
$$;

revoke all on function public.save_intervention_rule(text, smallint, jsonb, interval, interval, boolean, uuid)
from public, anon, authenticated, service_role;
grant execute on function public.save_intervention_rule(text, smallint, jsonb, interval, interval, boolean, uuid)
to authenticated;

create or replace function public.transition_intervention_case(
  p_case uuid,
  p_status text,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = ''
set statement_timeout = '5s'
as $$
declare
  case_row public.intervention_cases%rowtype;
  actor uuid := (select auth.uid());
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'admin_mfa_required';
  end if;
  if p_status not in ('acknowledged', 'resolved', 'dismissed')
    or (p_reason is not null and char_length(btrim(p_reason)) not between 2 and 500)
    or (p_status = 'dismissed' and p_reason is null) then
    raise exception using errcode = '22023', message = 'intervention_case_input_invalid';
  end if;

  select * into case_row
  from public.intervention_cases
  where id = p_case
  for update;
  if case_row.id is null then
    raise exception using errcode = 'P0002', message = 'intervention_case_not_found';
  end if;
  if not (
    (case_row.status = 'open' and p_status in ('acknowledged', 'resolved', 'dismissed'))
    or (case_row.status = 'acknowledged' and p_status in ('resolved', 'dismissed'))
  ) then
    raise exception using errcode = 'P0001', message = 'intervention_case_transition_invalid';
  end if;

  if p_status = 'acknowledged' then
    update public.intervention_cases
    set status = 'acknowledged', acknowledged_by = actor,
      acknowledged_at = pg_catalog.clock_timestamp()
    where id = p_case;
  elsif p_status = 'resolved' then
    update public.intervention_cases
    set status = 'resolved', resolved_by = actor,
      resolved_at = pg_catalog.clock_timestamp(), disposition_reason = p_reason
    where id = p_case;
  else
    update public.intervention_cases
    set status = 'dismissed', dismissed_by = actor,
      dismissed_at = pg_catalog.clock_timestamp(), disposition_reason = btrim(p_reason)
    where id = p_case;
  end if;
end;
$$;

revoke all on function public.transition_intervention_case(uuid, text, text)
from public, anon, authenticated, service_role;
grant execute on function public.transition_intervention_case(uuid, text, text)
to authenticated;

create or replace function private.upsert_intervention_candidate(
  p_rule public.intervention_rules,
  p_subject_type text,
  p_subject_id uuid,
  p_dedupe_key text,
  p_reason_code text,
  p_evidence jsonb,
  p_detected_at timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  active_case public.intervention_cases%rowtype;
  previous_case public.intervention_cases%rowtype;
  effective_priority smallint;
begin
  select * into active_case
  from public.intervention_cases
  where dedupe_key = p_dedupe_key and status in ('open', 'acknowledged')
  for update;

  if active_case.id is not null then
    effective_priority := least(
      5,
      p_rule.priority + greatest(
        floor(extract(epoch from (p_detected_at - active_case.first_detected_at))
          / greatest(extract(epoch from p_rule.window_interval), 1)),
        0
      )::integer
    )::smallint;
    if active_case.last_detected_at is distinct from p_detected_at then
      update public.intervention_cases
      set last_detected_at = p_detected_at,
        detection_count = detection_count + 1,
        evidence = p_evidence,
        priority = effective_priority,
        escalated_at = case
          when effective_priority > active_case.priority
            then coalesce(active_case.escalated_at, p_detected_at)
          else active_case.escalated_at
        end
      where id = active_case.id;
    end if;
    return true;
  end if;

  select * into previous_case
  from public.intervention_cases
  where dedupe_key = p_dedupe_key and status in ('resolved', 'dismissed')
  order by coalesce(resolved_at, dismissed_at, updated_at) desc, id
  limit 1
  for update;

  if previous_case.id is not null
    and p_detected_at < coalesce(previous_case.resolved_at, previous_case.dismissed_at, previous_case.updated_at)
      + p_rule.cooldown_interval then
    return true;
  end if;

  insert into public.intervention_cases (
    rule_id, subject_type, subject_id, dedupe_key, status, priority,
    reason_code, evidence, recommended_action, first_detected_at,
    last_detected_at, reopened_from_case_id
  ) values (
    p_rule.id, p_subject_type, p_subject_id, p_dedupe_key, 'open', p_rule.priority,
    p_reason_code, p_evidence, p_rule.action_code, p_detected_at,
    p_detected_at, previous_case.id
  );
  return true;
end;
$$;

revoke all on function private.upsert_intervention_candidate(
  public.intervention_rules, text, uuid, text, text, jsonb, timestamptz
) from public, anon, authenticated, service_role;

create or replace function public.evaluate_intervention_rules(
  p_at timestamptz default pg_catalog.now()
)
returns integer
language plpgsql
security definer
set search_path = ''
set statement_timeout = '30s'
as $$
declare
  rule_row public.intervention_rules%rowtype;
  candidate record;
  candidate_key text;
  detected_keys text[];
  detected_count integer := 0;
  current_run_id bigint;
begin
  if current_user not in ('postgres', 'service_role') then
    raise exception using errcode = '42501', message = 'intervention_evaluator_forbidden';
  end if;
  if p_at is null then
    raise exception using errcode = '22023', message = 'intervention_evaluation_time_invalid';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('public.evaluate_intervention_rules'));
  insert into public.job_runs(job_name, details)
  values ('evaluate_intervention_rules', jsonb_build_object('evaluated_at', p_at))
  returning id into current_run_id;

  for rule_row in
    select * from public.intervention_rules where is_enabled order by priority desc, rule_type, id
  loop
    detected_keys := array[]::text[];

    if rule_row.rule_type = 'student_absence' then
      for candidate in
        select session.student_id as subject_id,
          count(*)::integer as observed_count
        from public.sessions as session
        join public.attendance as attendance on attendance.session_id = session.id
        where attendance.status = 'student_absent'
          and session.scheduled_at > p_at - rule_row.window_interval
          and session.scheduled_at <= p_at
        group by session.student_id
        having count(*) >= (rule_row.thresholds ->> 'min_absences')::integer
      loop
        candidate_key := rule_row.rule_type || ':' || candidate.subject_id::text;
        detected_keys := array_append(detected_keys, candidate_key);
        perform private.upsert_intervention_candidate(
          rule_row, 'student', candidate.subject_id, candidate_key,
          'absence_threshold_reached',
          jsonb_build_object(
            'absences', candidate.observed_count,
            'minimum', (rule_row.thresholds ->> 'min_absences')::integer,
            'window_start', p_at - rule_row.window_interval,
            'window_end', p_at
          ),
          p_at
        );
        detected_count := detected_count + 1;
      end loop;
    elsif rule_row.rule_type = 'student_struggle' then
      for candidate in
        select session.student_id as subject_id,
          count(*)::integer as observed_count,
          round(avg(evaluation.total_score), 2) as observed_average
        from public.session_evaluations as evaluation
        join public.sessions as session on session.id = evaluation.session_id
        where evaluation.is_locked
          and evaluation.locked_at > p_at - rule_row.window_interval
          and evaluation.locked_at <= p_at
        group by session.student_id
        having count(*) >= (rule_row.thresholds ->> 'min_evaluations')::integer
          and avg(evaluation.total_score) <= (rule_row.thresholds ->> 'max_average')::numeric
      loop
        candidate_key := rule_row.rule_type || ':' || candidate.subject_id::text;
        detected_keys := array_append(detected_keys, candidate_key);
        perform private.upsert_intervention_candidate(
          rule_row, 'student', candidate.subject_id, candidate_key,
          'evaluation_average_below_threshold',
          jsonb_build_object(
            'evaluation_average', candidate.observed_average,
            'evaluations', candidate.observed_count,
            'maximum_average', (rule_row.thresholds ->> 'max_average')::integer,
            'minimum_evaluations', (rule_row.thresholds ->> 'min_evaluations')::integer,
            'window_start', p_at - rule_row.window_interval,
            'window_end', p_at
          ),
          p_at
        );
        detected_count := detected_count + 1;
      end loop;
    elsif rule_row.rule_type = 'teacher_late' then
      for candidate in
        select session.teacher_id as subject_id,
          count(*)::integer as observed_count,
          max(floor(extract(epoch from (attendance.teacher_joined_at - session.scheduled_at)) / 60))::integer
            as maximum_late_minutes
        from public.sessions as session
        join public.attendance as attendance on attendance.session_id = session.id
        where attendance.teacher_joined_at is not null
          and attendance.teacher_joined_at >= session.scheduled_at
            + pg_catalog.make_interval(mins => (rule_row.thresholds ->> 'min_late_minutes')::integer)
          and session.scheduled_at > p_at - rule_row.window_interval
          and session.scheduled_at <= p_at
        group by session.teacher_id
        having count(*) >= (rule_row.thresholds ->> 'min_occurrences')::integer
      loop
        candidate_key := rule_row.rule_type || ':' || candidate.subject_id::text;
        detected_keys := array_append(detected_keys, candidate_key);
        perform private.upsert_intervention_candidate(
          rule_row, 'teacher', candidate.subject_id, candidate_key,
          'teacher_lateness_threshold_reached',
          jsonb_build_object(
            'occurrences', candidate.observed_count,
            'maximum_late_minutes', candidate.maximum_late_minutes,
            'minimum_late_minutes', (rule_row.thresholds ->> 'min_late_minutes')::integer,
            'window_start', p_at - rule_row.window_interval,
            'window_end', p_at
          ),
          p_at
        );
        detected_count := detected_count + 1;
      end loop;
    elsif rule_row.rule_type = 'renewal_due' then
      for candidate in
        select subscription.id as subject_id, subscription.renew_date
        from public.subscriptions as subscription
        where subscription.status in ('trial', 'active', 'paused')
          and subscription.renew_date between p_at::date
            and p_at::date + (rule_row.thresholds ->> 'days_before')::integer
      loop
        candidate_key := rule_row.rule_type || ':' || candidate.subject_id::text;
        detected_keys := array_append(detected_keys, candidate_key);
        perform private.upsert_intervention_candidate(
          rule_row, 'subscription', candidate.subject_id, candidate_key,
          'subscription_renewal_due',
          jsonb_build_object(
            'renew_date', candidate.renew_date,
            'days_remaining', candidate.renew_date - p_at::date,
            'days_before', (rule_row.thresholds ->> 'days_before')::integer
          ),
          p_at
        );
        detected_count := detected_count + 1;
      end loop;
    elsif rule_row.rule_type = 'payment_overdue' then
      for candidate in
        select invoice.id as subject_id, invoice.due_date, invoice.status::text as invoice_status
        from public.invoices as invoice
        where invoice.status in ('issued', 'partially_paid', 'overdue')
          and invoice.due_date is not null
          and invoice.due_date <= p_at::date - (rule_row.thresholds ->> 'days_overdue')::integer
      loop
        candidate_key := rule_row.rule_type || ':' || candidate.subject_id::text;
        detected_keys := array_append(detected_keys, candidate_key);
        perform private.upsert_intervention_candidate(
          rule_row, 'invoice', candidate.subject_id, candidate_key,
          'invoice_payment_overdue',
          jsonb_build_object(
            'due_date', candidate.due_date,
            'invoice_status', candidate.invoice_status,
            'days_overdue', p_at::date - candidate.due_date
          ),
          p_at
        );
        detected_count := detected_count + 1;
      end loop;
    elsif rule_row.rule_type = 'report_pending' then
      for candidate in
        select report.id as subject_id, report.status::text as report_status, report.updated_at
        from public.reports as report
        where report.status::text in ('draft', 'submitted')
          and report.updated_at <= p_at
            - pg_catalog.make_interval(days => (rule_row.thresholds ->> 'days_pending')::integer)
      loop
        candidate_key := rule_row.rule_type || ':' || candidate.subject_id::text;
        detected_keys := array_append(detected_keys, candidate_key);
        perform private.upsert_intervention_candidate(
          rule_row, 'report', candidate.subject_id, candidate_key,
          'report_pending_too_long',
          jsonb_build_object(
            'report_status', candidate.report_status,
            'pending_since', candidate.updated_at,
            'days_pending', floor(extract(epoch from (p_at - candidate.updated_at)) / 86400)::integer
          ),
          p_at
        );
        detected_count := detected_count + 1;
      end loop;
    elsif rule_row.rule_type = 'credit_exhausted' then
      for candidate in
        select subscription.id as subject_id,
          coalesce(balance.sessions_remaining, 0)::integer as sessions_remaining
        from public.subscriptions as subscription
        left join public.subscription_balance as balance on balance.subscription_id = subscription.id
        where subscription.status in ('trial', 'active')
          and coalesce(balance.sessions_remaining, 0)
            <= (rule_row.thresholds ->> 'max_remaining')::integer
      loop
        candidate_key := rule_row.rule_type || ':' || candidate.subject_id::text;
        detected_keys := array_append(detected_keys, candidate_key);
        perform private.upsert_intervention_candidate(
          rule_row, 'subscription', candidate.subject_id, candidate_key,
          'session_credit_exhausted',
          jsonb_build_object(
            'sessions_remaining', candidate.sessions_remaining,
            'maximum_remaining', (rule_row.thresholds ->> 'max_remaining')::integer
          ),
          p_at
        );
        detected_count := detected_count + 1;
      end loop;
    end if;

    update public.intervention_cases
    set status = 'resolved', resolved_at = p_at, resolved_by = null,
      disposition_reason = 'condition_cleared'
    where rule_id = rule_row.id
      and status in ('open', 'acknowledged')
      and not (dedupe_key = any(detected_keys));
  end loop;

  update public.job_runs
  set finished_at = pg_catalog.clock_timestamp(), result = 'succeeded',
    affected_rows = detected_count,
    details = details || jsonb_build_object('detected_cases', detected_count)
  where id = current_run_id;

  return detected_count;
end;
$$;

revoke all on function public.evaluate_intervention_rules(timestamptz)
from public, anon, authenticated, service_role;
grant execute on function public.evaluate_intervention_rules(timestamptz)
to service_role;

select cron.schedule(
  'evaluate-interventions-hourly',
  '5 * * * *',
  $$select public.evaluate_intervention_rules()$$
)
where not exists (
  select 1 from cron.job where jobname = 'evaluate-interventions-hourly'
);

comment on table public.intervention_rules is
'P10 deterministic intervention registry; thresholds are validated per known rule type.';
comment on table public.intervention_cases is
'P10 explainable intervention history with one active case per deterministic dedupe key.';
comment on function public.evaluate_intervention_rules(timestamptz) is
'Evaluates enabled rules under a transaction advisory lock, deduplicates active cases, and preserves reopen history.';
