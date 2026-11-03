create or replace function private.teacher_owns_session(p_session_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(exists (
    select 1
    from public.sessions as session
    where session.id = p_session_id
      and session.teacher_id = (select private.current_teacher_id())
  ), false)
$$;

create or replace function private.student_participates_in_session(p_session_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(exists (
    select 1
    from public.session_participants as participant
    join public.students as student on student.id = participant.student_id
    join public.profiles as profile on profile.id = student.profile_id
    where participant.session_id = p_session_id
      and student.profile_id = (select auth.uid())
      and profile.is_active
  ), false)
$$;

create or replace function private.guardian_has_session_participant(p_session_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(exists (
    select 1
    from public.session_participants as participant
    where participant.session_id = p_session_id
      and (select private.guards_student(participant.student_id))
  ), false)
$$;

revoke execute on function private.teacher_owns_session(uuid) from public, anon;
revoke execute on function private.student_participates_in_session(uuid) from public, anon;
revoke execute on function private.guardian_has_session_participant(uuid) from public, anon;
grant execute on function private.teacher_owns_session(uuid) to authenticated, service_role;
grant execute on function private.student_participates_in_session(uuid) to authenticated, service_role;
grant execute on function private.guardian_has_session_participant(uuid) to authenticated, service_role;

drop policy session_participants_teacher_read on public.session_participants;
create policy session_participants_teacher_read
on public.session_participants
for select to authenticated
using ((select private.teacher_owns_session(session_id)));

drop policy sessions_student_read on public.sessions;
create policy sessions_student_read
on public.sessions
for select to authenticated
using ((select private.student_participates_in_session(id)));

drop policy sessions_parent_read on public.sessions;
create policy sessions_parent_read
on public.sessions
for select to authenticated
using ((select private.guardian_has_session_participant(id)));
