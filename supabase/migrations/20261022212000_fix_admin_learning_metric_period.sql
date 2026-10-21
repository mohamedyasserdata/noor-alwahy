-- PL/pgSQL treats the reports.period_start column and the original local variable as
-- ambiguous. Keep the period boundaries explicit so the function compiles on every
-- supported PostgreSQL configuration.
create or replace function public.get_admin_learning_metrics(
  p_from date,
  p_to date,
  p_country text default null,
  p_track uuid default null,
  p_teacher uuid default null,
  p_status text default null,
  p_timezone text default 'Africa/Cairo'
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
set statement_timeout = '5s'
as $$
declare
  range_start_at timestamptz;
  range_end_at timestamptz;
  result jsonb;
begin
  perform private.assert_admin_metric_filters(
    p_from, p_to, p_country, p_track, p_teacher, p_status, p_timezone
  );
  range_start_at := p_from::timestamp at time zone p_timezone;
  range_end_at := (p_to + 1)::timestamp at time zone p_timezone;

  with selected_students as (
    select student.id
    from public.students as student
    left join public.levels as level on level.id = student.level_id
    where (p_country is null or student.country_code = p_country)
      and (p_status is null or student.status::text = p_status)
      and (p_track is null or level.track_id = p_track or exists (
        select 1 from public.teacher_assignments as assignment
        where assignment.student_id = student.id and assignment.track_id = p_track
          and assignment.status in ('active', 'paused')
      ))
      and (p_teacher is null or exists (
        select 1 from public.teacher_assignments as assignment
        where assignment.student_id = student.id and assignment.teacher_id = p_teacher
          and assignment.status in ('active', 'paused')
      ))
  ), selected_evaluations as (
    select fact.* from public.admin_learning_fact as fact
    where fact.created_at >= range_start_at and fact.created_at < range_end_at
      and fact.student_id in (select id from selected_students)
      and (p_track is null or fact.track_id = p_track)
      and (p_teacher is null or fact.teacher_id = p_teacher)
  ), progress_rollup as (
    select count(*) filter (where progress.status = 'mastered')::integer as mastered,
      count(*) filter (where progress.next_review_due <= p_to)::integer as due,
      count(*)::integer as tracked
    from public.memorization_progress as progress
    where progress.student_id in (select id from selected_students)
  ), evaluation_rollup as (
    select count(*) filter (where is_locked)::integer as locked,
      count(*)::integer as total,
      round(avg(total_score) filter (where is_locked), 2) as average
    from selected_evaluations
  ), report_rollup as (
    select count(*) filter (where report.status = 'visible'
      and report.made_visible_at >= range_start_at
      and report.made_visible_at < range_end_at)::integer as visible,
      count(*) filter (where report.status in ('draft', 'admin_review'))::integer as pending,
      count(*)::integer as total
    from public.reports as report
    where report.student_id in (select id from selected_students)
      and (p_teacher is null or report.teacher_id = p_teacher)
  )
  select jsonb_build_object(
    'source', 'learning',
    'generated_at', pg_catalog.clock_timestamp(),
    'refreshed_at', coalesce(
      greatest(
        (select max(refreshed_at) from selected_evaluations),
        (select max(updated_at) from public.memorization_progress where student_id in (select id from selected_students)),
        (select max(updated_at) from public.reports where student_id in (select id from selected_students))
      ),
      pg_catalog.clock_timestamp()
    ),
    'metrics', jsonb_build_object(
      'mastered_pages', jsonb_build_object(
        'value', (select mastered from progress_rollup), 'denominator', (select tracked from progress_rollup),
        'unit', 'pages', 'period', 'snapshot'
      ),
      'due_reviews', jsonb_build_object(
        'value', (select due from progress_rollup), 'denominator', (select tracked from progress_rollup),
        'unit', 'pages', 'period', 'snapshot'
      ),
      'evaluation_average', jsonb_build_object(
        'value', (select average from evaluation_rollup), 'denominator', (select locked from evaluation_rollup),
        'unit', 'score', 'period', 'range'
      ),
      'locked_evaluations', jsonb_build_object(
        'value', (select locked from evaluation_rollup), 'denominator', (select total from evaluation_rollup),
        'unit', 'evaluations', 'period', 'range'
      ),
      'visible_reports', jsonb_build_object(
        'value', (select visible from report_rollup), 'denominator', (select total from report_rollup),
        'unit', 'reports', 'period', 'range'
      ),
      'pending_reports', jsonb_build_object(
        'value', (select pending from report_rollup), 'denominator', (select total from report_rollup),
        'unit', 'reports', 'period', 'snapshot'
      )
    )
  ) into result;
  return result;
end;
$$;

revoke all on function public.get_admin_learning_metrics(date, date, text, uuid, uuid, text, text)
from public, anon;
grant execute on function public.get_admin_learning_metrics(date, date, text, uuid, uuid, text, text)
to authenticated, service_role;
