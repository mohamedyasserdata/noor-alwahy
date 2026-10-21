begin;

select plan(11);
select has_table('public', 'expenses', 'expenses table exists');
select has_view('public', 'financial_currency_summary', 'currency summary exists');
select has_view('public', 'student_account_statement', 'student statement exists');
select is((select relrowsecurity from pg_class where oid = 'public.expenses'::regclass), true, 'expense RLS is enabled');

select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
select lives_ok($$insert into public.expenses(category, description, amount, currency, incurred_on, created_by)
values ('software', 'اشتراك النظام', 25, 'USD', current_date, '10000000-0000-4000-8000-000000000001')$$, 'admin records an expense');
select like((select expense_no from public.expenses limit 1), 'EXP-%', 'expense number is generated');
select is((select expenses from public.financial_currency_summary where currency = 'USD'), 25.00::numeric, 'summary keeps the USD expense separate');
select throws_ok($$update public.expenses set amount = 30$$, 'P0001', 'expense_financial_fields_immutable', 'posted financial fields are immutable');
select lives_ok($$update public.expenses set status = 'void', void_reason = 'قيد مكرر'$$, 'admin can void with a reason');
select is((select count(*)::integer from public.financial_currency_summary where currency = 'USD'), 0, 'void expense is excluded from summary');
reset role;

select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select is((select count(*)::integer from public.expenses), 0, 'teacher cannot read expenses');
reset role;

select * from finish();
rollback;
