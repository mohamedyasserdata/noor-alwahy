create table public.teacher_assignments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete restrict,
  teacher_id uuid not null references public.teachers(id) on delete restrict,
  track_id uuid not null references public.tracks(id) on delete restrict,
  status public.assignment_status not null default 'active',
  start_date date not null default current_date,
  end_date date,
  assigned_by uuid not null references public.profiles(id) on delete restrict,
  reason text not null check (char_length(btrim(reason)) between 2 and 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date is null or end_date >= start_date)
);

create unique index teacher_assignments_one_current_idx
on public.teacher_assignments (student_id, track_id)
where status in ('active', 'paused');
create index teacher_assignments_teacher_status_idx on public.teacher_assignments (teacher_id, status);
create index teacher_assignments_student_history_idx on public.teacher_assignments (student_id, created_at desc);

create table public.schedule_slots (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.teacher_assignments(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  local_start_time time not null,
  duration_min integer not null check (duration_min between 10 and 120),
  anchor_timezone text not null check (char_length(btrim(anchor_timezone)) between 1 and 100),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (assignment_id, weekday, local_start_time)
);

create index schedule_slots_assignment_active_idx on public.schedule_slots (assignment_id, is_active, weekday);
create trigger teacher_assignments_set_updated_at before update on public.teacher_assignments for each row execute function public.set_updated_at();
create trigger schedule_slots_set_updated_at before update on public.schedule_slots for each row execute function public.set_updated_at();
create trigger teacher_assignments_audit after insert or update or delete on public.teacher_assignments for each row execute function public.audit_row();
create trigger schedule_slots_audit after insert or update or delete on public.schedule_slots for each row execute function public.audit_row();

create or replace function public.enforce_assignment_gender()
returns trigger language plpgsql set search_path = ''
as $$
declare
  student_gender public.gender_t;
  teacher_gender public.gender_t;
begin
  select gender into student_gender from public.students where id = new.student_id;
  select gender into teacher_gender from public.teachers where id = new.teacher_id;
  if student_gender is null or teacher_gender is null then
    raise exception using errcode = '23503', message = 'assignment_party_not_found';
  end if;
  if student_gender is distinct from teacher_gender then
    raise exception using errcode = 'P0001', message = 'gender_mismatch';
  end if;
  if not exists (
    select 1 from public.teachers teacher
    join public.teacher_tracks teacher_track on teacher_track.teacher_id = teacher.id
    where teacher.id = new.teacher_id and teacher.status = 'active' and teacher_track.track_id = new.track_id
  ) then
    raise exception using errcode = 'P0001', message = 'teacher_not_eligible';
  end if;
  return new;
end;
$$;

create trigger teacher_assignments_enforce_gender
before insert or update of student_id, teacher_id, track_id
on public.teacher_assignments for each row execute function public.enforce_assignment_gender();

create or replace function public.block_student_gender_change()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if new.gender is distinct from old.gender and exists (
    select 1 from public.teacher_assignments assignment
    where assignment.student_id = old.id and assignment.status in ('active', 'paused')
  ) then
    raise exception using errcode = 'P0001', message = 'gender_change_blocked_active_assignment';
  end if;
  return new;
end;
$$;

create or replace function public.block_teacher_gender_change()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if new.gender is distinct from old.gender and exists (
    select 1 from public.teacher_assignments assignment
    where assignment.teacher_id = old.id and assignment.status in ('active', 'paused')
  ) then
    raise exception using errcode = 'P0001', message = 'gender_change_blocked_active_assignment';
  end if;
  return new;
end;
$$;

create trigger students_block_assigned_gender_change before update of gender on public.students for each row execute function public.block_student_gender_change();
create trigger teachers_block_assigned_gender_change before update of gender on public.teachers for each row execute function public.block_teacher_gender_change();

revoke execute on function public.enforce_assignment_gender() from public, anon, authenticated, service_role;
revoke execute on function public.block_student_gender_change() from public, anon, authenticated, service_role;
revoke execute on function public.block_teacher_gender_change() from public, anon, authenticated, service_role;

create or replace function private.teaches_student(p_student uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select coalesce(exists (
    select 1 from public.teacher_assignments assignment
    where assignment.student_id = p_student
      and assignment.teacher_id = (select private.current_teacher_id())
      and assignment.status in ('active', 'paused')
  ), false)
$$;
revoke execute on function private.teaches_student(uuid) from public, anon;
grant execute on function private.teaches_student(uuid) to authenticated, service_role;

create or replace function public.get_shared_student_notes(p_student uuid)
returns table (student_id uuid, health_notes text, special_notes text)
language plpgsql security definer set search_path = ''
as $$
begin
  if not (select private.teaches_student(p_student)) then
    raise exception using errcode = '42501', message = 'assigned_teacher_required';
  end if;
  insert into public.audit_logs (user_id, action, table_name, record_id, ip)
  values ((select auth.uid()), 'ACCESS_SHARED', 'student_private_notes', p_student::text, inet_client_addr());
  return query
  select notes.student_id, notes.health_notes, notes.special_notes
  from public.student_private_notes notes
  where notes.student_id = p_student and notes.share_with_teacher;
end;
$$;
revoke execute on function public.get_shared_student_notes(uuid) from public, anon;
grant execute on function public.get_shared_student_notes(uuid) to authenticated;

alter table public.teacher_assignments enable row level security;
alter table public.schedule_slots enable row level security;
revoke all on public.teacher_assignments, public.schedule_slots from public, anon, authenticated;
grant select, insert, update, delete on public.teacher_assignments, public.schedule_slots to authenticated;

create policy teacher_assignments_admin_all on public.teacher_assignments for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy teacher_assignments_teacher_read on public.teacher_assignments for select to authenticated using (teacher_id = (select private.current_teacher_id()));
create policy schedule_slots_admin_all on public.schedule_slots for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy schedule_slots_teacher_read on public.schedule_slots for select to authenticated using (
  exists (select 1 from public.teacher_assignments assignment where assignment.id = schedule_slots.assignment_id and assignment.teacher_id = (select private.current_teacher_id()))
);
create policy students_assigned_teacher_read on public.students for select to authenticated using ((select private.teaches_student(id)));
