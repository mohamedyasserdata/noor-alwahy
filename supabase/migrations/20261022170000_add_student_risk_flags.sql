create view public.admin_student_risk_signals
with (security_invoker = true, security_barrier = true)
as
with attendance_window as (
  select
    session.student_id,
    count(*) filter (
      where attendance.status not in ('teacher_absent', 'cancelled_teacher', 'cancelled_admin')
    )::integer as eligible_sessions,
    count(*) filter (
      where attendance.status = 'student_absent'
    )::integer as absent_sessions,
    max(session.scheduled_at) filter (
      where attendance.status in ('present', 'late')
    ) as last_attended_at
  from public.sessions as session
  join public.attendance as attendance on attendance.session_id = session.id
  where session.scheduled_at >= pg_catalog.now() - interval '30 days'
    and session.scheduled_at <= pg_catalog.now()
  group by session.student_id
), evaluation_window as (
  select
    session.student_id,
    round(avg(evaluation.total_score), 2) as evaluation_average
  from public.sessions as session
  join public.session_evaluations as evaluation
    on evaluation.session_id = session.id
   and evaluation.is_locked
  where evaluation.locked_at >= pg_catalog.now() - interval '60 days'
  group by session.student_id
), overdue_reviews as (
  select progress.student_id, count(*)::integer as overdue_review_pages
  from public.memorization_progress as progress
  where progress.status in ('mastered', 'needs_review')
    and progress.next_review_due < current_date
  group by progress.student_id
), latest_report as (
  select report.student_id, max(report.period_end) as last_report_period_end
  from public.reports as report
  where report.status = 'visible'
  group by report.student_id
), current_subscription as (
  select distinct on (subscription.student_id)
    subscription.student_id,
    subscription.status,
    subscription.current_period_end
  from public.subscriptions as subscription
  order by
    subscription.student_id,
    (subscription.status in ('active', 'trial', 'paused')) desc,
    subscription.current_period_end desc,
    subscription.created_at desc
)
select
  student.id as student_id,
  student.student_no,
  student.full_name,
  student.country_code,
  student.level_id,
  level.name_ar as level_name_ar,
  level.name_en as level_name_en,
  coalesce(attendance.eligible_sessions, 0) as eligible_sessions,
  coalesce(attendance.absent_sessions, 0) as absent_sessions,
  case
    when coalesce(attendance.eligible_sessions, 0) = 0 then null
    else round(attendance.absent_sessions::numeric / attendance.eligible_sessions * 100, 2)
  end as absence_rate,
  attendance.last_attended_at,
  case
    when attendance.last_attended_at is null then null
    else (current_date - attendance.last_attended_at::date)::integer
  end as inactive_days,
  evaluation.evaluation_average,
  coalesce(review.overdue_review_pages, 0) as overdue_review_pages,
  report.last_report_period_end,
  subscription.status as subscription_status,
  subscription.current_period_end as subscription_period_end
from public.students as student
left join public.levels as level on level.id = student.level_id
left join attendance_window as attendance on attendance.student_id = student.id
left join evaluation_window as evaluation on evaluation.student_id = student.id
left join overdue_reviews as review on review.student_id = student.id
left join latest_report as report on report.student_id = student.id
left join current_subscription as subscription on subscription.student_id = student.id
where student.status = 'active';

revoke all on public.admin_student_risk_signals from public, anon, authenticated;
grant select on public.admin_student_risk_signals to service_role;

create or replace function public.get_admin_student_risk_flags(
  p_country text default null,
  p_limit integer default 100
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'admin_mfa_required';
  end if;

  if p_country is not null and p_country !~ '^[A-Z]{2}$' then
    raise exception using errcode = '22023', message = 'risk_country_invalid';
  end if;

  if p_limit is null or p_limit < 1 or p_limit > 200 then
    raise exception using errcode = '22023', message = 'risk_limit_invalid';
  end if;

  with scored as (
    select
      signal.*,
      (
        case
          when signal.absent_sessions >= 3 or signal.absence_rate >= 40 then 40
          when signal.absent_sessions >= 2 or signal.absence_rate >= 25 then 25
          else 0
        end
        + case
            when signal.inactive_days >= 30 then 30
            when signal.inactive_days >= 21 then 20
            else 0
          end
        + case
            when signal.overdue_review_pages >= 10 then 20
            when signal.overdue_review_pages >= 5 then 10
            else 0
          end
        + case
            when signal.evaluation_average < 50 then 20
            when signal.evaluation_average < 65 then 10
            else 0
          end
        + case
            when signal.subscription_status in ('expired', 'cancelled')
              or signal.subscription_period_end < current_date then 20
            else 0
          end
        + case
            when signal.last_report_period_end is null
              or signal.last_report_period_end < current_date - 45 then 10
            else 0
          end
      )::integer as risk_score
    from public.admin_student_risk_signals as signal
    where p_country is null or signal.country_code = p_country
  ), flagged as (
    select
      scored.*,
      case
        when scored.risk_score >= 60 then 'high'
        when scored.risk_score >= 35 then 'medium'
        else 'low'
      end as risk_level,
      (
        select coalesce(jsonb_agg(reason.value order by reason.priority), '[]'::jsonb)
        from (
          values
            (1, case when scored.absent_sessions >= 3 or scored.absence_rate >= 40 then 'attendance_critical'
                     when scored.absent_sessions >= 2 or scored.absence_rate >= 25 then 'attendance_warning' end),
            (2, case when scored.inactive_days >= 30 then 'inactive_30_days'
                     when scored.inactive_days >= 21 then 'inactive_21_days' end),
            (3, case when scored.overdue_review_pages >= 10 then 'reviews_critical'
                     when scored.overdue_review_pages >= 5 then 'reviews_warning' end),
            (4, case when scored.evaluation_average < 50 then 'evaluation_critical'
                     when scored.evaluation_average < 65 then 'evaluation_warning' end),
            (5, case when scored.subscription_status in ('expired', 'cancelled')
                       or scored.subscription_period_end < current_date then 'subscription_inactive' end),
            (6, case when scored.last_report_period_end is null
                       or scored.last_report_period_end < current_date - 45 then 'report_overdue' end)
        ) as reason(priority, value)
        where reason.value is not null
      ) as reasons
    from scored
    where scored.risk_score >= 25
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'student_id', row.student_id,
        'student_no', row.student_no,
        'full_name', row.full_name,
        'country', row.country_code,
        'level_name_ar', coalesce(row.level_name_ar, 'غير محدد'),
        'level_name_en', coalesce(row.level_name_en, 'Unassigned'),
        'risk_score', row.risk_score,
        'risk_level', row.risk_level,
        'reasons', row.reasons,
        'eligible_sessions', row.eligible_sessions,
        'absent_sessions', row.absent_sessions,
        'absence_rate', row.absence_rate,
        'inactive_days', row.inactive_days,
        'evaluation_average', row.evaluation_average,
        'overdue_review_pages', row.overdue_review_pages,
        'subscription_status', row.subscription_status,
        'subscription_period_end', row.subscription_period_end,
        'last_report_period_end', row.last_report_period_end
      )
      order by row.risk_score desc, row.full_name, row.student_id
    ),
    '[]'::jsonb
  )
  into result
  from (
    select *
    from flagged
    order by risk_score desc, full_name, student_id
    limit p_limit
  ) as row;

  return result;
end;
$$;

revoke execute on function public.get_admin_student_risk_flags(text, integer) from public, anon;
grant execute on function public.get_admin_student_risk_flags(text, integer) to authenticated, service_role;
