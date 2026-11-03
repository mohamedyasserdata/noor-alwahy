create table public.teacher_attendance (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null unique references public.sessions(id) on delete restrict,
  teacher_id uuid not null references public.teachers(id) on delete restrict,
  status text not null check (status in ('present', 'late', 'absent', 'excused')),
  minutes integer check (minutes is null or minutes between 0 and 240),
  note text check (note is null or char_length(btrim(note)) between 2 and 1000),
  recorded_by uuid not null references public.profiles(id) on delete restrict,
  recorded_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index teacher_attendance_teacher_recorded_idx
on public.teacher_attendance (teacher_id, recorded_at desc);

create index teacher_attendance_status_recorded_idx
on public.teacher_attendance (status, recorded_at desc);

create trigger teacher_attendance_set_updated_at
before update on public.teacher_attendance
for each row execute function public.set_updated_at();

create trigger teacher_attendance_audit
after insert or update on public.teacher_attendance
for each row execute function public.audit_row();

alter table public.teacher_attendance enable row level security;

revoke all on public.teacher_attendance from public, anon, authenticated;
grant select on public.teacher_attendance to authenticated;
grant select, insert, update, delete on public.teacher_attendance to service_role;

create policy teacher_attendance_admin_read
on public.teacher_attendance
for select to authenticated
using ((select public.is_admin()));

create policy teacher_attendance_teacher_read
on public.teacher_attendance
for select to authenticated
using (teacher_id = (select private.current_teacher_id()));

create or replace function public.record_teacher_attendance(
  p_session_id uuid,
  p_status text,
  p_minutes integer default null,
  p_note text default null
)
returns public.teacher_attendance
language plpgsql
security definer
set search_path = ''
as $$
declare
  session_row public.sessions%rowtype;
  saved_row public.teacher_attendance%rowtype;
  normalized_note text := nullif(pg_catalog.btrim(p_note), '');
begin
  if (select auth.uid()) is null or not (select public.is_admin()) then
    raise exception using errcode = '42501', message = 'teacher_attendance_admin_required';
  end if;

  if p_status is null or p_status not in ('present', 'late', 'absent', 'excused') then
    raise exception using errcode = '22023', message = 'teacher_attendance_status_invalid';
  end if;

  if p_minutes is not null and (p_minutes < 0 or p_minutes > 240) then
    raise exception using errcode = '22023', message = 'teacher_attendance_minutes_invalid';
  end if;

  if normalized_note is not null and char_length(normalized_note) not between 2 and 1000 then
    raise exception using errcode = '22023', message = 'teacher_attendance_note_invalid';
  end if;

  select session.* into session_row
  from public.sessions as session
  where session.id = p_session_id
  for update;

  if session_row.id is null then
    raise exception using errcode = 'P0002', message = 'teacher_attendance_session_not_found';
  end if;

  if session_row.ends_at > statement_timestamp() then
    raise exception using errcode = 'P0001', message = 'teacher_attendance_session_not_ended';
  end if;

  insert into public.teacher_attendance (
    session_id,
    teacher_id,
    status,
    minutes,
    note,
    recorded_by,
    recorded_at
  )
  values (
    session_row.id,
    session_row.teacher_id,
    p_status,
    p_minutes,
    normalized_note,
    (select auth.uid()),
    statement_timestamp()
  )
  on conflict (session_id) do update
  set teacher_id = excluded.teacher_id,
      status = excluded.status,
      minutes = excluded.minutes,
      note = excluded.note,
      recorded_by = excluded.recorded_by,
      recorded_at = excluded.recorded_at
  returning * into saved_row;

  return saved_row;
end;
$$;

revoke execute on function public.record_teacher_attendance(uuid, text, integer, text)
from public, anon, service_role;
grant execute on function public.record_teacher_attendance(uuid, text, integer, text)
to authenticated;
