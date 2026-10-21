begin;

select plan(12);
select has_table('public', 'reconciliation_runs', 'reconciliation run history exists');
select has_table('public', 'reconciliation_issues', 'reconciliation issue history exists');
select has_function('public', 'run_financial_reconciliation', array[]::text[], 'reconciliation RPC exists');
select is((select relrowsecurity from pg_class where oid = 'public.reconciliation_runs'::regclass), true, 'run history has RLS');
select is((select relrowsecurity from pg_class where oid = 'public.reconciliation_issues'::regclass), true, 'issue history has RLS');

select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
select lives_ok($$select public.run_financial_reconciliation()$$, 'admin runs reconciliation');
select is((select status from public.reconciliation_runs order by started_at desc limit 1), 'passed', 'clean seed data passes');
select is((select issue_count from public.reconciliation_runs order by started_at desc limit 1), 0, 'clean run has no issues');

insert into public.teachers(id, profile_id, gender, status)
values ('93000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', 'male', 'active');
insert into public.teacher_payouts(id, teacher_id, period_start, period_end, currency, gross, net, status)
values ('94000000-0000-4000-8000-000000000001', '93000000-0000-4000-8000-000000000001', '2026-09-01', '2026-09-30', 'USD', 50, 50, 'due');
select public.run_financial_reconciliation();
select is((select status from public.reconciliation_runs order by started_at desc limit 1), 'failed', 'mismatched payout fails reconciliation');
select is((select count(*)::integer from public.reconciliation_issues where category = 'payout_total'), 1, 'payout mismatch is retained as an issue');
reset role;

select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select is((select count(*)::integer from public.reconciliation_runs), 0, 'teacher cannot read reconciliation runs');
select throws_ok($$select public.run_financial_reconciliation()$$, '42501', 'admin_mfa_required', 'teacher cannot run reconciliation');
reset role;

select * from finish();
rollback;
