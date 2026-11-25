create table public.student_quran_baselines (
  student_id uuid primary key references public.students(id) on delete cascade,
  prior_memorized_from_page smallint references public.quran_pages(page),
  prior_memorized_to_page smallint references public.quran_pages(page),
  academy_start_page smallint references public.quran_pages(page),
  study_direction text not null default 'ascending'
    check (study_direction in ('ascending', 'descending')),
  assessment_notes text,
  assessed_on date not null default current_date,
  created_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  updated_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint student_quran_baselines_prior_range_complete check (
    (prior_memorized_from_page is null and prior_memorized_to_page is null)
    or
    (prior_memorized_from_page is not null and prior_memorized_to_page is not null)
  ),
  constraint student_quran_baselines_prior_range_order check (
    prior_memorized_from_page is null
    or prior_memorized_from_page <= prior_memorized_to_page
  ),
  constraint student_quran_baselines_notes_length check (
    assessment_notes is null or char_length(assessment_notes) <= 1200
  )
);

create trigger student_quran_baselines_set_updated_at
before update on public.student_quran_baselines
for each row execute function public.set_updated_at();

create trigger student_quran_baselines_audit
after insert or update or delete on public.student_quran_baselines
for each row execute function public.audit_row();

alter table public.student_quran_baselines enable row level security;

revoke all on table public.student_quran_baselines from public, anon, authenticated, service_role;
grant select, insert, update on table public.student_quran_baselines to authenticated;
grant select on table public.student_quran_baselines to service_role;

create policy student_quran_baselines_admin_all
on public.student_quran_baselines for all to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

create policy student_quran_baselines_teacher_read
on public.student_quran_baselines for select to authenticated
using ((select private.teaches_student(student_id)));

create policy student_quran_baselines_teacher_insert
on public.student_quran_baselines for insert to authenticated
with check (
  (select private.teaches_student(student_id))
  and created_by = (select auth.uid())
  and updated_by = (select auth.uid())
);

create policy student_quran_baselines_teacher_update
on public.student_quran_baselines for update to authenticated
using ((select private.teaches_student(student_id)))
with check (
  (select private.teaches_student(student_id))
  and updated_by = (select auth.uid())
);
