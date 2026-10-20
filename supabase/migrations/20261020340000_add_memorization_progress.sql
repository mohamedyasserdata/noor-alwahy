create table public.memorization_progress (
  student_id uuid not null references public.students(id) on delete cascade,
  page smallint not null references public.quran_pages(page) on delete restrict,
  status public.progress_status not null default 'not_started',
  first_memorized_at timestamptz,
  last_reviewed_at timestamptz,
  avg_score numeric(5, 2) check (avg_score is null or avg_score between 0 and 100),
  review_count integer not null default 0 check (review_count >= 0),
  review_stage smallint not null default 0 check (review_stage between 0 and 7),
  next_review_due date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (student_id, page)
);

create index memorization_progress_review_due_idx
on public.memorization_progress (student_id, next_review_due)
where status in ('mastered', 'needs_review');

create table private.evaluation_progress_applications (
  evaluation_id uuid primary key references public.session_evaluations(id) on delete restrict,
  applied_at timestamptz not null default now()
);
revoke all on table private.evaluation_progress_applications from public, anon, authenticated, service_role;

create or replace function private.apply_evaluation_to_progress(p_evaluation_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  evaluation_row public.session_evaluations%rowtype;
  student_uuid uuid;
  page_row record;
  is_full_page boolean;
  progress_status public.progress_status;
begin
  select evaluation.* into evaluation_row
  from public.session_evaluations as evaluation
  where evaluation.id = p_evaluation_id
    and evaluation.is_locked
    and evaluation.from_ayah_id is not null
    and evaluation.to_ayah_id is not null;

  if not found or evaluation_row.session_type not in ('new_memo', 'near_review', 'far_review', 'recitation') then
    return;
  end if;

  insert into private.evaluation_progress_applications (evaluation_id)
  values (evaluation_row.id)
  on conflict do nothing;
  if not found then return; end if;

  select session.student_id into strict student_uuid
  from public.sessions as session
  where session.id = evaluation_row.session_id;

  for page_row in
    select page.page, page.first_ayah_id, page.last_ayah_id
    from public.quran_pages as page
    where page.first_ayah_id <= evaluation_row.to_ayah_id
      and page.last_ayah_id >= evaluation_row.from_ayah_id
    order by page.page
  loop
    is_full_page := evaluation_row.from_ayah_id <= page_row.first_ayah_id
      and evaluation_row.to_ayah_id >= page_row.last_ayah_id;

    if evaluation_row.session_type = 'new_memo' then
      progress_status := case
        when not is_full_page then 'in_progress'::public.progress_status
        when evaluation_row.decision = 'passed' and evaluation_row.rating >= 3 then 'mastered'::public.progress_status
        else 'in_progress'::public.progress_status
      end;

      insert into public.memorization_progress (
        student_id, page, status, first_memorized_at, avg_score
      ) values (
        student_uuid,
        page_row.page,
        progress_status,
        case when progress_status = 'mastered' then evaluation_row.locked_at end,
        evaluation_row.total_score
      )
      on conflict (student_id, page) do update set
        status = excluded.status,
        first_memorized_at = coalesce(public.memorization_progress.first_memorized_at, excluded.first_memorized_at),
        avg_score = excluded.avg_score,
        updated_at = pg_catalog.clock_timestamp();
    else
      progress_status := case
        when not is_full_page then 'in_progress'::public.progress_status
        when evaluation_row.rating <= 2 then 'needs_review'::public.progress_status
        else 'mastered'::public.progress_status
      end;

      insert into public.memorization_progress (
        student_id, page, status, last_reviewed_at, avg_score, review_count
      ) values (
        student_uuid, page_row.page, progress_status, evaluation_row.locked_at,
        evaluation_row.total_score, 1
      )
      on conflict (student_id, page) do update set
        status = excluded.status,
        last_reviewed_at = excluded.last_reviewed_at,
        avg_score = round(
          (coalesce(public.memorization_progress.avg_score, 0) * public.memorization_progress.review_count + excluded.avg_score)
          / (public.memorization_progress.review_count + 1),
          2
        ),
        review_count = public.memorization_progress.review_count + 1,
        updated_at = pg_catalog.clock_timestamp();
    end if;
  end loop;
end;
$$;

revoke execute on function private.apply_evaluation_to_progress(uuid) from public, anon, authenticated, service_role;

create or replace function private.apply_locked_evaluation_progress()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.apply_evaluation_to_progress(new.id);
  return new;
end;
$$;
revoke execute on function private.apply_locked_evaluation_progress() from public, anon, authenticated, service_role;

create trigger session_evaluations_apply_progress_insert
after insert on public.session_evaluations
for each row when (new.is_locked)
execute function private.apply_locked_evaluation_progress();

create trigger session_evaluations_apply_progress_lock
after update of is_locked on public.session_evaluations
for each row when (new.is_locked and not old.is_locked)
execute function private.apply_locked_evaluation_progress();

create trigger memorization_progress_set_updated_at
before update on public.memorization_progress
for each row execute function public.set_updated_at();

alter table public.memorization_progress enable row level security;
revoke all on table public.memorization_progress from public, anon, authenticated, service_role;
grant select on table public.memorization_progress to authenticated, service_role;

create policy memorization_progress_admin_read on public.memorization_progress
for select to authenticated using ((select public.is_admin()));
create policy memorization_progress_teacher_read on public.memorization_progress
for select to authenticated using ((select private.teaches_student(student_id)));
create policy memorization_progress_student_read on public.memorization_progress
for select to authenticated using (exists (
  select 1 from public.students as student
  where student.id = memorization_progress.student_id and student.profile_id = (select auth.uid())
));
create policy memorization_progress_parent_read on public.memorization_progress
for select to authenticated using ((select private.guards_student(student_id)));

create view public.v_surah_progress
with (security_invoker = true)
as
select
  progress.student_id,
  mapping.surah_id,
  count(*)::integer as pages_started,
  count(*) filter (where progress.status = 'mastered')::integer as pages_mastered,
  count(*) filter (where progress.status = 'needs_review')::integer as pages_needing_review,
  round(avg(progress.avg_score), 2) as avg_score
from public.memorization_progress as progress
join (
  select distinct ayah.page, ayah.surah_id from public.quran_ayahs as ayah
) as mapping on mapping.page = progress.page
group by progress.student_id, mapping.surah_id;

create view public.v_juz_progress
with (security_invoker = true)
as
select
  progress.student_id,
  mapping.juz,
  count(*)::integer as pages_started,
  count(*) filter (where progress.status = 'mastered')::integer as pages_mastered,
  count(*) filter (where progress.status = 'needs_review')::integer as pages_needing_review,
  round(avg(progress.avg_score), 2) as avg_score
from public.memorization_progress as progress
join (
  select distinct ayah.page, ayah.juz from public.quran_ayahs as ayah
) as mapping on mapping.page = progress.page
group by progress.student_id, mapping.juz;

revoke all on public.v_surah_progress, public.v_juz_progress from public, anon, authenticated, service_role;
grant select on public.v_surah_progress, public.v_juz_progress to authenticated, service_role;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'memorization_progress'
  ) then
    alter publication supabase_realtime add table public.memorization_progress;
  end if;
end;
$$;

select private.apply_evaluation_to_progress(evaluation.id)
from public.session_evaluations as evaluation
where evaluation.is_locked;
