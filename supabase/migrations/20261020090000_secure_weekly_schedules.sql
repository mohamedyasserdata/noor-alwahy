create or replace function public.validate_schedule_slot()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = new.anchor_timezone) then
    raise exception using errcode = '22023', message = 'invalid_anchor_timezone';
  end if;
  if not exists (
    select 1 from public.teacher_assignments assignment
    where assignment.id = new.assignment_id and assignment.status = 'active'
  ) then
    raise exception using errcode = 'P0001', message = 'active_assignment_required';
  end if;
  return new;
end;
$$;

create trigger schedule_slots_validate
before insert or update of assignment_id, anchor_timezone
on public.schedule_slots for each row execute function public.validate_schedule_slot();

create policy schedule_slots_student_read on public.schedule_slots for select to authenticated using (
  exists (
    select 1 from public.teacher_assignments assignment
    join public.students student on student.id = assignment.student_id
    where assignment.id = schedule_slots.assignment_id and student.profile_id = (select auth.uid())
  )
);
create policy schedule_slots_parent_read on public.schedule_slots for select to authenticated using (
  exists (
    select 1 from public.teacher_assignments assignment
    where assignment.id = schedule_slots.assignment_id
      and (select private.guards_student(assignment.student_id))
  )
);

create or replace function public.get_visible_schedule()
returns table (
  slot_id uuid,
  assignment_id uuid,
  student_name text,
  teacher_name text,
  track_name_ar text,
  track_name_en text,
  weekday smallint,
  local_start_time time,
  duration_min integer,
  anchor_timezone text,
  is_active boolean
)
language sql stable security definer set search_path = ''
as $$
  select slot.id, assignment.id, student.full_name, profile.full_name,
    track.name_ar, track.name_en, slot.weekday, slot.local_start_time,
    slot.duration_min, slot.anchor_timezone, slot.is_active
  from public.schedule_slots slot
  join public.teacher_assignments assignment on assignment.id = slot.assignment_id
  join public.students student on student.id = assignment.student_id
  join public.teachers teacher on teacher.id = assignment.teacher_id
  join public.profiles profile on profile.id = teacher.profile_id
  join public.tracks track on track.id = assignment.track_id
  where slot.is_active and assignment.status = 'active'
    and (
      (select public.is_admin())
      or assignment.teacher_id = (select private.current_teacher_id())
      or student.profile_id = (select auth.uid())
      or (select private.guards_student(student.id))
    )
  order by slot.weekday, slot.local_start_time
$$;

revoke execute on function public.get_visible_schedule() from public, anon;
grant execute on function public.get_visible_schedule() to authenticated;
grant select, insert, update, delete on public.guardians, public.student_guardians to service_role;
