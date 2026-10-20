alter table public.app_settings
drop constraint app_settings_public_shape;

alter table public.app_settings
add constraint app_settings_public_shape check (
  (
    key = 'academy_profile'
    and value ?& array['name_ar', 'name_en', 'description_ar', 'description_en', 'logo_url']
    and value - array['name_ar', 'name_en', 'description_ar', 'description_en', 'logo_url'] = '{}'::jsonb
    and jsonb_typeof(value -> 'name_ar') = 'string'
    and jsonb_typeof(value -> 'name_en') = 'string'
    and jsonb_typeof(value -> 'description_ar') = 'string'
    and jsonb_typeof(value -> 'description_en') = 'string'
    and (value -> 'logo_url' = 'null'::jsonb or jsonb_typeof(value -> 'logo_url') = 'string')
    and value ->> 'name_ar' = btrim(value ->> 'name_ar')
    and value ->> 'name_en' = btrim(value ->> 'name_en')
    and value ->> 'description_ar' = btrim(value ->> 'description_ar')
    and value ->> 'description_en' = btrim(value ->> 'description_en')
    and char_length(btrim(value ->> 'name_ar')) between 2 and 120
    and char_length(btrim(value ->> 'name_en')) between 2 and 120
    and char_length(btrim(value ->> 'description_ar')) between 2 and 500
    and char_length(btrim(value ->> 'description_en')) between 2 and 500
    and (
      value ->> 'logo_url' is null
      or (
        char_length(value ->> 'logo_url') between 1 and 2048
        and value ->> 'logo_url' like '/%'
        and value ->> 'logo_url' not like '//%'
        and value ->> 'logo_url' !~ '[^A-Za-z0-9_./-]'
        and not (value ->> 'logo_url' ~ '(^|/)\.\.(/|$)')
      )
    )
  )
  or (
    key = 'support_hours'
    and value ?& array['ar', 'en']
    and value - array['ar', 'en'] = '{}'::jsonb
    and jsonb_typeof(value -> 'ar') = 'string'
    and jsonb_typeof(value -> 'en') = 'string'
    and value ->> 'ar' = btrim(value ->> 'ar')
    and value ->> 'en' = btrim(value ->> 'en')
    and char_length(btrim(value ->> 'ar')) between 2 and 500
    and char_length(btrim(value ->> 'en')) between 2 and 500
  )
  or (
    key = 'attendance_policy'
    and value ?& array[
      'attendance_lock_hours',
      'late_tolerance_min',
      'teacher_absence_alert_threshold',
      'teacher_absence_window_days'
    ]
    and value - array[
      'attendance_lock_hours',
      'late_tolerance_min',
      'teacher_absence_alert_threshold',
      'teacher_absence_window_days'
    ] = '{}'::jsonb
    and jsonb_typeof(value -> 'attendance_lock_hours') = 'number'
    and (value ->> 'attendance_lock_hours')::integer between 1 and 87600
    and jsonb_typeof(value -> 'late_tolerance_min') = 'number'
    and (value ->> 'late_tolerance_min')::integer between 1 and 120
    and jsonb_typeof(value -> 'teacher_absence_alert_threshold') = 'number'
    and (value ->> 'teacher_absence_alert_threshold')::integer between 1 and 100
    and jsonb_typeof(value -> 'teacher_absence_window_days') = 'number'
    and (value ->> 'teacher_absence_window_days')::integer between 1 and 365
  )
  or key not in ('academy_profile', 'support_hours', 'attendance_policy')
);

insert into public.app_settings (key, value)
values (
  'attendance_policy',
  jsonb_build_object(
    'attendance_lock_hours', 48,
    'late_tolerance_min', 10,
    'teacher_absence_alert_threshold', 3,
    'teacher_absence_window_days', 30
  )
)
on conflict (key) do nothing;

create table public.session_alerts (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete restrict,
  teacher_id uuid not null references public.teachers(id) on delete restrict,
  student_id uuid not null references public.students(id) on delete restrict,
  type text not null check (type in ('teacher_late', 'teacher_absence_threshold')),
  dedupe_key text not null unique check (char_length(dedupe_key) between 10 and 180),
  detected_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb check (
    jsonb_typeof(metadata) = 'object'
    and octet_length(metadata::text) <= 4096
  ),
  created_at timestamptz not null default now()
);

create index session_alerts_teacher_detected_idx
on public.session_alerts (teacher_id, detected_at desc);
create index session_alerts_student_detected_idx
on public.session_alerts (student_id, detected_at desc);

create trigger session_alerts_audit
after insert on public.session_alerts
for each row execute function public.audit_row();

alter table public.session_alerts enable row level security;
revoke all on table public.session_alerts from public, anon, authenticated;
grant select on table public.session_alerts to authenticated;

create policy session_alerts_admin_read
on public.session_alerts
for select to authenticated
using ((select public.is_admin()));

create or replace function private.detect_teacher_lateness(
  p_now timestamptz default statement_timestamp()
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  policy_value jsonb;
  tolerance_min integer;
  candidate record;
  inserted_alert_id uuid;
  admin_profile record;
  created_count integer := 0;
begin
  select setting.value into policy_value
  from public.app_settings as setting
  where setting.key = 'attendance_policy';

  tolerance_min := coalesce((policy_value ->> 'late_tolerance_min')::integer, 10);

  for candidate in
    select session.id, session.teacher_id, session.student_id, session.scheduled_at
    from public.sessions as session
    left join public.attendance as attendance on attendance.session_id = session.id
    where session.status = 'scheduled'
      and session.scheduled_at + pg_catalog.make_interval(mins => tolerance_min) <= p_now
      and session.ends_at > p_now
      and attendance.session_id is null
  loop
    inserted_alert_id := null;
    insert into public.session_alerts (
      session_id, teacher_id, student_id, type, dedupe_key, detected_at, metadata
    )
    values (
      candidate.id,
      candidate.teacher_id,
      candidate.student_id,
      'teacher_late',
      'teacher_late:' || candidate.id::text,
      p_now,
      pg_catalog.jsonb_build_object(
        'scheduled_at', candidate.scheduled_at,
        'late_tolerance_min', tolerance_min
      )
    )
    on conflict (dedupe_key) do nothing
    returning id into inserted_alert_id;

    if inserted_alert_id is not null then
      created_count := created_count + 1;
      perform private.notify_session_parties(
        candidate.student_id,
        'teacher_late',
        pg_catalog.jsonb_build_object('session_id', candidate.id)
      );

      for admin_profile in
        select profile.id
        from public.profiles as profile
        where profile.role = 'admin' and profile.is_active
      loop
        perform private.enqueue_notification(
          admin_profile.id,
          'teacher_late',
          pg_catalog.jsonb_build_object(
            'session_id', candidate.id,
            'teacher_id', candidate.teacher_id
          )
        );
      end loop;
    end if;
  end loop;

  return created_count;
end;
$$;

revoke execute on function private.detect_teacher_lateness(timestamptz)
from public, anon, authenticated, service_role;

select cron.schedule(
  'detect-teacher-lateness',
  '*/5 * * * *',
  $job$select private.detect_teacher_lateness()$job$
);

create or replace function private.alert_teacher_absence_threshold()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  session_row public.sessions%rowtype;
  policy_value jsonb;
  threshold_count integer;
  window_days integer;
  absence_count integer;
  inserted_alert_id uuid;
  admin_profile record;
  period_key text;
begin
  if new.status not in ('teacher_absent', 'cancelled_teacher') then
    return new;
  end if;

  select * into session_row
  from public.sessions
  where id = new.session_id;

  select setting.value into policy_value
  from public.app_settings as setting
  where setting.key = 'attendance_policy';

  threshold_count := coalesce((policy_value ->> 'teacher_absence_alert_threshold')::integer, 3);
  window_days := coalesce((policy_value ->> 'teacher_absence_window_days')::integer, 30);

  select count(*)::integer into absence_count
  from public.attendance as attendance
  join public.sessions as session on session.id = attendance.session_id
  where session.teacher_id = session_row.teacher_id
    and attendance.status in ('teacher_absent', 'cancelled_teacher')
    and session.scheduled_at >= statement_timestamp() - pg_catalog.make_interval(days => window_days);

  if absence_count < threshold_count then
    return new;
  end if;

  period_key := pg_catalog.to_char(statement_timestamp() at time zone 'UTC', 'YYYY-MM');
  insert into public.session_alerts (
    session_id, teacher_id, student_id, type, dedupe_key, metadata
  )
  values (
    new.session_id,
    session_row.teacher_id,
    session_row.student_id,
    'teacher_absence_threshold',
    'teacher_absence_threshold:' || session_row.teacher_id::text || ':' || period_key,
    pg_catalog.jsonb_build_object(
      'absence_count', absence_count,
      'threshold', threshold_count,
      'window_days', window_days
    )
  )
  on conflict (dedupe_key) do nothing
  returning id into inserted_alert_id;

  if inserted_alert_id is not null then
    for admin_profile in
      select profile.id
      from public.profiles as profile
      where profile.role = 'admin' and profile.is_active
    loop
      perform private.enqueue_notification(
        admin_profile.id,
        'teacher_absence_threshold',
        pg_catalog.jsonb_build_object(
          'session_id', new.session_id,
          'teacher_id', session_row.teacher_id,
          'absence_count', absence_count,
          'window_days', window_days
        )
      );
    end loop;
  end if;

  return new;
end;
$$;

revoke execute on function private.alert_teacher_absence_threshold()
from public, anon, authenticated, service_role;

create trigger attendance_alert_teacher_absence_threshold
after insert on public.attendance
for each row execute function private.alert_teacher_absence_threshold();

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
    recorded_by,
    locked_at
  )
  values (
    p_session_id,
    p_status,
    p_student_joined_at,
    p_teacher_joined_at,
    p_minutes,
    p_student_notice_at,
    actor_id,
    attendance_deadline
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
      attendance.status as attendance_status
    from public.sessions as session
    left join public.attendance as attendance on attendance.session_id = session.id
    where session.scheduled_at >= instant_start
      and session.scheduled_at < instant_end
      and session.status not in ('cancelled', 'rescheduled')
  ), student_rows as (
    select
      'student'::text as row_type,
      student.id as row_id,
      student.full_name as row_name,
      count(*) filter (where period.attendance_status not in ('teacher_absent', 'cancelled_teacher', 'cancelled_admin')) as row_scheduled,
      count(*) filter (where period.attendance_status in ('present', 'late')) as row_attended,
      count(*) filter (where period.attendance_status in ('student_absent', 'student_excused')) as row_absent
    from period_sessions as period
    join public.students as student on student.id = period.student_id
    group by student.id, student.full_name
  ), teacher_rows as (
    select
      'teacher'::text as row_type,
      teacher.id as row_id,
      profile.full_name as row_name,
      count(*) filter (where period.attendance_status <> 'cancelled_admin' or period.attendance_status is null) as row_scheduled,
      count(*) filter (where period.attendance_status in ('present', 'late', 'student_absent', 'student_excused')) as row_attended,
      count(*) filter (where period.attendance_status in ('teacher_absent', 'cancelled_teacher')) as row_absent
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
