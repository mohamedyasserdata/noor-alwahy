create extension if not exists pg_cron;

create type public.credit_reason as enum ('grant', 'consume', 'refund', 'adjust', 'expire', 'proration');

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete restrict,
  status public.subscription_status not null default 'trial',
  start_date date not null,
  current_period_start date not null,
  current_period_end date not null,
  paused_until date,
  sessions_per_period integer not null check (sessions_per_period > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (current_period_end >= current_period_start),
  check (current_period_start >= start_date)
);

create unique index subscriptions_one_current_per_student_idx
on public.subscriptions (student_id)
where status in ('trial', 'active', 'paused');
create index subscriptions_student_period_idx
on public.subscriptions (student_id, current_period_start, current_period_end);

create table public.session_credit_ledger (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.subscriptions(id) on delete restrict,
  delta integer not null check (delta <> 0),
  reason public.credit_reason not null,
  session_id uuid references public.sessions(id) on delete restrict,
  note text check (note is null or char_length(btrim(note)) between 2 and 500),
  created_by uuid references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  check ((reason = 'consume' and delta < 0 and session_id is not null) or reason <> 'consume')
);

create unique index session_credit_ledger_consume_once_idx
on public.session_credit_ledger (session_id)
where reason = 'consume';
create index session_credit_ledger_subscription_created_idx
on public.session_credit_ledger (subscription_id, created_at);

create view public.subscription_balance
with (security_invoker = true, security_barrier = true)
as
select
  subscription_id,
  coalesce(sum(delta), 0)::integer as sessions_remaining
from public.session_credit_ledger
group by subscription_id;

create table public.job_runs (
  id bigint generated always as identity primary key,
  job_name text not null check (char_length(btrim(job_name)) between 2 and 100),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  result text not null default 'running' check (result in ('running', 'succeeded', 'failed')),
  affected_rows integer check (affected_rows is null or affected_rows >= 0),
  details jsonb not null default '{}'::jsonb,
  check (finished_at is null or finished_at >= started_at)
);

create index job_runs_name_started_idx on public.job_runs (job_name, started_at desc);

alter table public.schedule_slots
add column ambiguous_time_resolution text
check (ambiguous_time_resolution in ('earlier', 'later'));

create or replace function private.resolve_schedule_wall_clock(
  p_local_date date,
  p_local_time time,
  p_timezone text,
  p_ambiguous_resolution text default null
)
returns timestamptz
language plpgsql
stable
set search_path = ''
as $$
declare
  local_timestamp timestamp := p_local_date + p_local_time;
  postgres_choice timestamptz := (p_local_date + p_local_time) at time zone p_timezone;
  possible_instants timestamptz[];
begin
  if p_ambiguous_resolution is not null and p_ambiguous_resolution not in ('earlier', 'later') then
    raise exception using errcode = '22023', message = 'invalid_ambiguous_time_resolution';
  end if;

  select array_agg(candidate.instant order by candidate.instant)
  into possible_instants
  from (
    select distinct
      (
        local_timestamp
        - pg_catalog.make_interval(
          secs => extract(epoch from ((probe.instant at time zone p_timezone) - (probe.instant at time zone 'UTC')))::integer
        )
      ) at time zone 'UTC' as instant
    from (
      values
        (postgres_choice - interval '2 days'),
        (postgres_choice),
        (postgres_choice + interval '2 days')
    ) as probe(instant)
  ) as candidate
  where candidate.instant at time zone p_timezone = local_timestamp;

  if coalesce(array_length(possible_instants, 1), 0) = 0 then
    raise exception using errcode = '22023', message = 'nonexistent_local_time';
  end if;

  if array_length(possible_instants, 1) > 1 then
    if p_ambiguous_resolution is null then
      raise exception using errcode = '22023', message = 'ambiguous_local_time';
    end if;
    if p_ambiguous_resolution = 'later' then
      return possible_instants[array_length(possible_instants, 1)];
    end if;
  end if;

  return possible_instants[1];
end;
$$;
revoke execute on function private.resolve_schedule_wall_clock(date, time, text, text) from public, anon, authenticated, service_role;

create trigger subscriptions_set_updated_at
before update on public.subscriptions
for each row execute function public.set_updated_at();
create trigger subscriptions_audit
after insert or update or delete on public.subscriptions
for each row execute function public.audit_row();
create trigger session_credit_ledger_audit
after insert on public.session_credit_ledger
for each row execute function public.audit_row();

create or replace function public.prevent_session_credit_ledger_mutation()
returns trigger language plpgsql set search_path = ''
as $$
begin
  raise exception using errcode = 'P0001', message = 'credit_ledger_immutable';
end;
$$;
revoke execute on function public.prevent_session_credit_ledger_mutation() from public, anon, authenticated, service_role;

create trigger session_credit_ledger_immutable
before update or delete on public.session_credit_ledger
for each row execute function public.prevent_session_credit_ledger_mutation();

alter table public.subscriptions enable row level security;
alter table public.session_credit_ledger enable row level security;
alter table public.job_runs enable row level security;

revoke all on public.subscriptions from public, anon, authenticated;
revoke all on public.session_credit_ledger from public, anon, authenticated;
revoke all on public.subscription_balance from public, anon, authenticated;
revoke all on public.job_runs from public, anon, authenticated;

grant select, insert, update, delete on public.subscriptions to authenticated;
grant select, insert on public.session_credit_ledger to authenticated;
grant select on public.subscription_balance to authenticated;
grant select on public.job_runs to authenticated;
grant select, insert, update, delete on public.subscriptions to service_role;
grant select, insert, update, delete on public.session_credit_ledger to service_role;
grant select on public.subscription_balance to service_role;
grant select, insert, update, delete on public.job_runs to service_role;
grant usage, select on sequence public.job_runs_id_seq to service_role;

create policy subscriptions_admin_all on public.subscriptions for all to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));
create policy subscriptions_student_read on public.subscriptions for select to authenticated
using (
  exists (
    select 1 from public.students as student
    where student.id = subscriptions.student_id and student.profile_id = (select auth.uid())
  )
);
create policy subscriptions_parent_read on public.subscriptions for select to authenticated
using ((select private.guards_student(student_id)));

create policy session_credit_ledger_admin_read on public.session_credit_ledger for select to authenticated
using ((select public.is_admin()));
create policy session_credit_ledger_admin_insert on public.session_credit_ledger for insert to authenticated
with check ((select public.is_admin()));
create policy session_credit_ledger_student_read on public.session_credit_ledger for select to authenticated
using (
  exists (
    select 1
    from public.subscriptions as subscription
    join public.students as student on student.id = subscription.student_id
    where subscription.id = session_credit_ledger.subscription_id
      and student.profile_id = (select auth.uid())
  )
);
create policy session_credit_ledger_parent_read on public.session_credit_ledger for select to authenticated
using (
  exists (
    select 1 from public.subscriptions as subscription
    where subscription.id = session_credit_ledger.subscription_id
      and (select private.guards_student(subscription.student_id))
  )
);
create policy job_runs_admin_read on public.job_runs for select to authenticated
using ((select public.is_admin()));

create or replace function public.generate_sessions(
  p_window_start date default current_date,
  p_horizon_days integer default 28
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  generated_count integer := 0;
  current_run_id bigint;
begin
  if p_window_start is null or p_horizon_days is null or p_horizon_days < 1 or p_horizon_days > 366 then
    raise exception using errcode = '22023', message = 'invalid_generation_window';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('public.generate_sessions'));

  insert into public.job_runs (job_name)
  values ('generate_sessions')
  returning id into current_run_id;

  with eligible_subscriptions as (
    select
      subscription.id,
      subscription.student_id,
      subscription.current_period_start,
      subscription.current_period_end,
      coalesce(balance.sessions_remaining, 0) as credit_balance,
      (
        select count(*)::integer
        from public.sessions as existing_session
        join public.schedule_slots as existing_slot on existing_slot.id = existing_session.slot_id
        where existing_session.student_id = subscription.student_id
          and existing_session.status <> 'cancelled'
          and (existing_session.scheduled_at at time zone existing_slot.anchor_timezone)::date
            between subscription.current_period_start and subscription.current_period_end
      ) as reserved_sessions
    from public.subscriptions as subscription
    left join public.subscription_balance as balance on balance.subscription_id = subscription.id
    where subscription.status = 'active'
  ),
  candidate_occurrences as (
    select
      subscription.id as subscription_id,
      assignment.id as assignment_id,
      assignment.student_id,
      assignment.teacher_id,
      slot.id as slot_id,
      slot.duration_min,
      occurrence.local_date,
      private.resolve_schedule_wall_clock(
        occurrence.local_date,
        slot.local_start_time,
        slot.anchor_timezone,
        slot.ambiguous_time_resolution
      ) as scheduled_at,
      greatest(subscription.credit_balance - subscription.reserved_sessions, 0) as available_credits
    from public.schedule_slots as slot
    join public.teacher_assignments as assignment on assignment.id = slot.assignment_id
    join eligible_subscriptions as subscription on subscription.student_id = assignment.student_id
    cross join lateral (
      select generated_date::date as local_date
      from pg_catalog.generate_series(
        p_window_start::timestamp,
        (p_window_start + p_horizon_days - 1)::timestamp,
        interval '1 day'
      ) as generated_date
    ) as occurrence
    where slot.is_active
      and assignment.status = 'active'
      and occurrence.local_date between assignment.start_date and coalesce(assignment.end_date, 'infinity'::date)
      and occurrence.local_date between subscription.current_period_start and subscription.current_period_end
      and extract(dow from occurrence.local_date)::smallint = slot.weekday
      and subscription.credit_balance > subscription.reserved_sessions
  ),
  missing_occurrences as (
    select
      candidate.*,
      row_number() over (
        partition by candidate.subscription_id
        order by candidate.scheduled_at, candidate.slot_id
      ) as credit_ordinal
    from candidate_occurrences as candidate
    where not exists (
      select 1 from public.sessions as existing_session
      where existing_session.slot_id = candidate.slot_id
        and existing_session.scheduled_at = candidate.scheduled_at
    )
  )
  insert into public.sessions (
    assignment_id,
    student_id,
    teacher_id,
    original_teacher_id,
    slot_id,
    kind,
    scheduled_at,
    duration_min
  )
  select
    occurrence.assignment_id,
    occurrence.student_id,
    occurrence.teacher_id,
    occurrence.teacher_id,
    occurrence.slot_id,
    'regular',
    occurrence.scheduled_at,
    occurrence.duration_min
  from missing_occurrences as occurrence
  where occurrence.credit_ordinal <= occurrence.available_credits
  order by occurrence.scheduled_at, occurrence.slot_id
  on conflict (slot_id, scheduled_at) where slot_id is not null do nothing;

  get diagnostics generated_count = row_count;

  update public.job_runs
  set finished_at = pg_catalog.clock_timestamp(), result = 'succeeded', affected_rows = generated_count
  where id = current_run_id;

  return generated_count;
end;
$$;

revoke execute on function public.generate_sessions(date, integer) from public, anon, authenticated;
grant execute on function public.generate_sessions(date, integer) to service_role;

select cron.schedule(
  'generate-sessions-daily',
  '0 2 * * *',
  $$select public.generate_sessions()$$
);
