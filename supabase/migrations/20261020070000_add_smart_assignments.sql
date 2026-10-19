create or replace function public.enforce_assignment_gender()
returns trigger language plpgsql set search_path = ''
as $$
declare
  student_gender public.gender_t;
  teacher_gender public.gender_t;
  teacher_capacity integer;
  current_load integer;
begin
  select gender into student_gender from public.students where id = new.student_id;
  select gender, max_students into teacher_gender, teacher_capacity from public.teachers where id = new.teacher_id;
  if student_gender is null or teacher_gender is null then
    raise exception using errcode = '23503', message = 'assignment_party_not_found';
  end if;
  if student_gender is distinct from teacher_gender then
    raise exception using errcode = 'P0001', message = 'gender_mismatch';
  end if;
  if new.status in ('active', 'paused') then
    if not exists (
      select 1 from public.teachers teacher
      join public.teacher_tracks teacher_track on teacher_track.teacher_id = teacher.id
      where teacher.id = new.teacher_id and teacher.status = 'active' and teacher_track.track_id = new.track_id
    ) then
      raise exception using errcode = 'P0001', message = 'teacher_not_eligible';
    end if;
    select count(*)::integer into current_load
    from public.teacher_assignments assignment
    where assignment.teacher_id = new.teacher_id
      and assignment.status in ('active', 'paused')
      and assignment.id is distinct from new.id;
    if current_load >= teacher_capacity then
      raise exception using errcode = 'P0001', message = 'teacher_capacity_reached';
    end if;
  end if;
  return new;
end;
$$;

drop trigger teacher_assignments_enforce_gender on public.teacher_assignments;
create trigger teacher_assignments_enforce_gender
before insert or update of student_id, teacher_id, track_id, status
on public.teacher_assignments for each row execute function public.enforce_assignment_gender();

create or replace function public.suggest_teachers(p_student uuid, p_track uuid)
returns table (
  teacher_id uuid,
  teacher_name text,
  timezone text,
  approved_slots integer,
  current_load integer,
  max_students integer,
  remaining_capacity integer,
  near_capacity boolean
)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'admin_access_required';
  end if;
  return query
  select
    teacher.id,
    profile.full_name,
    profile.timezone,
    count(distinct availability.id)::integer,
    count(distinct assignment.id)::integer,
    teacher.max_students,
    teacher.max_students - count(distinct assignment.id)::integer,
    count(distinct assignment.id)::numeric / teacher.max_students::numeric >= 0.85
  from public.students student
  join public.teachers teacher on teacher.gender = student.gender and teacher.status = 'active'
  join public.profiles profile on profile.id = teacher.profile_id and profile.is_active
  join public.teacher_tracks teacher_track on teacher_track.teacher_id = teacher.id and teacher_track.track_id = p_track
  left join public.teacher_availability availability on availability.teacher_id = teacher.id and availability.status = 'approved'
  left join public.teacher_assignments assignment on assignment.teacher_id = teacher.id and assignment.status in ('active', 'paused')
  where student.id = p_student
    and not exists (
      select 1 from public.teacher_assignments current_assignment
      where current_assignment.student_id = p_student
        and current_assignment.track_id = p_track
        and current_assignment.teacher_id = teacher.id
        and current_assignment.status in ('active', 'paused')
    )
  group by teacher.id, profile.full_name, profile.timezone
  having count(distinct assignment.id) < teacher.max_students
  order by count(distinct availability.id) desc,
    teacher.max_students - count(distinct assignment.id) desc,
    count(distinct assignment.id), profile.full_name;
end;
$$;

create or replace function public.manage_teacher_assignment(
  p_student uuid,
  p_teacher uuid,
  p_track uuid,
  p_reason text,
  p_action text default 'assign'
)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  current_assignment public.teacher_assignments%rowtype;
  managed_id uuid;
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'admin_access_required';
  end if;
  if char_length(btrim(coalesce(p_reason, ''))) < 2 then
    raise exception using errcode = '22023', message = 'assignment_reason_required';
  end if;
  if p_action not in ('assign', 'change', 'pause', 'resume', 'end') then
    raise exception using errcode = '22023', message = 'invalid_assignment_action';
  end if;

  select * into current_assignment
  from public.teacher_assignments
  where student_id = p_student and track_id = p_track and status in ('active', 'paused')
  for update;

  if p_action = 'assign' then
    if current_assignment.id is not null then
      raise exception using errcode = '23505', message = 'current_assignment_exists';
    end if;
    insert into public.teacher_assignments (student_id,teacher_id,track_id,assigned_by,reason)
    values (p_student,p_teacher,p_track,(select auth.uid()),btrim(p_reason)) returning id into managed_id;
  elsif p_action = 'change' then
    if current_assignment.id is null then
      raise exception using errcode = 'P0001', message = 'current_assignment_not_found';
    end if;
    update public.teacher_assignments set status='ended',end_date=current_date,
      reason = reason || E'\n' || '[ended] ' || btrim(p_reason)
    where id=current_assignment.id;
    insert into public.teacher_assignments (student_id,teacher_id,track_id,assigned_by,reason)
    values (p_student,p_teacher,p_track,(select auth.uid()),btrim(p_reason)) returning id into managed_id;
  elsif p_action = 'pause' then
    if current_assignment.id is null or current_assignment.status <> 'active' then
      raise exception using errcode = 'P0001', message = 'active_assignment_not_found';
    end if;
    update public.teacher_assignments set status='paused',reason=btrim(p_reason)
    where id=current_assignment.id returning id into managed_id;
  elsif p_action = 'resume' then
    if current_assignment.id is null or current_assignment.status <> 'paused' then
      raise exception using errcode = 'P0001', message = 'paused_assignment_not_found';
    end if;
    update public.teacher_assignments set status='active',reason=btrim(p_reason)
    where id=current_assignment.id returning id into managed_id;
  else
    if current_assignment.id is null then
      raise exception using errcode = 'P0001', message = 'current_assignment_not_found';
    end if;
    update public.teacher_assignments set status='ended',end_date=current_date,reason=btrim(p_reason)
    where id=current_assignment.id returning id into managed_id;
  end if;
  return managed_id;
end;
$$;

revoke execute on function public.suggest_teachers(uuid,uuid) from public, anon;
revoke execute on function public.manage_teacher_assignment(uuid,uuid,uuid,text,text) from public, anon;
grant execute on function public.suggest_teachers(uuid,uuid) to authenticated;
grant execute on function public.manage_teacher_assignment(uuid,uuid,uuid,text,text) to authenticated;

-- The service role is reserved for trusted server workflows and local test fixture setup.
grant select, insert, update, delete on public.profiles, public.tracks, public.students,
  public.teachers, public.teacher_tracks, public.teacher_availability,
  public.teacher_assignments, public.schedule_slots to service_role;
grant usage, select on sequence public.student_no_seq to service_role;
