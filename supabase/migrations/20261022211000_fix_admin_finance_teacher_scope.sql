-- Preserve the selected teacher on student finance rows so the teacher filter has
-- identical meaning across operations, learning, and finance sources.
create or replace view public.admin_finance_fact
with (security_invoker = true, security_barrier = true)
as
select
  'invoice'::text as entry_kind,
  invoice.id as entry_id,
  invoice.student_id,
  assignment.teacher_id,
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
  select current_assignment.teacher_id, current_assignment.track_id
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
  assignment.teacher_id,
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
  select current_assignment.teacher_id, current_assignment.track_id
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

revoke all on public.admin_finance_fact from public, anon, authenticated;
grant select on public.admin_finance_fact to service_role;
