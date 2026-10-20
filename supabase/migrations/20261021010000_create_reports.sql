create table public.reports (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete restrict,
  teacher_id uuid not null references public.teachers(id) on delete restrict,
  period_type text not null check (period_type in ('weekly', 'monthly')),
  period_start date not null,
  period_end date not null,
  body jsonb not null,
  status public.report_status not null default 'draft',
  approved_at timestamptz,
  made_visible_at timestamptz,
  content_template_version_id uuid,
  pdf_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reports_period_valid check (
    period_end >= period_start
    and period_end - period_start between 0 and 31
  ),
  constraint reports_body_valid check (
    jsonb_typeof(body) = 'object'
    and jsonb_typeof(body -> 'metrics') = 'object'
    and jsonb_typeof(body -> 'summary') = 'string'
    and jsonb_typeof(body -> 'strengths') = 'string'
    and jsonb_typeof(body -> 'improve') = 'string'
    and jsonb_typeof(body -> 'plan') = 'string'
    and jsonb_typeof(body -> 'recommendation') = 'string'
  ),
  unique (student_id, teacher_id, period_type, period_start)
);

create index reports_teacher_status_period_idx on public.reports (teacher_id, status, period_start desc);
create index reports_student_visible_idx on public.reports (student_id, period_start desc) where status = 'visible';

create or replace function private.calculate_report_metrics(
  p_student_id uuid,
  p_period_start date,
  p_period_end date
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with report_sessions as (
    select session.id
    from public.sessions as session
    join public.students as student on student.id = session.student_id
    where session.student_id = p_student_id
      and (session.scheduled_at at time zone student.timezone)::date between p_period_start and p_period_end
  ), attendance_metrics as (
    select
      count(attendance.session_id)::integer as total,
      count(attendance.session_id) filter (where attendance.status = 'present')::integer as present
    from report_sessions
    left join public.attendance as attendance on attendance.session_id = report_sessions.id
  ), evaluation_metrics as (
    select
      round(avg(evaluation.total_score), 2) as evaluation_average,
      coalesce(
        jsonb_object_agg(criterion.key, criterion.average order by criterion.key)
          filter (where criterion.key is not null),
        '{}'::jsonb
      ) as criteria_average
    from (
      select score.key, round(avg((score.value #>> '{}')::numeric), 2) as average
      from report_sessions
      join public.session_evaluations as evaluation
        on evaluation.session_id = report_sessions.id and evaluation.is_locked
      cross join lateral jsonb_each(evaluation.scores) as score
      group by score.key
    ) as criterion
    cross join lateral (
      select avg(evaluation.total_score) as total_score
      from report_sessions
      join public.session_evaluations as evaluation
        on evaluation.session_id = report_sessions.id and evaluation.is_locked
    ) as evaluation
  ), progress_metrics as (
    select count(*)::integer as mastered_pages
    from public.memorization_progress as progress
    join public.students as student on student.id = progress.student_id
    where progress.student_id = p_student_id
      and progress.status = 'mastered'
      and progress.first_memorized_at is not null
      and (progress.first_memorized_at at time zone student.timezone)::date between p_period_start and p_period_end
  )
  select jsonb_build_object(
    'mastered_pages', progress.mastered_pages,
    'attendance', jsonb_build_object(
      'total', attendance.total,
      'present', attendance.present,
      'rate', case when attendance.total = 0 then null
        else round(attendance.present * 100.0 / attendance.total, 2) end
    ),
    'evaluation_average', evaluation.evaluation_average,
    'criteria_average', evaluation.criteria_average
  )
  from attendance_metrics as attendance
  cross join evaluation_metrics as evaluation
  cross join progress_metrics as progress
$$;

revoke execute on function private.calculate_report_metrics(uuid, date, date) from public, anon, authenticated, service_role;

create or replace function private.prepare_report()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_role public.user_role;
  allowed_transition boolean := false;
begin
  actor_role := (select public.auth_role());

  if tg_op = 'INSERT' then
    if new.status <> 'draft' then
      raise exception using errcode = 'P0001', message = 'report_must_start_draft';
    end if;
    if actor_role = 'teacher' and (
      new.teacher_id is distinct from (select private.current_teacher_id())
      or not (select private.teaches_student(new.student_id))
    ) then
      raise exception using errcode = '42501', message = 'report_forbidden';
    end if;
  else
    if new.student_id is distinct from old.student_id
      or new.teacher_id is distinct from old.teacher_id
      or new.period_type is distinct from old.period_type
      or new.period_start is distinct from old.period_start
      or new.period_end is distinct from old.period_end then
      raise exception using errcode = 'P0001', message = 'report_identity_immutable';
    end if;

    if new.body is distinct from old.body and old.status <> 'draft' then
      raise exception using errcode = 'P0001', message = 'report_content_locked';
    end if;

    if new.status is distinct from old.status then
      allowed_transition := case
        when actor_role = 'teacher' then old.status = 'draft' and new.status = 'approved'
        when actor_role = 'admin' then
          (old.status = 'draft' and new.status = 'approved')
          or (old.status = 'approved' and new.status in ('admin_review', 'visible'))
          or (old.status = 'admin_review' and new.status = 'visible')
          or (old.status = 'visible' and new.status = 'draft')
        else false
      end;
      if not allowed_transition then
        raise exception using errcode = 'P0001', message = 'report_transition_forbidden';
      end if;
    end if;
  end if;

  new.body := jsonb_set(
    new.body,
    '{metrics}',
    private.calculate_report_metrics(new.student_id, new.period_start, new.period_end),
    true
  );
  new.approved_at := case
    when new.status in ('approved', 'admin_review', 'visible') then coalesce(old.approved_at, pg_catalog.clock_timestamp())
    else null
  end;
  new.made_visible_at := case
    when new.status = 'visible' then coalesce(old.made_visible_at, pg_catalog.clock_timestamp())
    else null
  end;
  return new;
end;
$$;

revoke execute on function private.prepare_report() from public, anon, authenticated, service_role;

create trigger reports_prepare
before insert or update on public.reports
for each row execute function private.prepare_report();
create trigger reports_set_updated_at
before update on public.reports
for each row execute function public.set_updated_at();
create trigger reports_audit
after insert or update or delete on public.reports
for each row execute function public.audit_row();

alter table public.reports enable row level security;
revoke all on table public.reports from public, anon, authenticated, service_role;
grant select, insert, update, delete on table public.reports to authenticated;
grant select on table public.reports to service_role;

create policy reports_admin_all on public.reports
for all to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

create policy reports_teacher_select on public.reports
for select to authenticated
using (teacher_id = (select private.current_teacher_id()));
create policy reports_teacher_insert on public.reports
for insert to authenticated
with check (
  status = 'draft'
  and teacher_id = (select private.current_teacher_id())
  and (select private.teaches_student(student_id))
);
create policy reports_teacher_update on public.reports
for update to authenticated
using (
  status <> 'visible'
  and teacher_id = (select private.current_teacher_id())
  and (select private.teaches_student(student_id))
)
with check (
  status <> 'visible'
  and teacher_id = (select private.current_teacher_id())
  and (select private.teaches_student(student_id))
);

create policy reports_student_visible on public.reports
for select to authenticated
using (
  status = 'visible'
  and exists (
    select 1 from public.students as student
    where student.id = reports.student_id and student.profile_id = (select auth.uid())
  )
);
create policy reports_parent_visible on public.reports
for select to authenticated
using (status = 'visible' and (select private.guards_student(student_id)));
