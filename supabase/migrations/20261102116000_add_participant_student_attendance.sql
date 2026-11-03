alter table public.attendance
add column id uuid default gen_random_uuid(),
add column student_id uuid references public.students(id) on delete restrict,
add column correction_reason text check (
  correction_reason is null or char_length(btrim(correction_reason)) between 2 and 1000
);

update public.attendance as attendance
set student_id = session.student_id,
    id = coalesce(attendance.id, gen_random_uuid())
from public.sessions as session
where session.id = attendance.session_id;

alter table public.attendance
alter column id set not null,
alter column student_id set not null;

alter table public.attendance drop constraint attendance_pkey;
alter table public.attendance add constraint attendance_pkey primary key (id);
alter table public.attendance
add constraint attendance_session_student_key unique (session_id, student_id);

create index attendance_student_recorded_idx
on public.attendance (student_id, recorded_at desc);

create or replace function private.fill_attendance_student()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.student_id is null then
    select session.student_id into new.student_id
    from public.sessions as session
    where session.id = new.session_id;
  end if;

  if not exists (
    select 1
    from public.session_participants as participant
    where participant.session_id = new.session_id
      and participant.student_id = new.student_id
  ) then
    raise exception using errcode = '23514', message = 'attendance_student_not_participant';
  end if;

  return new;
end;
$$;

revoke execute on function private.fill_attendance_student()
from public, anon, authenticated, service_role;

create trigger attendance_fill_student
before insert or update of session_id, student_id on public.attendance
for each row execute function private.fill_attendance_student();

drop policy attendance_student_read on public.attendance;
create policy attendance_student_read
on public.attendance
for select to authenticated
using (exists (
  select 1
  from public.students as student
  where student.id = attendance.student_id
    and student.profile_id = (select auth.uid())
));

drop policy attendance_parent_read on public.attendance;
create policy attendance_parent_read
on public.attendance
for select to authenticated
using ((select private.guards_student(student_id)));

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
  policy_value jsonb;
  lock_hours integer;
  attendance_deadline timestamptz;
  actor_is_admin boolean := (select public.is_admin());
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

  if not actor_is_admin
    and session_row.teacher_id is distinct from (select private.current_teacher_id()) then
    raise exception using errcode = '42501', message = 'attendance_forbidden';
  end if;

  select setting.value into policy_value
  from public.app_settings as setting
  where setting.key = 'attendance_policy';
  lock_hours := coalesce((policy_value ->> 'attendance_lock_hours')::integer, 48);
  attendance_deadline := session_row.ends_at + pg_catalog.make_interval(hours => lock_hours);

  if not actor_is_admin and statement_timestamp() > attendance_deadline then
    raise exception using errcode = 'P0001', message = 'attendance_locked';
  end if;
  if p_minutes is not null and p_minutes not between 0 and 240 then
    raise exception using errcode = '22023', message = 'invalid_attendance_minutes';
  end if;

  select * into existing_attendance
  from public.attendance
  where session_id = p_session_id
    and student_id = session_row.student_id;

  if existing_attendance.id is not null then
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
    student_id,
    status,
    student_joined_at,
    teacher_joined_at,
    minutes,
    student_notice_at,
    recorded_by,
    locked_at
  )
  values (
    p_session_id,
    session_row.student_id,
    p_status,
    p_student_joined_at,
    p_teacher_joined_at,
    p_minutes,
    p_student_notice_at,
    actor_id,
    attendance_deadline
  )
  returning * into saved_attendance;

  if session_row.format = 'individual' then
    perform private.apply_attendance_effects(p_session_id);
  end if;

  return saved_attendance;
end;
$$;

revoke execute on function public.record_attendance(uuid, public.attendance_status, timestamptz, timestamptz, integer, timestamptz)
from public, anon, service_role;
grant execute on function public.record_attendance(uuid, public.attendance_status, timestamptz, timestamptz, integer, timestamptz)
to authenticated;

create or replace function public.record_student_attendance(
  p_session_id uuid,
  p_student_id uuid,
  p_status public.attendance_status,
  p_correction_reason text default null
)
returns public.attendance
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  actor_is_admin boolean := (select public.is_admin());
  session_row public.sessions%rowtype;
  existing_row public.attendance%rowtype;
  saved_row public.attendance%rowtype;
  policy_value jsonb;
  lock_hours integer;
  attendance_deadline timestamptz;
  reason_value text := nullif(pg_catalog.btrim(p_correction_reason), '');
begin
  if actor_id is null then
    raise exception using errcode = '42501', message = 'attendance_forbidden';
  end if;
  if p_status not in ('present', 'late', 'student_absent', 'student_excused') then
    raise exception using errcode = '22023', message = 'student_attendance_status_invalid';
  end if;

  select session.* into session_row
  from public.sessions as session
  where session.id = p_session_id
  for update;

  if session_row.id is null then
    raise exception using errcode = 'P0002', message = 'attendance_session_not_found';
  end if;
  if not actor_is_admin
    and session_row.teacher_id is distinct from (select private.current_teacher_id()) then
    raise exception using errcode = '42501', message = 'attendance_forbidden';
  end if;
  if not exists (
    select 1
    from public.session_participants as participant
    where participant.session_id = p_session_id
      and participant.student_id = p_student_id
  ) then
    raise exception using errcode = '42501', message = 'attendance_student_not_participant';
  end if;

  select setting.value into policy_value
  from public.app_settings as setting
  where setting.key = 'attendance_policy';
  lock_hours := coalesce((policy_value ->> 'attendance_lock_hours')::integer, 48);
  attendance_deadline := session_row.ends_at + pg_catalog.make_interval(hours => lock_hours);
  if not actor_is_admin and statement_timestamp() > attendance_deadline then
    raise exception using errcode = 'P0001', message = 'attendance_locked';
  end if;

  select attendance.* into existing_row
  from public.attendance as attendance
  where attendance.session_id = p_session_id
    and attendance.student_id = p_student_id
  for update;

  if existing_row.id is not null then
    if existing_row.status = p_status then
      return existing_row;
    end if;
    if reason_value is null or char_length(reason_value) not between 2 and 1000 then
      raise exception using errcode = '22023', message = 'attendance_correction_reason_required';
    end if;
    if session_row.format = 'individual'
      and (
        existing_row.status not in ('present', 'late')
        or p_status not in ('present', 'late')
      ) then
      raise exception using
        errcode = 'P0001',
        message = 'attendance_financial_correction_requires_admin_adjustment';
    end if;

    update public.attendance
    set status = p_status,
        correction_reason = reason_value,
        recorded_by = actor_id,
        recorded_at = statement_timestamp()
    where id = existing_row.id
    returning * into saved_row;
    return saved_row;
  end if;

  insert into public.attendance (
    session_id,
    student_id,
    status,
    recorded_by,
    locked_at
  )
  values (
    p_session_id,
    p_student_id,
    p_status,
    actor_id,
    attendance_deadline
  )
  returning * into saved_row;

  if session_row.format = 'individual' and p_student_id = session_row.student_id then
    perform private.apply_attendance_effects(p_session_id);
  end if;

  return saved_row;
end;
$$;

revoke execute on function public.record_student_attendance(uuid, uuid, public.attendance_status, text)
from public, anon, service_role;
grant execute on function public.record_student_attendance(uuid, uuid, public.attendance_status, text)
to authenticated;

create or replace function public.get_attendance_report(
  p_period text,
  p_anchor date default current_date
)
returns table (
  entity_type text,
  entity_id uuid,
  entity_name text,
  scheduled_count bigint,
  attended_count bigint,
  absent_count bigint,
  adherence_percent numeric
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor_role public.user_role := (select public.auth_role());
  range_start date;
  range_end date;
  instant_start timestamptz;
  instant_end timestamptz;
begin
  if actor_role is distinct from 'admin'::public.user_role then
    raise exception using errcode = '42501', message = 'attendance_report_forbidden';
  end if;
  if not (select public.is_admin()) then
    raise exception using errcode = '42501', message = 'mfa_required';
  end if;

  if p_period = 'daily' then
    range_start := p_anchor;
    range_end := p_anchor + 1;
  elsif p_period = 'weekly' then
    range_start := date_trunc('week', p_anchor::timestamp)::date;
    range_end := range_start + 7;
  elsif p_period = 'monthly' then
    range_start := date_trunc('month', p_anchor::timestamp)::date;
    range_end := (range_start + interval '1 month')::date;
  else
    raise exception using errcode = '22023', message = 'invalid_attendance_report_period';
  end if;

  instant_start := range_start::timestamp at time zone 'Africa/Cairo';
  instant_end := range_end::timestamp at time zone 'Africa/Cairo';

  return query
  with period_sessions as (
    select session.id, session.teacher_id
    from public.sessions as session
    where session.scheduled_at >= instant_start
      and session.scheduled_at < instant_end
      and session.status not in ('cancelled', 'rescheduled')
  ), participant_rows as (
    select
      period.id as session_id,
      participant.student_id,
      attendance.status as attendance_status
    from period_sessions as period
    join public.session_participants as participant on participant.session_id = period.id
    left join public.attendance as attendance
      on attendance.session_id = period.id
      and attendance.student_id = participant.student_id
  ), student_rows as (
    select
      'student'::text as row_type,
      student.id as row_id,
      student.full_name as row_name,
      count(*) filter (
        where participant.attendance_status not in (
          'teacher_absent', 'cancelled_teacher', 'cancelled_admin'
        ) or participant.attendance_status is null
      ) as row_scheduled,
      count(*) filter (where participant.attendance_status in ('present', 'late')) as row_attended,
      count(*) filter (
        where participant.attendance_status in ('student_absent', 'student_excused')
      ) as row_absent
    from participant_rows as participant
    join public.students as student on student.id = participant.student_id
    group by student.id, student.full_name
  ), teacher_rows as (
    select
      'teacher'::text as row_type,
      teacher.id as row_id,
      profile.full_name as row_name,
      count(*) as row_scheduled,
      count(*) filter (where teacher_attendance.status in ('present', 'late')) as row_attended,
      count(*) filter (where teacher_attendance.status in ('absent', 'excused')) as row_absent
    from period_sessions as period
    join public.teachers as teacher on teacher.id = period.teacher_id
    join public.profiles as profile on profile.id = teacher.profile_id
    left join public.teacher_attendance as teacher_attendance
      on teacher_attendance.session_id = period.id
    group by teacher.id, profile.full_name
  ), combined as (
    select * from student_rows
    union all
    select * from teacher_rows
  )
  select
    combined.row_type,
    combined.row_id,
    combined.row_name,
    combined.row_scheduled,
    combined.row_attended,
    combined.row_absent,
    case
      when combined.row_scheduled = 0 then 0::numeric
      else round((combined.row_attended::numeric / combined.row_scheduled::numeric) * 100, 1)
    end
  from combined
  order by combined.row_type, combined.row_name, combined.row_id;
end;
$$;

revoke execute on function public.get_attendance_report(text, date)
from public, anon, service_role;
grant execute on function public.get_attendance_report(text, date)
to authenticated;
