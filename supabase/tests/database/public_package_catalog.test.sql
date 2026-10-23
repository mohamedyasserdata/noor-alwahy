begin;

select no_plan();

select has_function(
  'public',
  'get_public_package_catalog',
  array['character', 'timestamp with time zone'],
  'public package catalog RPC exists'
);
select is(
  has_function_privilege(
    'anon',
    'public.get_public_package_catalog(character, timestamp with time zone)',
    'execute'
  ),
  true,
  'anonymous visitors may execute the public catalog RPC'
);

insert into public.packages(id, slug, name_ar, name_en, sessions_per_week, duration_min)
values (
  '66000000-0000-4000-8000-000000000001',
  'public-catalog-package',
  'باقة الكتالوج',
  'Catalog package',
  2,
  45
);
insert into public.package_prices(package_id, country_code, currency, amount, valid_from)
values
  ('66000000-0000-4000-8000-000000000001', 'ZZ', 'USD', 40, now() - interval '1 hour'),
  ('66000000-0000-4000-8000-000000000001', 'EG', 'EGP', 900, now() - interval '1 hour');

set local role anon;
select is(
  (select count(*)::integer from public.get_public_package_catalog('EG', now())),
  0,
  'catalog never exposes a draft package'
);
reset role;

update public.packages
set is_published = true
where id = '66000000-0000-4000-8000-000000000001';

set local role anon;
select is(
  (
    select amount
    from public.get_public_package_catalog('EG', now())
    where package_id = '66000000-0000-4000-8000-000000000001'
  ),
  900.00::numeric,
  'catalog resolves the visitor country price'
);
select is(
  (
    select currency::text
    from public.get_public_package_catalog('US', now())
    where package_id = '66000000-0000-4000-8000-000000000001'
  ),
  'USD',
  'catalog falls back to the rest-of-world price'
);
select is(
  (
    select name_en
    from public.get_public_package_catalog('EG', now())
    where package_id = '66000000-0000-4000-8000-000000000001'
  ),
  'Catalog package',
  'catalog returns bilingual package content'
);
reset role;

select * from finish();
rollback;
