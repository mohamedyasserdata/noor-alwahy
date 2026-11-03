create table public.teacher_student_notes (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  teacher_id uuid not null references public.teachers(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 2 and 2000),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index teacher_student_notes_scope_idx
on public.teacher_student_notes (teacher_id, student_id, created_at desc);

create trigger teacher_student_notes_set_updated_at
before update on public.teacher_student_notes
for each row execute function public.set_updated_at();

create trigger teacher_student_notes_audit
after insert or update or delete on public.teacher_student_notes
for each row execute function public.audit_row();

alter table public.teacher_student_notes enable row level security;
revoke all on public.teacher_student_notes from public, anon, authenticated;
grant select, insert, update, delete on public.teacher_student_notes to authenticated;
grant select, insert, update, delete on public.teacher_student_notes to service_role;

create policy teacher_student_notes_admin_all
on public.teacher_student_notes
for all to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

create policy teacher_student_notes_teacher_read
on public.teacher_student_notes
for select to authenticated
using (
  teacher_id = (select private.current_teacher_id())
  and (select private.teaches_student(student_id))
);

create policy teacher_student_notes_teacher_insert
on public.teacher_student_notes
for insert to authenticated
with check (
  teacher_id = (select private.current_teacher_id())
  and created_by = (select auth.uid())
  and (select private.teaches_student(student_id))
);

create policy teacher_student_notes_teacher_update
on public.teacher_student_notes
for update to authenticated
using (
  teacher_id = (select private.current_teacher_id())
  and created_by = (select auth.uid())
  and (select private.teaches_student(student_id))
)
with check (
  teacher_id = (select private.current_teacher_id())
  and created_by = (select auth.uid())
  and (select private.teaches_student(student_id))
);

create policy teacher_student_notes_teacher_delete
on public.teacher_student_notes
for delete to authenticated
using (
  teacher_id = (select private.current_teacher_id())
  and created_by = (select auth.uid())
  and (select private.teaches_student(student_id))
);
