begin;

select no_plan();

select has_function(
  'public',
  'create_subscription',
  array['uuid', 'uuid', 'character', 'date', 'uuid'],
  'subscription creation RPC exists'
);
select col_not_null('public', 'subscriptions', 'policy_snapshot', 'policy snapshot stays mandatory');
select is(
  (select relrowsecurity from pg_class where oid = 'public.subscriptions'::regclass),
  true,
  'subscription RLS stays enabled'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',
  true
);
set local role authenticated;

insert into public.tracks(id, code, name_ar, name_en)
values ('71000000-0000-4000-8000-000000000001', 'subscription-test', 'مسار الاشتراك', 'Subscription track');
insert into public.students(id, full_name, gender, country_code, timezone)
values ('72000000-0000-4000-8000-000000000001', 'طالب الاشتراك', 'male', 'EG', 'Africa/Cairo');
insert into public.packages(
  id, slug, track_id, name_ar, name_en, sessions_per_week, duration_min, billing_period, created_by
) values (
  '73000000-0000-4000-8000-000000000001', 'subscription-monthly',
  '71000000-0000-4000-8000-000000000001', 'باقة ثابتة', 'Fixed package',
  3, 30, 'monthly', '10000000-0000-4000-8000-000000000001'
);
insert into public.package_prices(package_id, country_code, currency, amount, valid_from, created_by)
values
  ('73000000-0000-4000-8000-000000000001', 'ZZ', 'USD', 50, now() - interval '1 day', '10000000-0000-4000-8000-000000000001'),
  ('73000000-0000-4000-8000-000000000001', 'EG', 'EGP', 900, now() - interval '1 day', '10000000-0000-4000-8000-000000000001');
update public.packages set is_published = true where id = '73000000-0000-4000-8000-000000000001';

select lives_ok(
  $$select public.create_subscription(
    '72000000-0000-4000-8000-000000000001',
    '73000000-0000-4000-8000-000000000001',
    'EG',
    '2026-10-21',
    null
  )$$,
  'AAL2 administrator creates a subscription'
);
select is((select status::text from public.subscriptions limit 1), 'trial', 'new subscription starts as trial');
select is((select price_amount from public.subscriptions limit 1), 900.00::numeric, 'country price is fixed');
select is((select price_currency::text from public.subscriptions limit 1), 'EGP', 'currency is fixed');
select is((select price_country::text from public.subscriptions limit 1), 'EG', 'resolved country is fixed');
select is((select sessions_per_period from public.subscriptions limit 1), 12, 'monthly session allowance is captured');
select is((select current_period_end from public.subscriptions limit 1), '2026-11-20'::date, 'monthly period end is derived in the database');
select is((select renew_date from public.subscriptions limit 1), '2026-11-21'::date, 'renewal starts after the period');
select is((select package_snapshot ->> 'name_ar' from public.subscriptions limit 1), 'باقة ثابتة', 'package name is snapshotted');

update public.packages
set name_ar = 'باقة معدلة', policy = jsonb_set(policy, '{cancel_notice_hours}', '24'::jsonb)
where id = '73000000-0000-4000-8000-000000000001';
insert into public.package_prices(package_id, country_code, currency, amount, valid_from, created_by)
values ('73000000-0000-4000-8000-000000000001', 'EG', 'EGP', 1200, now(), '10000000-0000-4000-8000-000000000001');
select is((select price_amount from public.subscriptions limit 1), 900.00::numeric, 'later price change does not alter the subscription');
select is((select package_snapshot ->> 'name_ar' from public.subscriptions limit 1), 'باقة ثابتة', 'later package change does not alter the snapshot');
select is((select policy_snapshot ->> 'cancel_notice_hours' from public.subscriptions limit 1), '12', 'later policy change does not alter the snapshot');
select throws_ok(
  $$select public.create_subscription(
    '72000000-0000-4000-8000-000000000001',
    '73000000-0000-4000-8000-000000000001', 'EG', '2026-10-22', null
  )$$,
  '23505',
  'student_already_has_current_subscription',
  'a student cannot have two current subscriptions'
);
reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',
  true
);
set local role authenticated;
select throws_ok(
  $$select public.create_subscription(
    '72000000-0000-4000-8000-000000000001',
    '73000000-0000-4000-8000-000000000001', 'EG', current_date, null
  )$$,
  '42501',
  'admin_mfa_required',
  'AAL1 administrator cannot create subscriptions'
);
reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}',
  true
);
set local role authenticated;
select is((select count(*)::integer from public.subscriptions), 0, 'teacher cannot read subscriptions');
reset role;

select * from finish();
rollback;
