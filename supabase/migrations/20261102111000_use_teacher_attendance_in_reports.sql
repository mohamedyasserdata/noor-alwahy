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
    select
      session.id,
      session.student_id,
      session.teacher_id,
      student_attendance.status as student_attendance_status,
      teacher_attendance.status as teacher_attendance_status
    from public.sessions as session
    left join public.attendance as student_attendance
      on student_attendance.session_id = session.id
    left join public.teacher_attendance as teacher_attendance
      on teacher_attendance.session_id = session.id
    where session.scheduled_at >= instant_start
      and session.scheduled_at < instant_end
      and session.status not in ('cancelled', 'rescheduled')
  ), student_rows as (
    select
      'student'::text as row_type,
      student.id as row_id,
      student.full_name as row_name,
      count(*) filter (
        where period.student_attendance_status not in (
          'teacher_absent', 'cancelled_teacher', 'cancelled_admin'
        )
        or period.student_attendance_status is null
      ) as row_scheduled,
      count(*) filter (
        where period.student_attendance_status in ('present', 'late')
      ) as row_attended,
      count(*) filter (
        where period.student_attendance_status in ('student_absent', 'student_excused')
      ) as row_absent
    from period_sessions as period
    join public.students as student on student.id = period.student_id
    group by student.id, student.full_name
  ), teacher_rows as (
    select
      'teacher'::text as row_type,
      teacher.id as row_id,
      profile.full_name as row_name,
      count(*) as row_scheduled,
      count(*) filter (
        where period.teacher_attendance_status in ('present', 'late')
      ) as row_attended,
      count(*) filter (
        where period.teacher_attendance_status in ('absent', 'excused')
      ) as row_absent
    from period_sessions as period
    join public.teachers as teacher on teacher.id = period.teacher_id
    join public.profiles as profile on profile.id = teacher.profile_id
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
      else round(
        (combined.row_attended::numeric / combined.row_scheduled::numeric) * 100,
        1
      )
    end
  from combined
  order by combined.row_type, combined.row_name, combined.row_id;
end;
$$;

revoke execute on function public.get_attendance_report(text, date)
from public, anon, service_role;
grant execute on function public.get_attendance_report(text, date)
to authenticated;
