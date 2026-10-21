create table public.reconciliation_runs (
  id uuid primary key default gen_random_uuid(),
  scope text not null default 'financial' check (scope = 'financial'),
  status text not null default 'running' check (status in ('running', 'passed', 'failed')),
  issue_count integer not null default 0 check (issue_count >= 0),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  triggered_by uuid references public.profiles(id) on delete restrict,
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object')
);
create table public.reconciliation_issues (
  id bigint generated always as identity primary key,
  run_id uuid not null references public.reconciliation_runs(id) on delete cascade,
  category text not null check (category in (
    'invoice_status', 'invoice_credit', 'session_credit', 'payout_total', 'payout_expense', 'payout_item'
  )),
  entity_id uuid not null,
  expected text not null,
  actual text not null,
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  created_at timestamptz not null default now()
);
create index reconciliation_runs_started_idx on public.reconciliation_runs(started_at desc);
create index reconciliation_issues_run_category_idx on public.reconciliation_issues(run_id, category);

alter table public.reconciliation_runs enable row level security;
alter table public.reconciliation_issues enable row level security;
revoke all on public.reconciliation_runs, public.reconciliation_issues from public, anon, authenticated;
grant select on public.reconciliation_runs, public.reconciliation_issues to authenticated;
grant select, insert, update, delete on public.reconciliation_runs, public.reconciliation_issues to service_role;
create policy reconciliation_runs_admin_read on public.reconciliation_runs for select to authenticated using ((select public.is_admin()));
create policy reconciliation_issues_admin_read on public.reconciliation_issues for select to authenticated using ((select public.is_admin()));

create or replace function public.run_financial_reconciliation()
returns uuid language plpgsql security definer set search_path = ''
as $$
declare result_id uuid; issues integer; actor uuid := (select auth.uid());
begin
  if current_user not in ('postgres','service_role') and not public.is_admin() then
    raise exception using errcode = '42501', message = 'admin_mfa_required';
  end if;
  insert into public.reconciliation_runs(triggered_by) values (actor) returning id into result_id;

  insert into public.reconciliation_issues(run_id, category, entity_id, expected, actual, details)
  select result_id, 'invoice_status', invoice.id,
    case when balance.due <= 0 then 'paid' when balance.paid > 0 then 'partially_paid' when invoice.due_date < current_date then 'overdue' else 'issued' end,
    invoice.status::text, jsonb_build_object('total', balance.total, 'paid', balance.paid, 'due', balance.due, 'currency', invoice.currency)
  from public.invoices as invoice join public.invoice_balance as balance on balance.invoice_id = invoice.id
  where invoice.status not in ('draft','void') and invoice.status::text <> case when balance.due <= 0 then 'paid' when balance.paid > 0 then 'partially_paid' when invoice.due_date < current_date then 'overdue' else 'issued' end;

  insert into public.reconciliation_issues(run_id, category, entity_id, expected, actual, details)
  select result_id, 'invoice_credit', invoice.id, '1', count(ledger.id)::text,
    jsonb_build_object('invoice_no', invoice.invoice_no, 'purpose', invoice.purpose)
  from public.invoices as invoice
  left join public.session_credit_ledger as ledger on ledger.source_invoice_id = invoice.id
    and ledger.reason = case when invoice.purpose = 'proration' then 'proration'::public.credit_reason else 'grant'::public.credit_reason end
  where invoice.status = 'paid' and invoice.subscription_id is not null
  group by invoice.id having count(ledger.id) <> 1;

  insert into public.reconciliation_issues(run_id, category, entity_id, expected, actual, details)
  select result_id, 'session_credit', session.id, 'one consume ledger entry', count(ledger.id)::text,
    jsonb_build_object('attendance_status', attendance.status, 'subscription_id', subscription.id)
  from public.attendance as attendance
  join public.sessions as session on session.id = attendance.session_id
  join lateral (
    select candidate.* from public.subscriptions as candidate
    where candidate.student_id = session.student_id
      and session.scheduled_at::date between candidate.current_period_start and candidate.current_period_end
    order by candidate.current_period_start desc limit 1
  ) as subscription on true
  left join public.session_credit_ledger as ledger on ledger.session_id = session.id and ledger.reason = 'consume'
  where attendance.status in ('present','late')
    or (attendance.status = 'student_absent' and (subscription.policy_snapshot ->> 'student_no_show_consumes_credit')::boolean)
    or (attendance.status = 'student_excused'
      and not (attendance.student_notice_at is not null and attendance.student_notice_at <= session.scheduled_at - pg_catalog.make_interval(hours => (subscription.policy_snapshot ->> 'cancel_notice_hours')::integer))
      and (subscription.policy_snapshot ->> 'student_no_show_consumes_credit')::boolean)
  group by session.id, attendance.status, subscription.id having count(ledger.id) <> 1;

  insert into public.reconciliation_issues(run_id, category, entity_id, expected, actual, details)
  select result_id, 'payout_item', item.id, item.rate_snapshot::text, item.amount::text,
    jsonb_build_object('session_id', item.session_id, 'teacher_id', item.teacher_id)
  from public.teacher_payout_items as item where item.amount <> item.rate_snapshot or item.rate_id is null;

  insert into public.reconciliation_issues(run_id, category, entity_id, expected, actual, details)
  select result_id, 'payout_total', payout.id,
    jsonb_build_object('gross', totals.gross, 'bonuses', totals.bonuses, 'deductions', totals.deductions, 'net', greatest(totals.gross + totals.bonuses - totals.deductions, 0))::text,
    jsonb_build_object('gross', payout.gross, 'bonuses', payout.bonuses, 'deductions', payout.deductions, 'net', payout.net)::text,
    jsonb_build_object('payout_no', payout.payout_no, 'currency', payout.currency)
  from public.teacher_payouts as payout
  cross join lateral (
    select coalesce((select sum(amount) from public.teacher_payout_items where payout_id = payout.id),0) as gross,
      coalesce((select sum(amount) from public.teacher_adjustments where payout_id = payout.id and kind = 'bonus'),0) as bonuses,
      coalesce((select sum(amount) from public.teacher_adjustments where payout_id = payout.id and kind = 'deduction'),0) as deductions
  ) as totals
  where payout.gross <> totals.gross or payout.bonuses <> totals.bonuses or payout.deductions <> totals.deductions
    or payout.net <> greatest(totals.gross + totals.bonuses - totals.deductions, 0);

  insert into public.reconciliation_issues(run_id, category, entity_id, expected, actual, details)
  select result_id, 'payout_expense', payout.id, payout.net::text,
    coalesce(sum(expense.amount) filter (where expense.status = 'recorded'),0)::text,
    jsonb_build_object('payout_no', payout.payout_no, 'currency', payout.currency)
  from public.teacher_payouts as payout left join public.expenses as expense on expense.payout_id = payout.id
  where payout.status = 'paid' group by payout.id having coalesce(sum(expense.amount) filter (where expense.status = 'recorded'),0) <> payout.net;

  select count(*)::integer into issues from public.reconciliation_issues where run_id = result_id;
  update public.reconciliation_runs set status = case when issues = 0 then 'passed' else 'failed' end,
    issue_count = issues, finished_at = now(), details = jsonb_build_object('checked_at', now()) where id = result_id;
  return result_id;
exception when others then
  if result_id is not null then update public.reconciliation_runs set status = 'failed', finished_at = now(), details = jsonb_build_object('execution_error', sqlstate) where id = result_id; end if;
  raise;
end;
$$;
revoke execute on function public.run_financial_reconciliation() from public, anon;
grant execute on function public.run_financial_reconciliation() to authenticated, service_role;

select cron.schedule('financial-reconciliation-nightly', '45 1 * * *', $$select public.run_financial_reconciliation()$$)
where not exists (select 1 from cron.job where jobname = 'financial-reconciliation-nightly');

comment on function public.run_financial_reconciliation() is
'Runs AC-120/AC-130 reconciliation without repairing or hiding discrepancies; every difference is retained for admin review.';
