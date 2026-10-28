drop policy if exists session_evaluations_student_read on public.session_evaluations;
create policy session_evaluations_student_read on public.session_evaluations
for select to authenticated
using (
  is_locked
  and exists (
    select 1 from public.sessions as session
    join public.students as student on student.id = session.student_id
    where session.id = session_evaluations.session_id
      and student.profile_id = (select auth.uid())
  )
);

drop policy if exists session_evaluations_parent_read on public.session_evaluations;
create policy session_evaluations_parent_read on public.session_evaluations
for select to authenticated
using (
  is_locked
  and exists (
    select 1 from public.sessions as session
    where session.id = session_evaluations.session_id
      and (select private.guards_student(session.student_id))
  )
);
