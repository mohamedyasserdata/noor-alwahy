begin;

select no_plan();

select has_table('public', 'countries', 'countries table exists');
select has_table('public', 'packages', 'packages table exists');
select has_table('public', 'package_prices', 'package prices table exists');
select has_table('public', 'coupons', 'coupons table exists');
select has_function(
  'public',
  'resolve_price',
  array['uuid', 'character', 'timestamp with time zone'],
  'public price resolver exists'
);
select is(
  (select relrowsecurity from pg_class where oid = 'public.countries'::regclass),
  true,
  'country RLS is enabled'
);
select is(
  (select relrowsecurity from pg_class where oid = 'public.packages'::regclass),
  true,
  'package RLS is enabled'
);
select is(
  (select relrowsecurity from pg_class where oid = 'public.package_prices'::regclass),
  true,
  'price RLS is enabled'
);
select is(
  (select relrowsecurity from pg_class where oid = 'public.coupons'::regclass),
  true,
  'coupon RLS is enabled'
);
select is((select count(*)::integer from public.countries), 23, 'all 22 Arab countries and ZZ are seeded');
select is((select currency::text from public.countries where code = 'EG'), 'EGP', 'Egypt uses EGP');
select is((select currency::text from public.countries where code = 'ZZ'), 'USD', 'fallback country uses temporary USD decision');
select is(has_table_privilege('anon', 'public.packages', 'select'), true, 'anonymous visitors may read public packages');
select is(has_table_privilege('anon', 'public.packages', 'insert'), false, 'anonymous visitors cannot create packages');
select is(has_table_privilege('anon', 'public.package_prices', 'select'), true, 'anonymous visitors may read public prices');
select is(has_table_privilege('anon', 'public.package_prices', 'insert'), false, 'anonymous visitors cannot create prices');
select is(has_table_privilege('anon', 'public.coupons', 'select'), false, 'coupon inventory is not public');
select is(has_table_privilege('service_role', 'public.package_prices', 'update'), false, 'price rows cannot be updated through grants');
select is(has_table_privilege('service_role', 'public.package_prices', 'delete'), false, 'price rows cannot be deleted through grants');

insert into public.tracks(id, code, name_ar, name_en)
values ('61000000-0000-4000-8000-000000000001', 'package-test', 'مسار الباقات', 'Package track');

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',
  true
);
set local role authenticated;

select lives_ok(
  $$insert into public.packages(
      id, slug, track_id, name_ar, name_en, sessions_per_week, duration_min, created_by
    ) values (
      '62000000-0000-4000-8000-000000000001', 'foundation-monthly',
      '61000000-0000-4000-8000-000000000001', 'باقة التأسيس', 'Foundation package',
      3, 30, '10000000-0000-4000-8000-000000000001'
    )$$,
  'AAL2 administrator creates a package draft'
);
select throws_ok(
  $$update public.packages set is_published = true
    where id = '62000000-0000-4000-8000-000000000001'$$,
  'P0001',
  'package_default_price_required',
  'package cannot publish without a current ZZ price'
);
select throws_ok(
  $$update public.packages
    set policy = '{"cancel_notice_hours":"wrong"}'::jsonb
    where id = '62000000-0000-4000-8000-000000000001'$$,
  '23514',
  null,
  'invalid package policy is rejected by the database'
);
select throws_ok(
  $$insert into public.package_prices(
      package_id, country_code, currency, amount, valid_from, created_by
    ) values (
      '62000000-0000-4000-8000-000000000001', 'EG', 'USD', 500,
      now() - interval '10 days', '10000000-0000-4000-8000-000000000001'
    )$$,
  'P0001',
  'price_currency_mismatch',
  'country price must use the configured country currency'
);
select throws_ok(
  $$insert into public.package_prices(
      package_id, country_code, currency, amount, min_amount, max_amount, valid_from, created_by
    ) values (
      '62000000-0000-4000-8000-000000000001', 'EG', 'EGP', 400, 450, 900,
      now() - interval '10 days', '10000000-0000-4000-8000-000000000001'
    )$$,
  '23514',
  null,
  'price below the configured minimum is rejected'
);
select lives_ok(
  $$insert into public.package_prices(
      package_id, country_code, currency, amount, min_amount, max_amount, valid_from, created_by
    ) values
      ('62000000-0000-4000-8000-000000000001', 'ZZ', 'USD', 50, 20, 100,
        now() - interval '10 days', '10000000-0000-4000-8000-000000000001'),
      ('62000000-0000-4000-8000-000000000001', 'EG', 'EGP', 500, 300, 900,
        now() - interval '10 days', '10000000-0000-4000-8000-000000000001'),
      ('62000000-0000-4000-8000-000000000001', 'SA', 'SAR', 100, 50, 200,
        now() - interval '10 days', '10000000-0000-4000-8000-000000000001'),
      ('62000000-0000-4000-8000-000000000001', 'SA', 'SAR', 120, 50, 200,
        now() + interval '1 day', '10000000-0000-4000-8000-000000000001')$$,
  'administrator adds append-only current and scheduled prices'
);
select lives_ok(
  $$update public.packages set is_published = true
    where id = '62000000-0000-4000-8000-000000000001'$$,
  'package publishes after adding a current ZZ price'
);
select throws_ok(
  $$update public.package_prices set amount = 501
    where package_id = '62000000-0000-4000-8000-000000000001' and country_code = 'EG'$$,
  'P0001',
  'package_price_immutable',
  'existing price rows cannot be updated'
);
select throws_ok(
  $$delete from public.package_prices
    where package_id = '62000000-0000-4000-8000-000000000001' and country_code = 'EG'$$,
  'P0001',
  'package_price_immutable',
  'existing price rows cannot be deleted'
);
select lives_ok(
  $$insert into public.coupons(code, kind, value, starts_at, ends_at, max_redemptions, created_by)
    values ('welcome10', 'percent', 10, now() - interval '1 day', now() + interval '1 day', 20,
      '10000000-0000-4000-8000-000000000001')$$,
  'administrator creates a bounded percentage coupon'
);
select is((select code from public.coupons limit 1), 'WELCOME10', 'coupon codes are normalized to uppercase');
select throws_ok(
  $$insert into public.coupons(code, kind, value) values ('TOO-MUCH', 'percent', 101)$$,
  '23514',
  null,
  'percentage coupon cannot exceed one hundred percent'
);
select throws_ok(
  $$insert into public.coupons(code, kind, value) values ('FIXED-NO-CURRENCY', 'fixed', 10)$$,
  '23514',
  null,
  'fixed coupon requires a currency'
);
select throws_ok(
  $$insert into public.coupons(code, kind, value, starts_at, ends_at)
    values ('BAD-PERIOD', 'seasonal', 10, now(), now() - interval '1 day')$$,
  '23514',
  null,
  'coupon end must be after its start'
);
reset role;

set local role anon;
select is((select count(*)::integer from public.countries), 23, 'anonymous visitor reads enabled countries');
select is((select count(*)::integer from public.packages), 1, 'anonymous visitor reads the published priced package');
select is(
  (select amount from public.resolve_price('62000000-0000-4000-8000-000000000001', 'EG', now())),
  500.00::numeric,
  'country-specific price wins over fallback'
);
select is(
  (select currency::text from public.resolve_price('62000000-0000-4000-8000-000000000001', 'EG', now())),
  'EGP',
  'country-specific price returns its local currency'
);
select is(
  (select amount from public.resolve_price('62000000-0000-4000-8000-000000000001', 'SA', now())),
  100.00::numeric,
  'scheduled price is not applied before its start'
);
select is(
  (select amount from public.resolve_price(
    '62000000-0000-4000-8000-000000000001', 'SA', now() + interval '2 days'
  )),
  120.00::numeric,
  'scheduled price applies after its start'
);
select is(
  (select amount from public.resolve_price('62000000-0000-4000-8000-000000000001', 'US', now())),
  50.00::numeric,
  'unknown country falls back to ZZ'
);
select is((select count(*)::integer from public.coupons), 0, 'anonymous visitor cannot enumerate coupons');
reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',
  true
);
set local role authenticated;
select lives_ok(
  $$insert into public.package_prices(
      package_id, country_code, currency, amount, is_active, valid_from, created_by
    ) values (
      '62000000-0000-4000-8000-000000000001', 'EG', 'EGP', 500, false,
      now() - interval '1 minute', '10000000-0000-4000-8000-000000000001'
    )$$,
  'administrator disables a country with a new append-only row'
);
select ok(
  (
    select before is not null and after is not null
    from public.audit_logs
    where table_name = 'package_prices'
    order by id desc
    limit 1
  ),
  'price audit records previous and replacement rows'
);
select lives_ok(
  $$insert into public.packages(
      id, slug, track_id, name_ar, sessions_per_week, created_by
    ) values (
      '62000000-0000-4000-8000-000000000002', 'private-without-default',
      '61000000-0000-4000-8000-000000000001', 'باقة غير منشورة', 2,
      '10000000-0000-4000-8000-000000000001'
    )$$,
  'administrator may keep a draft without a default price'
);
reset role;

set local role anon;
select is(
  (select country_code::text from public.resolve_price('62000000-0000-4000-8000-000000000001', 'EG', now())),
  'ZZ',
  'disabled country price falls back to ZZ'
);
select is_empty(
  $$select * from public.resolve_price('62000000-0000-4000-8000-000000000002', 'EG', now())$$,
  'unpublished package never resolves a public price'
);
reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}',
  true
);
set local role authenticated;
select is((select count(*)::integer from public.coupons), 0, 'teacher cannot read coupon inventory');
select throws_ok(
  $$insert into public.packages(slug, name_ar, sessions_per_week)
    values ('teacher-package', 'باقة مدرس', 2)$$,
  '42501',
  null,
  'teacher cannot create a package'
);
reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',
  true
);
set local role authenticated;
select throws_ok(
  $$insert into public.coupons(code, kind, value) values ('NO-MFA', 'percent', 10)$$,
  '42501',
  null,
  'AAL1 administrator cannot manage coupons'
);
reset role;

select * from finish();
rollback;
