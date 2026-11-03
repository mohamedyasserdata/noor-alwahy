create or replace function private.validate_session_participant()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  session_row public.sessions%rowtype;
  assignment_row public.teacher_assignments%rowtype;
  student_gender public.gender_t;
  teacher_gender public.gender_t;
begin
  select session.* into session_row
  from public.sessions as session
  where session.id = new.session_id;

  if session_row.id is null then
    raise exception using errcode = '23503', message = 'participant_session_not_found';
  end if;

  if new.is_primary and new.student_id is distinct from session_row.student_id then
    raise exception using errcode = '23514', message = 'participant_primary_mismatch';
  end if;
  if new.is_primary and new.assignment_id is distinct from session_row.assignment_id then
    raise exception using errcode = '23514', message = 'participant_primary_assignment_mismatch';
  end if;

  if new.assignment_id is not null then
    select assignment.* into assignment_row
    from public.teacher_assignments as assignment
    where assignment.id = new.assignment_id;

    if assignment_row.id is null
      or assignment_row.student_id is distinct from new.student_id
      or assignment_row.status not in ('active', 'paused')
      or (
        not new.is_primary
        and assignment_row.teacher_id is distinct from session_row.teacher_id
        and assignment_row.teacher_id is distinct from session_row.original_teacher_id
      ) then
      raise exception using errcode = '23514', message = 'participant_assignment_invalid';
    end if;
  elsif not new.is_primary then
    raise exception using errcode = '23514', message = 'participant_assignment_required';
  end if;

  select student.gender into student_gender
  from public.students as student
  where student.id = new.student_id;
  select teacher.gender into teacher_gender
  from public.teachers as teacher
  where teacher.id = session_row.teacher_id;

  if student_gender is null or teacher_gender is null then
    raise exception using errcode = '23503', message = 'participant_party_not_found';
  end if;
  if student_gender is distinct from teacher_gender then
    raise exception using errcode = 'P0001', message = 'gender_mismatch';
  end if;

  return new;
end;
$$;

revoke execute on function private.validate_session_participant()
from public, anon, authenticated, service_role;
