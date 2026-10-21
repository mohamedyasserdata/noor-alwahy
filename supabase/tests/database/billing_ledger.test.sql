begin;

select no_plan();
select has_table('public', 'invoices', 'invoices table exists');
select has_table('public', 'invoice_items', 'invoice items table exists');
select has_table('public', 'payments', 'payments table exists');
select has_table('public', 'payment_methods', 'payment methods table exists');
select has_view('public', 'invoice_balance', 'invoice balance view exists');
select is((select relrowsecurity from pg_class where oid = 'public.payments'::regclass), true, 'payment RLS is enabled');

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',
  true
);
set local role authenticated;

insert into public.tracks(id, code, name_ar)
values ('81000000-0000-4000-8000-000000000001', 'billing-test', 'مسار الفوترة');
insert into public.students(id, full_name, gender, country_code)
values ('82000000-0000-4000-8000-000000000001', 'طالب الفوترة', 'male', 'EG');
insert into public.packages(id, slug, track_id, name_ar, sessions_per_week, created_by)
values (
  '83000000-0000-4000-8000-000000000001', 'billing-monthly',
  '81000000-0000-4000-8000-000000000001', 'باقة الفوترة', 2,
  '10000000-0000-4000-8000-000000000001'
);
insert into public.package_prices(package_id, country_code, currency, amount, valid_from, created_by)
values
  ('83000000-0000-4000-8000-000000000001', 'ZZ', 'USD', 30, now() - interval '1 day', '10000000-0000-4000-8000-000000000001'),
  ('83000000-0000-4000-8000-000000000001', 'EG', 'EGP', 900, now() - interval '1 day', '10000000-0000-4000-8000-000000000001');
update public.packages set is_published = true where id = '83000000-0000-4000-8000-000000000001';
select public.create_subscription(
  '82000000-0000-4000-8000-000000000001',
  '83000000-0000-4000-8000-000000000001', 'EG', '2026-10-21', null
);

select is((select count(*)::integer from public.invoices), 1, 'subscription creates one invoice');
select is((select status::text from public.invoices limit 1), 'issued', 'subscription invoice is issued');
select is((select total from public.invoices limit 1), 900.00::numeric, 'invoice total comes from fixed subscription price');
select is((select due from public.invoice_balance limit 1), 900.00::numeric, 'initial invoice balance is fully due');
select like((select invoice_no from public.invoices limit 1), 'INV-2026-%', 'invoice has a numbered identifier');

select throws_ok(
  $$update public.invoice_items set unit_amount = 901$$,
  'P0001', 'invoice_immutable', 'issued invoice items are immutable'
);
select throws_ok(
  $$insert into public.payments(invoice_id, amount, currency, recorded_by)
    select id, 100, 'USD', '10000000-0000-4000-8000-000000000001' from public.invoices$$,
  'P0001', 'payment_currency_mismatch', 'payment currency must match the invoice'
);

insert into public.payments(id, invoice_id, amount, currency, recorded_by)
select
  '84000000-0000-4000-8000-000000000001', id, 400, currency,
  '10000000-0000-4000-8000-000000000001'
from public.invoices;
update public.payments set status = 'confirmed'
where id = '84000000-0000-4000-8000-000000000001';
select is((select status::text from public.invoices limit 1), 'partially_paid', 'partial payment marks invoice partially paid');
select is((select paid from public.invoice_balance limit 1), 400.00::numeric, 'confirmed partial payment updates balance');
select is((select count(*)::integer from public.session_credit_ledger), 0, 'partial payment does not grant credits');
select like((select receipt_no from public.payments where id = '84000000-0000-4000-8000-000000000001'), 'REC-2026-%', 'confirmed payment gets a receipt number');
select throws_ok(
  $$update public.payments set amount = 401 where id = '84000000-0000-4000-8000-000000000001'$$,
  'P0001', 'payment_immutable', 'confirmed payment cannot be edited'
);
select throws_ok(
  $$delete from public.payments where id = '84000000-0000-4000-8000-000000000001'$$,
  'P0001', 'payment_immutable', 'payments cannot be deleted'
);

insert into public.payments(id, invoice_id, amount, currency, recorded_by)
select
  '84000000-0000-4000-8000-000000000002', id, 500, currency,
  '10000000-0000-4000-8000-000000000001'
from public.invoices;
update public.payments set status = 'confirmed'
where id = '84000000-0000-4000-8000-000000000002';
select is((select status::text from public.invoices limit 1), 'paid', 'full confirmed amount marks invoice paid');
select is((select status::text from public.subscriptions limit 1), 'active', 'paid invoice activates subscription');
select is((select count(*)::integer from public.session_credit_ledger where reason = 'grant'), 1, 'paid invoice grants credits exactly once');
select is((select delta from public.session_credit_ledger where reason = 'grant'), 8, 'grant uses the snapshotted period allowance');

insert into public.payments(id, invoice_id, kind, amount, currency, recorded_by)
select
  '84000000-0000-4000-8000-000000000003', id, 'refund', 901, currency,
  '10000000-0000-4000-8000-000000000001'
from public.invoices;
select throws_ok(
  $$update public.payments set status = 'confirmed'
    where id = '84000000-0000-4000-8000-000000000003'$$,
  'P0001', 'refund_exceeds_paid', 'refund cannot exceed net confirmed payments'
);
update public.payments set status = 'rejected' where id = '84000000-0000-4000-8000-000000000003';
insert into public.payments(id, invoice_id, kind, amount, currency, recorded_by)
select
  '84000000-0000-4000-8000-000000000004', id, 'refund', 100, currency,
  '10000000-0000-4000-8000-000000000001'
from public.invoices;
update public.payments set status = 'confirmed' where id = '84000000-0000-4000-8000-000000000004';
select is((select status::text from public.invoices limit 1), 'partially_paid', 'refund reopens invoice balance');
select is((select paid from public.invoice_balance limit 1), 800.00::numeric, 'refund reduces net paid amount');
select is((select count(*)::integer from public.session_credit_ledger where reason = 'grant'), 1, 'refund does not duplicate the original grant');
reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}',
  true
);
set local role authenticated;
select is((select count(*)::integer from public.invoices), 0, 'teacher cannot read invoices');
select is((select count(*)::integer from public.payments), 0, 'teacher cannot read payments');
reset role;

select * from finish();
rollback;
