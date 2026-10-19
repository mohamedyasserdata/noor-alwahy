alter table public.subscriptions
add column policy_snapshot jsonb not null default jsonb_build_object(
  'cancel_notice_hours', 12,
  'max_makeups_per_period', 2,
  'makeup_valid_days', 30,
  'student_no_show_consumes_credit', true,
  'student_no_show_pays_teacher', true
);

alter table public.subscriptions
add constraint subscriptions_policy_snapshot_valid check (
  jsonb_typeof(policy_snapshot) = 'object'
  and jsonb_typeof(policy_snapshot -> 'cancel_notice_hours') = 'number'
  and (policy_snapshot ->> 'cancel_notice_hours')::integer >= 0
  and jsonb_typeof(policy_snapshot -> 'max_makeups_per_period') = 'number'
  and (policy_snapshot ->> 'max_makeups_per_period')::integer >= 0
  and jsonb_typeof(policy_snapshot -> 'makeup_valid_days') = 'number'
  and (policy_snapshot ->> 'makeup_valid_days')::integer > 0
  and jsonb_typeof(policy_snapshot -> 'student_no_show_consumes_credit') = 'boolean'
  and jsonb_typeof(policy_snapshot -> 'student_no_show_pays_teacher') = 'boolean'
);

create table public.attendance (
  session_id uuid primary key references public.sessions(id) on delete restrict,
  status public.attendance_status not null,
  student_joined_at timestamptz,
  teacher_joined_at timestamptz,
  minutes integer check (minutes is null or minutes between 0 and 240),
  student_notice_at timestamptz,
  recorded_by uuid not null references public.profiles(id) on delete restrict,
  recorded_at timestamptz not null default now(),
  locked_at timestamptz,
  updated_at timestamptz not null default now()
);

create index attendance_recorded_by_idx on public.attendance (recorded_by);
create index attendance_status_recorded_idx on public.attendance (status, recorded_at desc);

create table public.teacher_rates (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.teachers(id) on delete restrict,
  track_id uuid references public.tracks(id) on delete restrict,
  duration_min integer check (duration_min is null or duration_min between 10 and 120),
  rate_per_session numeric(12,2) not null check (rate_per_session >= 0),
  currency character(3) not null check (currency ~ '^[A-Z]{3}$'),
  valid_from date not null,
  created_by uuid references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique nulls not distinct (teacher_id, track_id, duration_min, valid_from)
);

create index teacher_rates_lookup_idx
on public.teacher_rates (teacher_id, valid_from desc, track_id, duration_min);
create index teacher_rates_track_id_idx on public.teacher_rates (track_id) where track_id is not null;
create index teacher_rates_created_by_idx on public.teacher_rates (created_by) where created_by is not null;

create table public.teacher_payout_items (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null unique references public.sessions(id) on delete restrict,
  teacher_id uuid not null references public.teachers(id) on delete restrict,
  amount numeric(12,2) not null check (amount >= 0),
  currency character(3) not null check (currency ~ '^[A-Z]{3}$'),
  rate_snapshot numeric(12,2) not null check (rate_snapshot >= 0),
  kind text not null check (kind in ('session', 'makeup', 'substitute', 'no_show')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index teacher_payout_items_teacher_created_idx
on public.teacher_payout_items (teacher_id, created_at desc);

create table public.makeup_entitlements (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.subscriptions(id) on delete restrict,
  student_id uuid not null references public.students(id) on delete restrict,
  source_session_id uuid not null unique references public.sessions(id) on delete restrict,
  outside_period_cap boolean not null default false,
  expires_at timestamptz not null,
  used_by_session_id uuid unique references public.sessions(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expires_at > created_at)
);

create index makeup_entitlements_subscription_available_idx
on public.makeup_entitlements (subscription_id, expires_at)
where used_by_session_id is null;
create index makeup_entitlements_student_available_idx
on public.makeup_entitlements (student_id, expires_at)
where used_by_session_id is null;

create trigger attendance_set_updated_at
before update on public.attendance
for each row execute function public.set_updated_at();
create trigger teacher_rates_set_updated_at
before update on public.teacher_rates
for each row execute function public.set_updated_at();
create trigger teacher_payout_items_set_updated_at
before update on public.teacher_payout_items
for each row execute function public.set_updated_at();
create trigger makeup_entitlements_set_updated_at
before update on public.makeup_entitlements
for each row execute function public.set_updated_at();

create trigger attendance_audit
after insert or update on public.attendance
for each row execute function public.audit_row();
create trigger teacher_rates_audit
after insert or update or delete on public.teacher_rates
for each row execute function public.audit_row();
create trigger teacher_payout_items_audit
after insert on public.teacher_payout_items
for each row execute function public.audit_row();
create trigger makeup_entitlements_audit
after insert or update on public.makeup_entitlements
for each row execute function public.audit_row();

create or replace function public.prevent_teacher_payout_item_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception using errcode = 'P0001', message = 'teacher_payout_item_immutable';
end;
$$;

revoke execute on function public.prevent_teacher_payout_item_mutation() from public, anon, authenticated, service_role;

create trigger teacher_payout_items_immutable
before update or delete on public.teacher_payout_items
for each row execute function public.prevent_teacher_payout_item_mutation();

alter table public.attendance enable row level security;
alter table public.teacher_rates enable row level security;
alter table public.teacher_payout_items enable row level security;
alter table public.makeup_entitlements enable row level security;

revoke all on public.attendance from public, anon, authenticated;
revoke all on public.teacher_rates from public, anon, authenticated;
revoke all on public.teacher_payout_items from public, anon, authenticated;
revoke all on public.makeup_entitlements from public, anon, authenticated;

grant select on public.attendance to authenticated;
grant select, insert, update, delete on public.teacher_rates to authenticated;
grant select on public.teacher_payout_items to authenticated;
grant select on public.makeup_entitlements to authenticated;
grant select, insert, update, delete on public.attendance to service_role;
grant select, insert, update, delete on public.teacher_rates to service_role;
grant select, insert, update, delete on public.teacher_payout_items to service_role;
grant select, insert, update, delete on public.makeup_entitlements to service_role;

create policy attendance_admin_read on public.attendance for select to authenticated
using ((select public.is_admin()));
create policy attendance_teacher_read on public.attendance for select to authenticated
using (
  exists (
    select 1 from public.sessions as session
    where session.id = attendance.session_id
      and session.teacher_id = (select private.current_teacher_id())
  )
);
create policy attendance_student_read on public.attendance for select to authenticated
using (
  exists (
    select 1
    from public.sessions as session
    join public.students as student on student.id = session.student_id
    where session.id = attendance.session_id
      and student.profile_id = (select auth.uid())
  )
);
create policy attendance_parent_read on public.attendance for select to authenticated
using (
  exists (
    select 1 from public.sessions as session
    where session.id = attendance.session_id
      and (select private.guards_student(session.student_id))
  )
);

create policy teacher_rates_admin_all on public.teacher_rates for all to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));
create policy teacher_rates_teacher_read on public.teacher_rates for select to authenticated
using (teacher_id = (select private.current_teacher_id()));

create policy teacher_payout_items_admin_read on public.teacher_payout_items for select to authenticated
using ((select public.is_admin()));
create policy teacher_payout_items_teacher_read on public.teacher_payout_items for select to authenticated
using (teacher_id = (select private.current_teacher_id()));

create policy makeup_entitlements_admin_read on public.makeup_entitlements for select to authenticated
using ((select public.is_admin()));
create policy makeup_entitlements_teacher_read on public.makeup_entitlements for select to authenticated
using (
  exists (
    select 1 from public.sessions as session
    where session.id = makeup_entitlements.source_session_id
      and session.teacher_id = (select private.current_teacher_id())
  )
);
create policy makeup_entitlements_student_read on public.makeup_entitlements for select to authenticated
using (
  exists (
    select 1 from public.students as student
    where student.id = makeup_entitlements.student_id
      and student.profile_id = (select auth.uid())
  )
);
create policy makeup_entitlements_parent_read on public.makeup_entitlements for select to authenticated
using ((select private.guards_student(student_id)));

create or replace function private.apply_attendance_effects(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  attendance_row public.attendance%rowtype;
  session_row public.sessions%rowtype;
  subscription_row public.subscriptions%rowtype;
  selected_rate public.teacher_rates%rowtype;
  track_value uuid;
  consume_credit boolean := false;
  pay_teacher boolean := false;
  timely_excuse boolean := false;
  grant_makeup boolean := false;
  outside_cap boolean := false;
  cancel_notice_hours integer;
  max_makeups integer;
  makeup_valid_days integer;
  capped_makeups integer;
  payout_kind text;
  target_status public.session_status;
  admin_profile record;
begin
  select * into attendance_row
  from public.attendance
  where session_id = p_session_id;

  select * into session_row
  from public.sessions
  where id = p_session_id
  for update;

  if attendance_row.session_id is null or session_row.id is null then
    raise exception using errcode = 'P0002', message = 'attendance_session_not_found';
  end if;

  select subscription.* into subscription_row
  from public.subscriptions as subscription
  where subscription.student_id = session_row.student_id
    and subscription.status in ('trial', 'active')
    and session_row.scheduled_at::date between subscription.current_period_start and subscription.current_period_end
  order by subscription.current_period_start desc
  limit 1
  for update;

  if subscription_row.id is null then
    raise exception using errcode = 'P0001', message = 'active_subscription_required';
  end if;

  cancel_notice_hours := (subscription_row.policy_snapshot ->> 'cancel_notice_hours')::integer;
  max_makeups := (subscription_row.policy_snapshot ->> 'max_makeups_per_period')::integer;
  makeup_valid_days := (subscription_row.policy_snapshot ->> 'makeup_valid_days')::integer;
  timely_excuse := attendance_row.status = 'student_excused'
    and attendance_row.student_notice_at is not null
    and attendance_row.student_notice_at <= session_row.scheduled_at - pg_catalog.make_interval(hours => cancel_notice_hours);

  consume_credit := case attendance_row.status
    when 'present' then true
    when 'late' then true
    when 'student_absent' then (subscription_row.policy_snapshot ->> 'student_no_show_consumes_credit')::boolean
    when 'student_excused' then not timely_excuse and (subscription_row.policy_snapshot ->> 'student_no_show_consumes_credit')::boolean
    else false
  end;

  pay_teacher := case attendance_row.status
    when 'present' then true
    when 'late' then true
    when 'student_absent' then (subscription_row.policy_snapshot ->> 'student_no_show_pays_teacher')::boolean
    when 'student_excused' then not timely_excuse and (subscription_row.policy_snapshot ->> 'student_no_show_pays_teacher')::boolean
    else false
  end;

  target_status := case attendance_row.status
    when 'present' then 'held'::public.session_status
    when 'late' then 'held'::public.session_status
    when 'student_absent' then 'missed'::public.session_status
    when 'student_excused' then 'missed'::public.session_status
    when 'teacher_absent' then 'missed'::public.session_status
    else 'cancelled'::public.session_status
  end;

  update public.sessions
  set status = target_status,
      started_at = coalesce(started_at, attendance_row.teacher_joined_at),
      ended_at = case
        when attendance_row.teacher_joined_at is not null and attendance_row.minutes is not null
          then attendance_row.teacher_joined_at + pg_catalog.make_interval(mins => attendance_row.minutes)
        else ended_at
      end
  where id = p_session_id;

  if consume_credit then
    insert into public.session_credit_ledger (
      subscription_id, delta, reason, session_id, note, created_by
    )
    values (
      subscription_row.id, -1, 'consume', p_session_id, 'attendance_effect', attendance_row.recorded_by
    )
    on conflict (session_id) where reason = 'consume' do nothing;
  end if;

  if pay_teacher then
    if session_row.assignment_id is not null then
      select assignment.track_id into track_value
      from public.teacher_assignments as assignment
      where assignment.id = session_row.assignment_id;
    end if;

    select rate.* into selected_rate
    from public.teacher_rates as rate
    where rate.teacher_id = session_row.teacher_id
      and rate.valid_from <= session_row.scheduled_at::date
      and (rate.track_id is null or rate.track_id = track_value)
      and (rate.duration_min is null or rate.duration_min = session_row.duration_min)
    order by
      ((rate.track_id is not null)::integer + (rate.duration_min is not null)::integer) desc,
      rate.valid_from desc,
      rate.id
    limit 1;

    if selected_rate.id is null then
      raise exception using errcode = 'P0001', message = 'teacher_rate_missing';
    end if;

    payout_kind := case
      when session_row.kind = 'makeup' then 'makeup'
      when session_row.original_teacher_id is not null and session_row.original_teacher_id <> session_row.teacher_id then 'substitute'
      when attendance_row.status in ('student_absent', 'student_excused') then 'no_show'
      else 'session'
    end;

    insert into public.teacher_payout_items (
      session_id, teacher_id, amount, currency, rate_snapshot, kind
    )
    values (
      p_session_id, session_row.teacher_id, selected_rate.rate_per_session,
      selected_rate.currency, selected_rate.rate_per_session, payout_kind
    )
    on conflict (session_id) do nothing;
  end if;

  if timely_excuse then
    select count(*)::integer into capped_makeups
    from public.makeup_entitlements as entitlement
    where entitlement.subscription_id = subscription_row.id
      and not entitlement.outside_period_cap
      and entitlement.created_at::date between subscription_row.current_period_start and subscription_row.current_period_end;

    grant_makeup := capped_makeups < max_makeups;
  elsif attendance_row.status in ('teacher_absent', 'cancelled_teacher', 'cancelled_admin') then
    grant_makeup := true;
    outside_cap := true;
  end if;

  if grant_makeup then
    insert into public.makeup_entitlements (
      subscription_id, student_id, source_session_id, outside_period_cap, expires_at
    )
    values (
      subscription_row.id,
      session_row.student_id,
      p_session_id,
      outside_cap,
      attendance_row.recorded_at + pg_catalog.make_interval(days => makeup_valid_days)
    )
    on conflict (source_session_id) do nothing;
  end if;

  if attendance_row.status = 'student_absent'
    or (attendance_row.status = 'student_excused' and not timely_excuse) then
    perform private.notify_session_parties(
      session_row.student_id,
      'student_absent',
      pg_catalog.jsonb_build_object('session_id', p_session_id)
    );
  end if;

  if attendance_row.status = 'teacher_absent' then
    for admin_profile in
      select profile.id
      from public.profiles as profile
      where profile.role = 'admin' and profile.is_active
    loop
      perform private.enqueue_notification(
        admin_profile.id,
        'teacher_absent',
        pg_catalog.jsonb_build_object('session_id', p_session_id)
      );
    end loop;

    perform private.notify_session_parties(
      session_row.student_id,
      'teacher_absent',
      pg_catalog.jsonb_build_object('session_id', p_session_id)
    );
  end if;
end;
$$;

revoke execute on function private.apply_attendance_effects(uuid) from public, anon, authenticated, service_role;

create or replace function public.record_attendance(
  p_session_id uuid,
  p_status public.attendance_status,
  p_student_joined_at timestamptz default null,
  p_teacher_joined_at timestamptz default null,
  p_minutes integer default null,
  p_student_notice_at timestamptz default null
)
returns public.attendance
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  session_row public.sessions%rowtype;
  existing_attendance public.attendance%rowtype;
  saved_attendance public.attendance%rowtype;
begin
  if actor_id is null then
    raise exception using errcode = '42501', message = 'attendance_forbidden';
  end if;

  select * into session_row
  from public.sessions
  where id = p_session_id
  for update;

  if session_row.id is null then
    raise exception using errcode = 'P0002', message = 'attendance_session_not_found';
  end if;

  if not (select public.is_admin())
    and session_row.teacher_id is distinct from (select private.current_teacher_id()) then
    raise exception using errcode = '42501', message = 'attendance_forbidden';
  end if;

  if p_minutes is not null and p_minutes not between 0 and 240 then
    raise exception using errcode = '22023', message = 'invalid_attendance_minutes';
  end if;

  select * into existing_attendance
  from public.attendance
  where session_id = p_session_id;

  if existing_attendance.session_id is not null then
    if existing_attendance.status = p_status
      and existing_attendance.student_joined_at is not distinct from p_student_joined_at
      and existing_attendance.teacher_joined_at is not distinct from p_teacher_joined_at
      and existing_attendance.minutes is not distinct from p_minutes
      and existing_attendance.student_notice_at is not distinct from p_student_notice_at then
      return existing_attendance;
    end if;

    raise exception using errcode = 'P0001', message = 'attendance_conflict';
  end if;

  insert into public.attendance (
    session_id,
    status,
    student_joined_at,
    teacher_joined_at,
    minutes,
    student_notice_at,
    recorded_by
  )
  values (
    p_session_id,
    p_status,
    p_student_joined_at,
    p_teacher_joined_at,
    p_minutes,
    p_student_notice_at,
    actor_id
  )
  returning * into saved_attendance;

  perform private.apply_attendance_effects(p_session_id);

  return saved_attendance;
end;
$$;

revoke execute on function public.record_attendance(uuid, public.attendance_status, timestamptz, timestamptz, integer, timestamptz)
from public, anon, service_role;
grant execute on function public.record_attendance(uuid, public.attendance_status, timestamptz, timestamptz, integer, timestamptz)
to authenticated;
