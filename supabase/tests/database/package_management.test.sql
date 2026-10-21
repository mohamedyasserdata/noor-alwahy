begin;

select no_plan();

select has_function('public', 'save_package', array['jsonb'], 'atomic package save RPC exists');
select has_function('public', 'clone_package', array['uuid'], 'package clone RPC exists');
select has_function('public', 'reorder_packages', array['uuid[]'], 'package reorder RPC exists');
select is(has_function_privilege('anon', 'public.save_package(jsonb)', 'execute'), false, 'anonymous users cannot execute package save');

insert into public.tracks(id, code, name_ar, name_en)
values ('63000000-0000-4000-8000-000000000001', 'package-management', 'إدارة الباقات', 'Package management');

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',
  true
);
set local role authenticated;
select throws_ok(
  $$select public.save_package('{}'::jsonb)$$,
  '42501',
  'admin_mfa_required',
  'AAL1 administrator cannot use package management RPCs'
);
reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',
  true
);
set local role authenticated;

select lives_ok(
  $$select public.save_package(jsonb_build_object(
    'slug', 'managed-package',
    'track_id', '63000000-0000-4000-8000-000000000001',
    'name_ar', 'باقة مُدارة',
    'name_en', 'Managed package',
    'description_ar', 'وصف الباقة المدارة',
    'description_en', 'Managed package description',
    'audience', 'child',
    'teacher_gender', '',
    'sessions_per_week', 3,
    'duration_min', 30,
    'billing_period', 'monthly',
    'features', '[{"ar":"تقارير أسبوعية","en":"Weekly reports","icon":"star"}]'::jsonb,
    'policy', '{"cancel_notice_hours":12,"max_makeups_per_period":2,"makeup_valid_days":30,"late_tolerance_min":10,"student_no_show_consumes_credit":true,"student_no_show_pays_teacher":true,"partial_refund_pct":0,"max_pause_days":30,"trial":{"enabled":true,"price_pct":0}}'::jsonb,
    'prices', jsonb_build_array(jsonb_build_object(
      'country_code', 'ZZ', 'currency', 'USD', 'amount', '45', 'min_amount', '',
      'max_amount', '', 'is_active', true, 'valid_from', (now() - interval '1 second')::text
    )),
    'is_published', true
  ))$$,
  'AAL2 administrator creates and publishes package with prices atomically'
);
select is((select count(*)::integer from public.packages where slug = 'managed-package'), 1, 'atomic save creates one package');
select is((select count(*)::integer from public.package_prices price join public.packages package on package.id = price.package_id where package.slug = 'managed-package'), 1, 'atomic save creates package prices');

select lives_ok(
  $$select public.clone_package((select id from public.packages where slug = 'managed-package'))$$,
  'administrator clones package and current prices'
);
select is((select count(*)::integer from public.packages where slug like 'managed-package-copy-%'), 1, 'clone receives a unique draft slug');
select is((select count(*)::integer from public.packages where slug like 'managed-package-copy-%' and not is_published), 1, 'clone remains unpublished');

select lives_ok(
  $$select public.reorder_packages(array(
    select id from public.packages where slug like 'managed-package%' order by slug desc
  ))$$,
  'administrator reorders known packages'
);
select is((select count(distinct sort_order)::integer from public.packages where slug like 'managed-package%'), 2, 'reorder assigns distinct positions');

select throws_ok(
  $$select public.save_package(jsonb_build_object(
    'slug', 'rolled-back-package', 'name_ar', 'باقة متراجعة', 'track_id', '',
    'audience', 'adult', 'teacher_gender', '', 'sessions_per_week', 2, 'duration_min', 30,
    'billing_period', 'monthly', 'features', '[]'::jsonb,
    'policy', '{"cancel_notice_hours":12,"max_makeups_per_period":2,"makeup_valid_days":30,"late_tolerance_min":10,"student_no_show_consumes_credit":true,"student_no_show_pays_teacher":true,"partial_refund_pct":0,"max_pause_days":30,"trial":{"enabled":false,"price_pct":0}}'::jsonb,
    'prices', jsonb_build_array(
      jsonb_build_object('country_code','ZZ','currency','USD','amount','40','is_active',true,'valid_from',now()::text),
      jsonb_build_object('country_code','XX','currency','USD','amount','40','is_active',true,'valid_from',now()::text)
    ), 'is_published', false
  ))$$,
  '23503',
  null,
  'invalid second price rolls back the entire package save'
);
select is((select count(*)::integer from public.packages where slug = 'rolled-back-package'), 0, 'failed atomic save leaves no partial package');

reset role;
select * from finish();
rollback;
