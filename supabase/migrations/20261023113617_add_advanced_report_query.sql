create or replace function public.get_admin_advanced_report(
  p_report_type text,
  p_from date,
  p_to date,
  p_country text default null,
  p_track uuid default null,
  p_teacher uuid default null,
  p_status text default null,
  p_sort text default null,
  p_direction text default 'asc',
  p_page integer default 1,
  p_page_size integer default 50,
  p_locale text default 'ar',
  p_timezone text default 'Africa/Cairo'
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
set statement_timeout = '15s'
as $$
declare
  allowed_sort text[];
  effective_sort text;
  rows_data jsonb := '[]'::jsonb;
  currency_totals jsonb := '[]'::jsonb;
  total_rows integer := 0;
  offset_rows integer;
  range_start timestamptz;
  range_end timestamptz;
begin
  if not public.is_admin() and (select auth.role()) <> 'service_role' then
    raise exception using errcode = '42501', message = 'admin_mfa_required';
  end if;
  if p_report_type not in ('students', 'sessions', 'finance', 'interventions')
    or p_from is null or p_to is null or p_from > p_to or p_to - p_from > 366
    or p_direction not in ('asc', 'desc')
    or p_page not between 1 and 100000
    or p_page_size not between 1 and 200
    or p_locale not in ('ar', 'en')
    or not exists (select 1 from pg_catalog.pg_timezone_names where name = p_timezone)
    or (p_country is not null and p_country !~ '^[A-Z]{2}$')
    or (p_status is not null and char_length(p_status) not between 2 and 40) then
    raise exception using errcode = '22023', message = 'advanced_report_input_invalid';
  end if;

  allowed_sort := case p_report_type
    when 'students' then array['student_no', 'full_name', 'country', 'status']
    when 'sessions' then array['scheduled_at', 'student', 'teacher', 'status']
    when 'finance' then array['invoice_no', 'student', 'currency', 'status', 'due_date', 'created_at']
    when 'interventions' then array['rule_type', 'subject_type', 'status', 'first_detected_at', 'last_detected_at']
  end;
  effective_sort := coalesce(p_sort, allowed_sort[1]);
  if effective_sort <> all(allowed_sort) then
    raise exception using errcode = '22023', message = 'advanced_report_sort_invalid';
  end if;

  offset_rows := (p_page - 1) * p_page_size;
  range_start := p_from::timestamp at time zone p_timezone;
  range_end := (p_to + 1)::timestamp at time zone p_timezone;

  if p_report_type = 'students' then
    with filtered as (
      select student.id,
        jsonb_build_object(
          'student_no', student.student_no,
          'full_name', student.full_name,
          'country', student.country_code,
          'status', student.status,
          'track', current_assignment.track_name,
          'teacher', current_assignment.teacher_name,
          'subscription_status', current_subscription.status,
          'sessions', coalesce(activity.sessions, 0),
          'attendance_rate', activity.attendance_rate,
          'evaluation_average', activity.evaluation_average
        ) as row_data,
        case effective_sort
          when 'student_no' then student.student_no
          when 'full_name' then student.full_name
          when 'country' then coalesce(student.country_code, '')
          when 'status' then student.status::text
        end as sort_value
      from public.students as student
      left join lateral (
        select assignment.teacher_id, assignment.track_id,
          teacher_profile.full_name as teacher_name,
          case when p_locale = 'ar' or track.name_en is null then track.name_ar else track.name_en end as track_name
        from public.teacher_assignments as assignment
        join public.teachers as teacher on teacher.id = assignment.teacher_id
        join public.profiles as teacher_profile on teacher_profile.id = teacher.profile_id
        join public.tracks as track on track.id = assignment.track_id
        where assignment.student_id = student.id
          and assignment.status in ('active', 'paused')
        order by (assignment.status = 'active') desc, assignment.created_at desc, assignment.id
        limit 1
      ) as current_assignment on true
      left join lateral (
        select subscription.status::text
        from public.subscriptions as subscription
        where subscription.student_id = student.id
        order by (subscription.status in ('trial', 'active', 'paused')) desc,
          subscription.current_period_end desc, subscription.id
        limit 1
      ) as current_subscription on true
      left join lateral (
        select count(distinct session.id)::integer as sessions,
          round(
            100.0 * count(attendance.session_id) filter (
              where attendance.status in ('present', 'late')
            ) / nullif(count(attendance.session_id) filter (
              where attendance.status not in (
                'cancelled_admin', 'cancelled_teacher', 'teacher_absent'
              )
            ), 0),
            2
          ) as attendance_rate,
          round(avg(evaluation.total_score) filter (where evaluation.is_locked), 2) as evaluation_average
        from public.sessions as session
        left join public.attendance as attendance on attendance.session_id = session.id
        left join public.session_evaluations as evaluation on evaluation.session_id = session.id
        where session.student_id = student.id
          and session.scheduled_at >= range_start and session.scheduled_at < range_end
      ) as activity on true
      where (p_country is null or student.country_code = p_country)
        and (p_track is null or current_assignment.track_id = p_track)
        and (p_teacher is null or current_assignment.teacher_id = p_teacher)
        and (p_status is null or student.status::text = p_status)
    ), numbered as (
      select row_data,
        row_number() over (
          order by
            case when p_direction = 'asc' then sort_value end asc nulls last,
            case when p_direction = 'desc' then sort_value end desc nulls last,
            id
        ) as row_order
      from filtered
    )
    select count(*)::integer,
      coalesce(jsonb_agg(row_data order by row_order)
        filter (where row_order > offset_rows and row_order <= offset_rows + p_page_size), '[]'::jsonb)
    into total_rows, rows_data
    from numbered;

  elsif p_report_type = 'sessions' then
    with filtered as (
      select session.id,
        jsonb_build_object(
          'scheduled_at', session.scheduled_at,
          'student', student.full_name,
          'teacher', teacher_profile.full_name,
          'status', session.status,
          'attendance_status', attendance.status,
          'duration_min', session.duration_min,
          'track', case when p_locale = 'ar' or track.name_en is null then track.name_ar else track.name_en end,
          'country', student.country_code
        ) as row_data,
        case effective_sort
          when 'scheduled_at' then session.scheduled_at::text
          when 'student' then student.full_name
          when 'teacher' then teacher_profile.full_name
          when 'status' then session.status::text
        end as sort_value
      from public.sessions as session
      join public.students as student on student.id = session.student_id
      join public.teachers as teacher on teacher.id = session.teacher_id
      join public.profiles as teacher_profile on teacher_profile.id = teacher.profile_id
      left join public.teacher_assignments as assignment on assignment.id = session.assignment_id
      left join public.tracks as track on track.id = assignment.track_id
      left join public.attendance as attendance on attendance.session_id = session.id
      where session.scheduled_at >= range_start and session.scheduled_at < range_end
        and (p_country is null or student.country_code = p_country)
        and (p_track is null or assignment.track_id = p_track)
        and (p_teacher is null or session.teacher_id = p_teacher)
        and (p_status is null or session.status::text = p_status)
    ), numbered as (
      select row_data,
        row_number() over (
          order by
            case when p_direction = 'asc' then sort_value end asc nulls last,
            case when p_direction = 'desc' then sort_value end desc nulls last,
            id
        ) as row_order
      from filtered
    )
    select count(*)::integer,
      coalesce(jsonb_agg(row_data order by row_order)
        filter (where row_order > offset_rows and row_order <= offset_rows + p_page_size), '[]'::jsonb)
    into total_rows, rows_data
    from numbered;

  elsif p_report_type = 'finance' then
    with invoice_payments as (
      select payment.invoice_id,
        coalesce(sum(case when payment.kind = 'payment' then payment.amount else -payment.amount end)
          filter (where payment.status = 'confirmed'), 0)::numeric(12,2) as paid
      from public.payments as payment
      group by payment.invoice_id
    ), filtered as (
      select invoice.id, invoice.currency,
        jsonb_build_object(
          'invoice_no', invoice.invoice_no,
          'student', student.full_name,
          'country', student.country_code,
          'currency', invoice.currency,
          'total', invoice.total,
          'paid', coalesce(invoice_payments.paid, 0),
          'outstanding', greatest(invoice.total - coalesce(invoice_payments.paid, 0), 0),
          'status', invoice.status,
          'due_date', invoice.due_date,
          'created_at', invoice.created_at
        ) as row_data,
        case effective_sort
          when 'invoice_no' then invoice.invoice_no
          when 'student' then student.full_name
          when 'currency' then invoice.currency
          when 'status' then invoice.status::text
          when 'due_date' then coalesce(invoice.due_date::text, '')
          when 'created_at' then invoice.created_at::text
        end as sort_value
      from public.invoices as invoice
      join public.students as student on student.id = invoice.student_id
      left join invoice_payments on invoice_payments.invoice_id = invoice.id
      left join lateral (
        select assignment.track_id, assignment.teacher_id
        from public.teacher_assignments as assignment
        where assignment.student_id = student.id and assignment.status in ('active', 'paused')
        order by (assignment.status = 'active') desc, assignment.created_at desc, assignment.id
        limit 1
      ) as current_assignment on true
      where invoice.created_at >= range_start and invoice.created_at < range_end
        and (p_country is null or student.country_code = p_country)
        and (p_track is null or current_assignment.track_id = p_track)
        and (p_teacher is null or current_assignment.teacher_id = p_teacher)
        and (p_status is null or invoice.status::text = p_status)
    ), numbered as (
      select row_data,
        row_number() over (
          order by
            case when p_direction = 'asc' then sort_value end asc nulls last,
            case when p_direction = 'desc' then sort_value end desc nulls last,
            id
        ) as row_order
      from filtered
    )
    select count(*)::integer,
      coalesce(jsonb_agg(row_data order by row_order)
        filter (where row_order > offset_rows and row_order <= offset_rows + p_page_size), '[]'::jsonb),
      coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'currency', currency,
            'total', currency_total,
            'paid', currency_paid,
            'outstanding', currency_outstanding
          ) order by currency
        )
        from (
          select currency,
            sum((row_data ->> 'total')::numeric) as currency_total,
            sum((row_data ->> 'paid')::numeric) as currency_paid,
            sum((row_data ->> 'outstanding')::numeric) as currency_outstanding
          from filtered
          group by currency
        ) as by_currency
      ), '[]'::jsonb)
    into total_rows, rows_data, currency_totals
    from numbered;

  else
    with filtered as (
      select intervention_case.id,
        jsonb_build_object(
          'rule_type', intervention_rule.rule_type,
          'subject_type', intervention_case.subject_type,
          'subject_id', intervention_case.subject_id,
          'priority', intervention_case.priority,
          'status', intervention_case.status,
          'reason_code', intervention_case.reason_code,
          'recommended_action', intervention_case.recommended_action,
          'first_detected_at', intervention_case.first_detected_at,
          'last_detected_at', intervention_case.last_detected_at,
          'detection_count', intervention_case.detection_count
        ) as row_data,
        case effective_sort
          when 'rule_type' then intervention_rule.rule_type
          when 'subject_type' then intervention_case.subject_type
          when 'status' then intervention_case.status
          when 'first_detected_at' then intervention_case.first_detected_at::text
          when 'last_detected_at' then intervention_case.last_detected_at::text
        end as sort_value
      from public.intervention_cases as intervention_case
      join public.intervention_rules as intervention_rule on intervention_rule.id = intervention_case.rule_id
      where intervention_case.first_detected_at >= range_start
        and intervention_case.first_detected_at < range_end
        and (p_status is null or intervention_case.status = p_status)
    ), numbered as (
      select row_data,
        row_number() over (
          order by
            case when p_direction = 'asc' then sort_value end asc nulls last,
            case when p_direction = 'desc' then sort_value end desc nulls last,
            id
        ) as row_order
      from filtered
    )
    select count(*)::integer,
      coalesce(jsonb_agg(row_data order by row_order)
        filter (where row_order > offset_rows and row_order <= offset_rows + p_page_size), '[]'::jsonb)
    into total_rows, rows_data
    from numbered;
  end if;

  return jsonb_build_object(
    'report_type', p_report_type,
    'page', p_page,
    'page_size', p_page_size,
    'total', total_rows,
    'rows', rows_data,
    'currency_totals', currency_totals,
    'filters', jsonb_strip_nulls(jsonb_build_object(
      'from', p_from,
      'to', p_to,
      'country', p_country,
      'track', p_track,
      'teacher', p_teacher,
      'status', p_status,
      'sort', effective_sort,
      'direction', p_direction,
      'timezone', p_timezone
    )),
    'refreshed_at', pg_catalog.clock_timestamp()
  );
end;
$$;

revoke all on function public.get_admin_advanced_report(
  text, date, date, text, uuid, uuid, text, text, text, integer, integer, text, text
) from public, anon, authenticated, service_role;
grant execute on function public.get_admin_advanced_report(
  text, date, date, text, uuid, uuid, text, text, text, integer, integer, text, text
) to authenticated, service_role;

comment on function public.get_admin_advanced_report(
  text, date, date, text, uuid, uuid, text, text, text, integer, integer, text, text
) is 'AAL2-only, paginated P10 report rows with server-side filters and deterministic whitelisted sorting.';

create or replace function public.retry_admin_export(p_job uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
set statement_timeout = '5s'
as $$
declare
  retried_id uuid;
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'admin_mfa_required';
  end if;
  update public.export_jobs
  set status = 'queued', attempts = 0, next_attempt_at = pg_catalog.now(),
    started_at = null, finished_at = null, error_code = null
  where id = p_job and requested_by = (select auth.uid()) and status = 'failed'
  returning id into retried_id;
  if retried_id is null then
    raise exception using errcode = 'P0002', message = 'export_job_not_retryable';
  end if;
  return retried_id;
end;
$$;

revoke all on function public.retry_admin_export(uuid)
from public, anon, authenticated, service_role;
grant execute on function public.retry_admin_export(uuid) to authenticated;

create or replace function public.claim_admin_export_job(p_job uuid)
returns public.export_jobs
language plpgsql
security definer
set search_path = ''
set statement_timeout = '5s'
as $$
declare
  claimed public.export_jobs%rowtype;
begin
  if (select auth.role()) <> 'service_role' then
    raise exception using errcode = '42501', message = 'export_worker_forbidden';
  end if;
  update public.export_jobs
  set status = 'processing', attempts = attempts + 1,
    started_at = pg_catalog.clock_timestamp()
  where id = p_job and status = 'queued' and attempts < 3
    and next_attempt_at <= pg_catalog.now()
  returning * into claimed;
  return claimed;
end;
$$;

revoke all on function public.claim_admin_export_job(uuid)
from public, anon, authenticated, service_role;
grant execute on function public.claim_admin_export_job(uuid) to service_role;
