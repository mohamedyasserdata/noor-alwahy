begin;

select plan(14);
select has_table('public', 'teacher_payouts', 'teacher payouts table exists');
select has_table('public', 'teacher_adjustments', 'teacher adjustments table exists');
select has_view('public', 'my_earnings', 'teacher-scoped earnings view exists');
select has_function('public', 'generate_teacher_payouts', array['date', 'date'], 'payout generator exists');
select has_function('public', 'add_teacher_adjustment', array['uuid', 'text', 'numeric', 'text'], 'adjustment RPC exists');
select has_function('public', 'transition_teacher_payout', array['uuid', 'text', 'text'], 'payout transition RPC exists');

select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
insert into public.teachers(id, profile_id, gender, status)
values ('91000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', 'male', 'active');
insert into public.teacher_payouts(id, teacher_id, period_start, period_end, currency, status)
values ('92000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000001', '2026-09-01', '2026-09-30', 'USD', 'due');
select lives_ok($$select public.add_teacher_adjustment('92000000-0000-4000-8000-000000000001', 'bonus', 100, 'مكافأة اختبار')$$, 'admin adds a bonus before approval');
select is((select net from public.teacher_payouts where id = '92000000-0000-4000-8000-000000000001'), 100.00::numeric, 'adjustment recalculates net pay');
select lives_ok($$select public.transition_teacher_payout('92000000-0000-4000-8000-000000000001', 'approve', null)$$, 'due payout can be approved');
select lives_ok($$select public.transition_teacher_payout('92000000-0000-4000-8000-000000000001', 'pay', 'BANK-TEST-1')$$, 'approved payout can be paid');
select is((select status::text from public.teacher_payouts where id = '92000000-0000-4000-8000-000000000001'), 'paid', 'payout reaches paid state');
select is((select count(*)::integer from public.expenses where payout_id = '92000000-0000-4000-8000-000000000001' and source = 'teacher_payout'), 1, 'payment creates exactly one linked expense');
select throws_ok($$select public.transition_teacher_payout('92000000-0000-4000-8000-000000000001', 'pay', 'AGAIN')$$, 'P0001', 'invalid_payout_transition', 'paid payout cannot be paid twice');
reset role;

select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select is((select count(*)::integer from public.my_earnings), 1, 'teacher sees only their own payout');
reset role;

select * from finish();
rollback;
