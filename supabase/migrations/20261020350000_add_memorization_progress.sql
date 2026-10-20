create table public.memorization_progress (
  student_id uuid not null references public.students(id) on delete cascade,
  page smallint not null references public.quran_pages(page) on delete restrict,
  status public.progress_status not null default 'not_started',
  first_memorized_at timestamptz,
  last_reviewed_at timestamptz,
  avg_score numeric(5, 2) check (avg_score is null or avg_score between 0 and 100),
  review_count integer not null default 0 check (review_count >= 0),
  review_stage smallint not null default 0 check (review_stage between 0 and 6),
  next_review_due date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (student_id, page),
  constraint memorization_progress_review_average_consistent check (
    (review_count = 0 and avg_score is null)
    or (review_count > 0 and avg_score is not null)
  )
);

create index memorization_progress_student_due_idx
on public.memorization_progress (student_id, next_review_due);
create index memorization_progress_student_status_idx
on public.memorization_progress (student_id, status);
create index memorization_progress_page_idx
on public.memorization_progress (page);

create table private.evaluation_progress_applications (
  evaluation_id uuid not null references public.session_evaluations(id) on delete cascade,
  page smallint not null references public.quran_pages(page) on delete restrict,
  applied_at timestamptz not null default now(),
  primary key (evaluation_id, page)
);

create index evaluation_progress_applications_page_idx
on private.evaluation_progress_applications (page);

revoke all on table private.evaluation_progress_applications from public, anon, authenticated, service_role;

create or replace function public.apply_evaluation_to_progress()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  progress_student_id uuid;
  page_row record;
  application_inserted integer;
  is_review boolean;
  is_full_page boolean;
  next_status public.progress_status;
  applied_at timestamptz;
begin
  if not new.is_locked
    or new.from_ayah_id is null
    or new.to_ayah_id is null
    or new.session_type not in ('new_memo', 'near_review', 'far_review', 'recitation') then
    return new;
  end if;

  select session.student_id
  into strict progress_student_id
  from public.sessions as session
  where session.id = new.session_id;

  is_review := new.session_type in ('near_review', 'far_review', 'recitation');
  applied_at := coalesce(new.locked_at, pg_catalog.clock_timestamp());

  for page_row in
    select page.page, page.first_ayah_id, page.last_ayah_id
    from public.quran_pages as page
    where page.first_ayah_id <= new.to_ayah_id
      and page.last_ayah_id >= new.from_ayah_id
    order by page.page
  loop
    insert into private.evaluation_progress_applications (evaluation_id, page)
    values (new.id, page_row.page)
    on conflict do nothing;
    get diagnostics application_inserted = row_count;

    if application_inserted = 0 then
      continue;
    end if;

    is_full_page := page_row.first_ayah_id >= new.from_ayah_id
      and page_row.last_ayah_id <= new.to_ayah_id;

    if new.session_type = 'new_memo' then
      next_status := case
        when is_full_page and new.decision = 'passed' and new.rating >= 3 then 'mastered'::public.progress_status
        else 'in_progress'::public.progress_status
      end;

      insert into public.memorization_progress (
        student_id,
        page,
        status,
        first_memorized_at
      )
      values (
        progress_student_id,
        page_row.page,
        next_status,
        case when next_status = 'mastered' then applied_at else null end
      )
      on conflict (student_id, page) do update
      set status = excluded.status,
          first_memorized_at = case
            when excluded.status = 'mastered' then coalesce(public.memorization_progress.first_memorized_at, excluded.first_memorized_at)
            else public.memorization_progress.first_memorized_at
          end;
    elsif is_review then
      next_status := case
        when not is_full_page then 'in_progress'::public.progress_status
        when new.rating <= 2 then 'needs_review'::public.progress_status
        else 'mastered'::public.progress_status
      end;

      insert into public.memorization_progress (
        student_id,
        page,
        status,
        last_reviewed_at,
        avg_score,
        review_count
      )
      values (
        progress_student_id,
        page_row.page,
        next_status,
        applied_at,
        new.total_score,
        1
      )
      on conflict (student_id, page) do update
      set status = excluded.status,
          last_reviewed_at = excluded.last_reviewed_at,
          avg_score = round(
            (
              coalesce(public.memorization_progress.avg_score, 0)
              * public.memorization_progress.review_count
              + excluded.avg_score
            ) / (public.memorization_progress.review_count + 1),
            2
          ),
          review_count = public.memorization_progress.review_count + 1;
    end if;
  end loop;

  return new;
end;
$$;

revoke execute on function public.apply_evaluation_to_progress() from public, anon, authenticated, service_role;

create trigger session_evaluations_apply_progress
after insert or update on public.session_evaluations
for each row
when (new.is_locked)
execute function public.apply_evaluation_to_progress();

create trigger memorization_progress_set_updated_at
before update on public.memorization_progress
for each row execute function public.set_updated_at();

create trigger memorization_progress_audit
after insert or update or delete on public.memorization_progress
for each row execute function public.audit_row();

alter table public.memorization_progress enable row level security;
alter table public.memorization_progress replica identity full;

revoke all on table public.memorization_progress from public, anon, authenticated, service_role;
grant select on table public.memorization_progress to authenticated, service_role;

create policy memorization_progress_admin_read on public.memorization_progress
for select to authenticated
using ((select public.is_admin()));

create policy memorization_progress_teacher_read on public.memorization_progress
for select to authenticated
using ((select private.teaches_student(student_id)));

create policy memorization_progress_student_read on public.memorization_progress
for select to authenticated
using (exists (
  select 1
  from public.students as student
  where student.id = memorization_progress.student_id
    and student.profile_id = (select auth.uid())
));

create policy memorization_progress_parent_read on public.memorization_progress
for select to authenticated
using ((select private.guards_student(student_id)));

create view public.v_surah_progress
with (security_invoker = true)
as
with page_surahs as (
  select distinct ayah.page, ayah.surah_id
  from public.quran_ayahs as ayah
)
select
  progress.student_id,
  page_surahs.surah_id,
  count(*)::integer as tracked_pages,
  count(*) filter (where progress.status = 'in_progress')::integer as in_progress_pages,
  count(*) filter (where progress.status = 'mastered')::integer as mastered_pages,
  count(*) filter (where progress.status = 'needs_review')::integer as needs_review_pages,
  round(avg(progress.avg_score), 2) as avg_score,
  max(progress.last_reviewed_at) as last_reviewed_at
from public.memorization_progress as progress
join page_surahs on page_surahs.page = progress.page
group by progress.student_id, page_surahs.surah_id;

create view public.v_juz_progress
with (security_invoker = true)
as
with page_juz as (
  select distinct ayah.page, ayah.juz
  from public.quran_ayahs as ayah
)
select
  progress.student_id,
  page_juz.juz,
  count(*)::integer as tracked_pages,
  count(*) filter (where progress.status = 'in_progress')::integer as in_progress_pages,
  count(*) filter (where progress.status = 'mastered')::integer as mastered_pages,
  count(*) filter (where progress.status = 'needs_review')::integer as needs_review_pages,
  round(avg(progress.avg_score), 2) as avg_score,
  max(progress.last_reviewed_at) as last_reviewed_at
from public.memorization_progress as progress
join page_juz on page_juz.page = progress.page
group by progress.student_id, page_juz.juz;

revoke all on table public.v_surah_progress, public.v_juz_progress from public, anon, authenticated, service_role;
grant select on table public.v_surah_progress, public.v_juz_progress to authenticated, service_role;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'memorization_progress'
  ) then
    alter publication supabase_realtime add table public.memorization_progress;
  end if;
end;
$$;
