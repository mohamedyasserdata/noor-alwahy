create table public.memorization_plans (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null unique references public.students(id) on delete cascade,
  weekly_target_pages smallint not null check (weekly_target_pages between 1 and 604),
  monthly_target_pages smallint not null check (monthly_target_pages between 1 and 604),
  starts_on date not null default current_date,
  ends_on date,
  created_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  updated_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint memorization_plans_monthly_target_check check (monthly_target_pages >= weekly_target_pages),
  constraint memorization_plans_date_range_check check (ends_on is null or ends_on >= starts_on)
);

create index memorization_plans_validity_idx
on public.memorization_plans (starts_on, ends_on);

create trigger memorization_plans_set_updated_at
before update on public.memorization_plans
for each row execute function public.set_updated_at();

create trigger memorization_plans_audit
after insert or update or delete on public.memorization_plans
for each row execute function public.audit_row();

alter table public.memorization_plans enable row level security;
alter table public.memorization_plans replica identity full;

revoke all on table public.memorization_plans from public, anon, authenticated, service_role;
grant select, insert, update, delete on table public.memorization_plans to authenticated;
grant select on table public.memorization_plans to service_role;

create policy memorization_plans_admin_all on public.memorization_plans
for all to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

create policy memorization_plans_teacher_read on public.memorization_plans
for select to authenticated
using ((select private.teaches_student(student_id)));

create policy memorization_plans_teacher_insert on public.memorization_plans
for insert to authenticated
with check (
  (select private.teaches_student(student_id))
  and created_by = (select auth.uid())
  and updated_by = (select auth.uid())
);

create policy memorization_plans_teacher_update on public.memorization_plans
for update to authenticated
using ((select private.teaches_student(student_id)))
with check (
  (select private.teaches_student(student_id))
  and updated_by = (select auth.uid())
);

create policy memorization_plans_student_read on public.memorization_plans
for select to authenticated
using (exists (
  select 1
  from public.students as student
  where student.id = memorization_plans.student_id
    and student.profile_id = (select auth.uid())
));

create policy memorization_plans_parent_read on public.memorization_plans
for select to authenticated
using ((select private.guards_student(student_id)));

create view public.v_memorization_plan_adherence
with (security_invoker = true)
as
select
  plan.id as plan_id,
  plan.student_id,
  plan.weekly_target_pages,
  plan.monthly_target_pages,
  plan.starts_on,
  plan.ends_on,
  local_period.local_today,
  date_trunc('week', local_period.local_today)::date as week_starts_on,
  date_trunc('month', local_period.local_today)::date as month_starts_on,
  achievement.weekly_achieved_pages,
  achievement.monthly_achieved_pages,
  round(least(100::numeric, achievement.weekly_achieved_pages * 100::numeric / plan.weekly_target_pages), 2) as weekly_adherence_percent,
  round(least(100::numeric, achievement.monthly_achieved_pages * 100::numeric / plan.monthly_target_pages), 2) as monthly_adherence_percent,
  plan.updated_at
from public.memorization_plans as plan
join public.students as student on student.id = plan.student_id
cross join lateral (
  select (now() at time zone student.timezone)::date as local_today
) as local_period
cross join lateral (
  select
    count(*) filter (
      where (progress.first_memorized_at at time zone student.timezone)::date
        >= date_trunc('week', local_period.local_today)::date
    )::integer as weekly_achieved_pages,
    count(*) filter (
      where (progress.first_memorized_at at time zone student.timezone)::date
        >= date_trunc('month', local_period.local_today)::date
    )::integer as monthly_achieved_pages
  from public.memorization_progress as progress
  where progress.student_id = plan.student_id
    and progress.status = 'mastered'
    and progress.first_memorized_at is not null
    and (progress.first_memorized_at at time zone student.timezone)::date <= local_period.local_today
) as achievement
where plan.starts_on <= local_period.local_today
  and (plan.ends_on is null or plan.ends_on >= local_period.local_today);

revoke all on table public.v_memorization_plan_adherence from public, anon, authenticated, service_role;
grant select on table public.v_memorization_plan_adherence to authenticated, service_role;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'memorization_plans'
  ) then
    alter publication supabase_realtime add table public.memorization_plans;
  end if;
end;
$$;
