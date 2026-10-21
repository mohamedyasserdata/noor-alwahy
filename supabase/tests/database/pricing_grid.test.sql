begin;
select no_plan();
select has_function('public', 'bulk_append_package_prices', array['character','character','numeric','numeric','timestamp with time zone','uuid[]'], 'bulk pricing RPC exists');

select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
insert into public.tracks(id, code, name_ar) values ('91000000-0000-4000-8000-000000000001', 'pricing-grid', 'مسار شبكة السعر');
insert into public.packages(id, slug, track_id, name_ar, sessions_per_week, created_by)
values ('92000000-0000-4000-8000-000000000001', 'pricing-grid-package', '91000000-0000-4000-8000-000000000001', 'باقة الشبكة', 2, '10000000-0000-4000-8000-000000000001');
insert into public.package_prices(package_id, country_code, currency, amount, valid_from, created_by)
values ('92000000-0000-4000-8000-000000000001', 'ZZ', 'USD', 33, now() - interval '1 day', '10000000-0000-4000-8000-000000000001');
update public.packages set is_published = true where id = '92000000-0000-4000-8000-000000000001';

select is(
  public.bulk_append_package_prices('ZZ', 'EG', 30.25, 10, now() + interval '1 day', array['92000000-0000-4000-8000-000000000001']::uuid[]),
  1,
  'bulk pricing schedules one selected package'
);
select is((select amount from public.package_prices where country_code = 'EG'), 1000.00::numeric, 'multiplier result rounds to requested step');
select is((select currency::text from public.package_prices where country_code = 'EG'), 'EGP', 'target country currency is enforced');
select is((select amount from public.resolve_price('92000000-0000-4000-8000-000000000001', 'EG', now())), 33.00::numeric, 'future price does not apply before its schedule');
select is((select amount from public.resolve_price('92000000-0000-4000-8000-000000000001', 'EG', now() + interval '2 days')), 1000.00::numeric, 'future price applies after its schedule');
select ok(exists(select 1 from public.audit_logs where table_name = 'package_prices'), 'new prices are audited');
select throws_ok(
  $$select public.bulk_append_package_prices('SA', 'EG', 1, 1, now(), null)$$,
  'P0002', 'pricing_source_prices_not_found', 'bulk pricing rejects a missing source set atomically'
);
reset role;

select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select throws_ok(
  $$select public.bulk_append_package_prices('ZZ', 'EG', 1, 1, now(), null)$$,
  '42501', 'admin_mfa_required', 'bulk pricing requires administrator MFA'
);
reset role;
select * from finish();
rollback;
