begin;

select plan(14);

select has_function('public', 'process_subscription_renewals', array['date'], 'renewal processor exists');
select has_function('public', 'pause_subscription', array['uuid', 'date', 'text'], 'pause RPC exists');
select has_function('public', 'request_subscription_change', array['uuid', 'uuid'], 'package change RPC exists');
select col_is_fk('public', 'subscriptions', 'scheduled_package_id', 'scheduled package is constrained');
select col_not_null('public', 'invoices', 'purpose', 'invoice purpose is mandatory');
select is(
  (select relrowsecurity from pg_class where oid = 'public.subscription_renewal_alerts'::regclass),
  true,
  'renewal alerts have RLS enabled'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',
  true
);
set local role authenticated;

insert into public.tracks(id, code, name_ar, name_en)
values ('81000000-0000-4000-8000-000000000001', 'renewal-test', 'مسار التجديد', 'Renewal track');
insert into public.students(id, full_name, gender, country_code, timezone)
values ('82000000-0000-4000-8000-000000000001', 'طالب التجديد', 'male', 'EG', 'Africa/Cairo');
insert into public.packages(
  id, slug, track_id, name_ar, name_en, sessions_per_week, duration_min, billing_period, created_by
) values
  ('83000000-0000-4000-8000-000000000001', 'renewal-base', '81000000-0000-4000-8000-000000000001', 'الأساسية', 'Base', 2, 30, 'monthly', '10000000-0000-4000-8000-000000000001'),
  ('83000000-0000-4000-8000-000000000002', 'renewal-upgrade', '81000000-0000-4000-8000-000000000001', 'المتقدمة', 'Upgrade', 4, 45, 'monthly', '10000000-0000-4000-8000-000000000001');
insert into public.package_prices(package_id, country_code, currency, amount, valid_from, created_by)
values
  ('83000000-0000-4000-8000-000000000001', 'EG', 'EGP', 800, '2026-01-01', '10000000-0000-4000-8000-000000000001'),
  ('83000000-0000-4000-8000-000000000002', 'EG', 'EGP', 1200, '2026-01-01', '10000000-0000-4000-8000-000000000001');
update public.packages set is_published = true where id in (
  '83000000-0000-4000-8000-000000000001', '83000000-0000-4000-8000-000000000002'
);

select public.create_subscription(
  '82000000-0000-4000-8000-000000000001',
  '83000000-0000-4000-8000-000000000001',
  'EG', '2026-10-01', null
);
update public.subscriptions set status = 'active';

select lives_ok(
  $$select public.process_subscription_renewals('2026-10-24')$$,
  'seven-day renewal processing succeeds'
);
select is((select count(*)::integer from public.subscription_renewal_alerts), 1, 'one seven-day alert is recorded');
select is((select count(*)::integer from public.invoices where purpose = 'renewal'), 1, 'one renewal invoice is issued');
select lives_ok(
  $$select public.process_subscription_renewals('2026-10-24')$$,
  'renewal processing is safely repeatable'
);
select is((select count(*)::integer from public.subscription_renewal_alerts), 1, 'repeated processing does not duplicate alerts');
select is((select count(*)::integer from public.invoices where purpose = 'renewal'), 1, 'repeated processing does not duplicate invoices');

select lives_ok(
  $$select public.request_subscription_change(
    (select id from public.subscriptions limit 1),
    '83000000-0000-4000-8000-000000000002'
  )$$,
  'upgrade creates a prorated invoice'
);
select is((select count(*)::integer from public.invoices where purpose = 'proration'), 1, 'only one open proration invoice exists');

select * from finish();
rollback;
