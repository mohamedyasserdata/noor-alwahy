create or replace function public.enforce_application_transition()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if old.status = new.status then return new; end if;
  if not (
    (old.status = 'new' and new.status in ('contacted','rejected','postponed'))
    or (old.status = 'contacted' and new.status in ('trial_booked','accepted','rejected','postponed'))
    or (old.status = 'trial_booked' and new.status in ('accepted','rejected','postponed'))
    or (old.status = 'postponed' and new.status in ('contacted','rejected'))
  ) then raise exception using errcode = 'P0001', message = 'invalid_application_transition'; end if;
  return new;
end;
$$;
revoke execute on function public.enforce_application_transition() from public, anon, authenticated, service_role;
create trigger applications_enforce_transition before update of status on public.applications
for each row execute function public.enforce_application_transition();

create table public.placement_tests (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete restrict,
  evaluator_id uuid not null references public.profiles(id) on delete restrict,
  recitation_score smallint check (recitation_score between 0 and 100),
  tajweed_score smallint check (tajweed_score between 0 and 100),
  memorization_score smallint check (memorization_score between 0 and 100),
  recommended_track_id uuid references public.tracks(id) on delete restrict,
  recommended_package_id uuid references public.packages(id) on delete restrict,
  notes text check (notes is null or char_length(notes) <= 3000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index placement_tests_application_idx on public.placement_tests(application_id, created_at desc);
create trigger placement_tests_set_updated_at before update on public.placement_tests
for each row execute function public.set_updated_at();
create trigger placement_tests_audit after insert or update on public.placement_tests
for each row execute function public.audit_row();

alter table public.placement_tests enable row level security;
revoke all on public.placement_tests from public, anon, authenticated, service_role;
grant select, insert, update on public.placement_tests to authenticated;
create policy placement_tests_admin_all on public.placement_tests for all to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()) and evaluator_id = (select auth.uid()));
create policy placement_tests_teacher_read on public.placement_tests for select to authenticated
using ((select public.auth_role()) = 'teacher' and evaluator_id = (select auth.uid()));
create policy placement_tests_teacher_create on public.placement_tests for insert to authenticated
with check ((select public.auth_role()) = 'teacher' and evaluator_id = (select auth.uid()));

create or replace function public.convert_application_to_student(p_application uuid)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  managed_application public.applications%rowtype;
  new_student_id uuid;
begin
  if not public.is_admin() then raise exception using errcode = '42501', message = 'admin_mfa_required'; end if;
  select * into managed_application from public.applications where id = p_application for update;
  if managed_application.id is null then raise exception using errcode = 'P0002', message = 'application_not_found'; end if;
  if managed_application.converted_student_id is not null then return managed_application.converted_student_id; end if;
  if managed_application.status <> 'accepted' then raise exception using errcode = 'P0001', message = 'application_not_accepted'; end if;

  insert into public.students(full_name, gender, status, joined_at, country_code, timezone)
  values (managed_application.student_name, managed_application.student_gender, 'active', current_date, managed_application.country_code, managed_application.timezone)
  returning id into new_student_id;
  insert into public.student_private_notes(student_id, special_notes, share_with_teacher)
  values (new_student_id, nullif(managed_application.notes, ''), false);
  update public.applications set converted_student_id = new_student_id where id = managed_application.id;
  return new_student_id;
end;
$$;
revoke execute on function public.convert_application_to_student(uuid) from public, anon;
grant execute on function public.convert_application_to_student(uuid) to authenticated;
