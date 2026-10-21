-- P10-T01: one bounded, auditable metrics layer for the administration control centre.
-- The views are deliberately private to service_role; administrators consume only the
-- security-definer RPCs, which require the same AAL2 gate as the rest of the admin portal.

create index if not exists students_admin_metrics_idx
on public.students (country_code, status, level_id, id);

create index if not exists sessions_admin_metrics_idx
on public.sessions (scheduled_at, teacher_id, student_id, status);

create index if not exists session_evaluations_admin_metrics_idx
on public.session_evaluations (created_at, is_locked, session_id);

create index if not exists memorization_progress_admin_metrics_idx
on public.memorization_progress (status, next_review_due, student_id);

create index if not exists teacher_payouts_admin_metrics_idx
on public.teacher_payouts (period_start, period_end, currency, status, teacher_id);

create or replace view public.admin_operations_fact
with (security_invoker = true, security_barrier = true)
as
select
  session.id as session_id,
  session.student_id,
  session.teacher_id,
  coalesce(assignment.track_id, level.track_id) as track_id,
  student.country_code,
  student.status as student_status,
  session.scheduled_at,
  session.status as session_status,
  attendance.status as attendance_status,
  attendance.recorded_at as attendance_recorded_at,
  greatest(session.updated_at, coalesce(attendance.updated_at, session.updated_at)) as refreshed_at
from public.sessions as session
join public.students as student on student.id = session.student_id
left join public.levels as level on level.id = student.level_id
left join public.teacher_assignments as assignment on assignment.id = session.assignment_id
left join public.attendance as attendance on attendance.session_id = session.id;

create or replace view public.admin_learning_fact
with (security_invoker = true, security_barrier = true)
as
select
  evaluation.id as evaluation_id,
  session.student_id,
  session.teacher_id,
  coalesce(assignment.track_id, level.track_id) as track_id,
  student.country_code,
  student.status as student_status,
  evaluation.session_type,
  evaluation.pages,
  evaluation.total_score,
  evaluation.rating,
  evaluation.is_locked,
  evaluation.created_at,
  evaluation.updated_at as refreshed_at
from public.session_evaluations as evaluation
join public.sessions as session on session.id = evaluation.session_id
join public.students as student on student.id = session.student_id
left join public.levels as level on level.id = student.level_id
left join public.teacher_assignments as assignment on assignment.id = session.assignment_id;

create or replace view public.admin_finance_fact
with (security_invoker = true, security_barrier = true)
as
select
  'invoice'::text as entry_kind,
  invoice.id as entry_id,
  invoice.student_id,
  null::uuid as teacher_id,
  coalesce(assignment.track_id, level.track_id) as track_id,
  student.country_code,
  student.status as student_status,
  invoice.currency::text as currency,
  invoice.total as amount,
  invoice.status::text as status,
  invoice.created_at as occurred_at,
  invoice.updated_at as refreshed_at
from public.invoices as invoice
join public.students as student on student.id = invoice.student_id
left join public.levels as level on level.id = student.level_id
left join lateral (
  select current_assignment.track_id
  from public.teacher_assignments as current_assignment
  where current_assignment.student_id = student.id
    and current_assignment.status in ('active', 'paused')
  order by current_assignment.updated_at desc
  limit 1
) as assignment on true
union all
select
  'payment'::text,
  payment.id,
  invoice.student_id,
  null::uuid,
  coalesce(assignment.track_id, level.track_id),
  student.country_code,
  student.status,
  payment.currency::text,
  case when payment.kind = 'refund' then -payment.amount else payment.amount end,
  payment.status::text,
  coalesce(payment.confirmed_at, payment.created_at),
  coalesce(payment.confirmed_at, payment.created_at)
from public.payments as payment
join public.invoices as invoice on invoice.id = payment.invoice_id
join public.students as student on student.id = invoice.student_id
left join public.levels as level on level.id = student.level_id
left join lateral (
  select current_assignment.track_id
  from public.teacher_assignments as current_assignment
  where current_assignment.student_id = student.id
    and current_assignment.status in ('active', 'paused')
  order by current_assignment.updated_at desc
  limit 1
) as assignment on true
union all
select
  'payout'::text,
  payout.id,
  null::uuid,
  payout.teacher_id,
  teacher_track.track_id,
  null::char(2),
  null::public.student_status,
  payout.currency::text,
  payout.net,
  payout.status::text,
  coalesce(payout.paid_at, payout.approved_at, payout.created_at),
  payout.updated_at
from public.teacher_payouts as payout
left join lateral (
  select track.track_id
  from public.teacher_tracks as track
  where track.teacher_id = payout.teacher_id
  order by track.created_at
  limit 1
) as teacher_track on true;

revoke all on public.admin_operations_fact, public.admin_learning_fact, public.admin_finance_fact
from public, anon, authenticated;
grant select on public.admin_operations_fact, public.admin_learning_fact, public.admin_finance_fact
to service_role;

create or replace function private.assert_admin_metric_filters(
  p_from date,
  p_to date,
  p_country text,
  p_track uuid,
  p_teacher uuid,
  p_status text,
  p_timezone text
)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'admin_mfa_required';
  end if;
  if p_from is null or p_to is null or p_from > p_to or p_to - p_from > 730 then
    raise exception using errcode = '22023', message = 'admin_metrics_period_invalid';
  end if;
  if p_country is not null and p_country !~ '^[A-Z]{2}$' then
    raise exception using errcode = '22023', message = 'admin_metrics_country_invalid';
  end if;
  if p_status is not null and p_status not in ('active', 'dropped', 'graduated', 'suspended', 'archived') then
    raise exception using errcode = '22023', message = 'admin_metrics_status_invalid';
  end if;
  if p_timezone is null or not exists (
    select 1 from pg_catalog.pg_timezone_names where name = p_timezone
  ) then
    raise exception using errcode = '22023', message = 'admin_metrics_timezone_invalid';
  end if;
  if p_track is not null and not exists (select 1 from public.tracks where id = p_track) then
    raise exception using errcode = '22023', message = 'admin_metrics_track_invalid';
  end if;
  if p_teacher is not null and not exists (select 1 from public.teachers where id = p_teacher) then
    raise exception using errcode = '22023', message = 'admin_metrics_teacher_invalid';
  end if;
end;
$$;

revoke all on function private.assert_admin_metric_filters(date, date, text, uuid, uuid, text, text)
from public, anon, authenticated, service_role;

create or replace function public.get_admin_operations_metrics(
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
  period_start timestamptz;
  period_end timestamptz;
  result jsonb;
begin
  perform private.assert_admin_metric_filters(
    p_from, p_to, p_country, p_track, p_teacher, p_status, p_timezone
  );
  period_start := p_from::timestamp at time zone p_timezone;
  period_end := (p_to + 1)::timestamp at time zone p_timezone;

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
  ), selected_sessions as (
    select fact.*
    from public.admin_operations_fact as fact
    where fact.scheduled_at >= period_start and fact.scheduled_at < period_end
      and fact.student_id in (select id from selected_students)
      and (p_track is null or fact.track_id = p_track)
      and (p_teacher is null or fact.teacher_id = p_teacher)
  ), attendance_rollup as (
    select
      count(*) filter (where attendance_status is not null
        and attendance_status not in ('cancelled_teacher', 'cancelled_admin', 'teacher_absent'))::integer as eligible,
      count(*) filter (where attendance_status in ('present', 'late'))::integer as attended
    from selected_sessions
  ), session_rollup as (
    select count(*)::integer as total,
      count(*) filter (where session_status = 'held')::integer as held,
      count(*) filter (where session_status = 'missed')::integer as missed,
      count(*) filter (where session_status = 'cancelled')::integer as cancelled
    from selected_sessions
  ), subscription_rollup as (
    select count(*) filter (where subscription.status = 'active')::integer as active,
      count(*)::integer as total
    from public.subscriptions as subscription
    where subscription.student_id in (select id from selected_students)
  )
  select jsonb_build_object(
    'source', 'operations',
    'generated_at', pg_catalog.clock_timestamp(),
    'refreshed_at', coalesce((select max(refreshed_at) from selected_sessions), pg_catalog.clock_timestamp()),
    'metrics', jsonb_build_object(
      'students', jsonb_build_object(
        'value', (select count(*) from selected_students),
        'denominator', (select count(*) from public.students),
        'unit', 'people', 'period', 'snapshot'
      ),
      'teachers', jsonb_build_object(
        'value', (select count(distinct teacher.id) from public.teachers as teacher
          left join public.teacher_tracks as teacher_track on teacher_track.teacher_id = teacher.id
          where teacher.status = 'active'
            and (p_teacher is null or teacher.id = p_teacher)
            and (p_track is null or teacher_track.track_id = p_track)),
        'denominator', (select count(*) from public.teachers),
        'unit', 'people', 'period', 'snapshot'
      ),
      'sessions', jsonb_build_object(
        'value', (select total from session_rollup),
        'denominator', (select total from session_rollup),
        'unit', 'sessions', 'period', 'range'
      ),
      'held_sessions', jsonb_build_object(
        'value', (select held from session_rollup),
        'denominator', (select total from session_rollup),
        'unit', 'sessions', 'period', 'range'
      ),
      'missed_sessions', jsonb_build_object(
        'value', (select missed from session_rollup),
        'denominator', (select total from session_rollup),
        'unit', 'sessions', 'period', 'range'
      ),
      'cancelled_sessions', jsonb_build_object(
        'value', (select cancelled from session_rollup),
        'denominator', (select total from session_rollup),
        'unit', 'sessions', 'period', 'range'
      ),
      'attendance_rate', jsonb_build_object(
        'value', (select case when eligible = 0 then null else round(attended::numeric / eligible * 100, 2) end from attendance_rollup),
        'numerator', (select attended from attendance_rollup),
        'denominator', (select eligible from attendance_rollup),
        'unit', 'percent', 'period', 'range'
      ),
      'active_subscriptions', jsonb_build_object(
        'value', (select active from subscription_rollup),
        'denominator', (select total from subscription_rollup),
        'unit', 'subscriptions', 'period', 'snapshot'
      )
    )
  ) into result;
  return result;
end;
$$;

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
  period_start timestamptz;
  period_end timestamptz;
  result jsonb;
begin
  perform private.assert_admin_metric_filters(
    p_from, p_to, p_country, p_track, p_teacher, p_status, p_timezone
  );
  period_start := p_from::timestamp at time zone p_timezone;
  period_end := (p_to + 1)::timestamp at time zone p_timezone;

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
    where fact.created_at >= period_start and fact.created_at < period_end
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
    select count(*) filter (where report.status = 'visible' and report.made_visible_at >= period_start
      and report.made_visible_at < period_end)::integer as visible,
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

create or replace function public.get_admin_finance_metrics(
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
  period_start timestamptz;
  period_end timestamptz;
  result jsonb;
begin
  perform private.assert_admin_metric_filters(
    p_from, p_to, p_country, p_track, p_teacher, p_status, p_timezone
  );
  period_start := p_from::timestamp at time zone p_timezone;
  period_end := (p_to + 1)::timestamp at time zone p_timezone;

  with selected_entries as (
    select fact.*
    from public.admin_finance_fact as fact
    where fact.occurred_at >= period_start and fact.occurred_at < period_end
      and (p_country is null or fact.country_code = p_country)
      and (p_track is null or fact.track_id = p_track)
      and (p_teacher is null or fact.teacher_id = p_teacher)
      and (p_status is null or fact.student_status::text = p_status)
  ), invoice_rollup as (
    select currency,
      count(*)::integer as invoices,
      coalesce(sum(amount), 0)::numeric(14, 2) as total,
      coalesce(sum(amount) filter (where status = 'overdue'), 0)::numeric(14, 2) as overdue
    from selected_entries where entry_kind = 'invoice' group by currency
  ), payment_rollup as (
    select currency,
      count(*) filter (where status = 'confirmed')::integer as confirmed,
      coalesce(sum(amount) filter (where status = 'confirmed'), 0)::numeric(14, 2) as net
    from selected_entries where entry_kind = 'payment' group by currency
  ), payout_rollup as (
    select currency,
      count(*)::integer as payouts,
      coalesce(sum(amount), 0)::numeric(14, 2) as total,
      coalesce(sum(amount) filter (where status in ('due', 'approved')), 0)::numeric(14, 2) as due
    from selected_entries where entry_kind = 'payout' group by currency
  )
  select jsonb_build_object(
    'source', 'finance',
    'generated_at', pg_catalog.clock_timestamp(),
    'refreshed_at', coalesce((select max(refreshed_at) from selected_entries), pg_catalog.clock_timestamp()),
    'currencies', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'currency', currencies.currency,
        'invoice_count', coalesce(invoice.invoices, 0),
        'invoiced', coalesce(invoice.total, 0),
        'overdue', coalesce(invoice.overdue, 0),
        'payment_count', coalesce(payment.confirmed, 0),
        'payments_net', coalesce(payment.net, 0),
        'payout_count', coalesce(payout.payouts, 0),
        'payouts_total', coalesce(payout.total, 0),
        'payouts_due', coalesce(payout.due, 0)
      ) order by currencies.currency), '[]'::jsonb)
      from (
        select currency from invoice_rollup union select currency from payment_rollup union select currency from payout_rollup
      ) as currencies
      left join invoice_rollup as invoice using (currency)
      left join payment_rollup as payment using (currency)
      left join payout_rollup as payout using (currency)
    )
  ) into result;
  return result;
end;
$$;

create or replace function public.get_admin_metric_filter_options()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
set statement_timeout = '3s'
as $$
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'admin_mfa_required';
  end if;
  return jsonb_build_object(
    'countries', (select coalesce(jsonb_agg(country order by country), '[]'::jsonb) from (
      select distinct student.country_code as country from public.students as student where student.country_code is not null
    ) as countries),
    'tracks', (select coalesce(jsonb_agg(jsonb_build_object(
      'id', track.id, 'name_ar', track.name_ar, 'name_en', track.name_en
    ) order by track.sort_order, track.name_ar), '[]'::jsonb) from public.tracks as track where track.is_active),
    'teachers', (select coalesce(jsonb_agg(jsonb_build_object(
      'id', teacher.id, 'name', profile.full_name
    ) order by profile.full_name), '[]'::jsonb)
      from public.teachers as teacher join public.profiles as profile on profile.id = teacher.profile_id
      where teacher.status = 'active'),
    'statuses', jsonb_build_array('active', 'dropped', 'graduated', 'suspended', 'archived')
  );
end;
$$;

revoke all on function public.get_admin_operations_metrics(date, date, text, uuid, uuid, text, text)
from public, anon;
revoke all on function public.get_admin_learning_metrics(date, date, text, uuid, uuid, text, text)
from public, anon;
revoke all on function public.get_admin_finance_metrics(date, date, text, uuid, uuid, text, text)
from public, anon;
revoke all on function public.get_admin_metric_filter_options() from public, anon;

grant execute on function public.get_admin_operations_metrics(date, date, text, uuid, uuid, text, text)
to authenticated, service_role;
grant execute on function public.get_admin_learning_metrics(date, date, text, uuid, uuid, text, text)
to authenticated, service_role;
grant execute on function public.get_admin_finance_metrics(date, date, text, uuid, uuid, text, text)
to authenticated, service_role;
grant execute on function public.get_admin_metric_filter_options()
to authenticated, service_role;
