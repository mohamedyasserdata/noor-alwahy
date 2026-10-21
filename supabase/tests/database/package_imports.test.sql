begin;

select no_plan();
select has_table('public', 'package_import_batches', 'package import batches table exists');
select has_function('public', 'confirm_package_import', array['uuid'], 'atomic package import confirmation exists');
select is((select relrowsecurity from pg_class where oid = 'public.package_import_batches'::regclass), true, 'package import batch RLS is enabled');
select is(has_function_privilege('anon', 'public.confirm_package_import(uuid)', 'execute'), false, 'anonymous user cannot confirm imports');

select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;

insert into public.package_import_batches(id, created_by, source_name, package_count, price_count, payload)
values (
  '64000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  'packages.xlsx', 1, 1,
  jsonb_build_array(jsonb_build_object(
    'package_id', '', 'slug', 'imported-package', 'track_id', '', 'name_ar', 'باقة مستوردة',
    'name_en', 'Imported package', 'description_ar', '', 'description_en', '', 'audience', 'adult',
    'teacher_gender', '', 'sessions_per_week', 2, 'duration_min', 30, 'billing_period', 'monthly',
    'features', '[]'::jsonb,
    'policy', '{"cancel_notice_hours":12,"max_makeups_per_period":2,"makeup_valid_days":30,"late_tolerance_min":10,"student_no_show_consumes_credit":true,"student_no_show_pays_teacher":true,"partial_refund_pct":0,"max_pause_days":30,"trial":{"enabled":false,"price_pct":0}}'::jsonb,
    'prices', jsonb_build_array(jsonb_build_object('country_code','ZZ','currency','USD','amount','35','min_amount','','max_amount','','is_active',true,'valid_from',(now() - interval '1 second')::text)),
    'is_published', true
  ))
);
select is(public.confirm_package_import('64000000-0000-4000-8000-000000000001'), 1, 'valid batch imports one package');
select is((select count(*)::integer from public.packages where slug = 'imported-package'), 1, 'confirmed batch persists package');
select is((select status from public.package_import_batches where id = '64000000-0000-4000-8000-000000000001'), 'confirmed', 'confirmed batch transitions once');
select is((select payload from public.package_import_batches where id = '64000000-0000-4000-8000-000000000001'), '[]'::jsonb, 'confirmed payload is erased');

insert into public.package_import_batches(id, created_by, source_name, package_count, price_count, payload)
values (
  '64000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000001',
  'atomic.xlsx', 1, 1,
  jsonb_build_array(jsonb_build_object(
    'package_id', '', 'slug', 'atomic-rollback', 'track_id', '', 'name_ar', 'باقة تراجع',
    'audience', 'adult', 'teacher_gender', '', 'sessions_per_week', 2, 'duration_min', 30,
    'billing_period', 'monthly', 'features', '[]'::jsonb,
    'policy', '{"cancel_notice_hours":12,"max_makeups_per_period":2,"makeup_valid_days":30,"late_tolerance_min":10,"student_no_show_consumes_credit":true,"student_no_show_pays_teacher":true,"partial_refund_pct":0,"max_pause_days":30,"trial":{"enabled":false,"price_pct":0}}'::jsonb,
    'prices', jsonb_build_array(jsonb_build_object('country_code','XX','currency','USD','amount','35','is_active',true,'valid_from',now()::text)),
    'is_published', false
  ))
);
select throws_ok(
  $$select public.confirm_package_import('64000000-0000-4000-8000-000000000002')$$,
  '23503', null, 'one invalid price rolls back the entire confirmed import'
);
select is((select count(*)::integer from public.packages where slug = 'atomic-rollback'), 0, 'failed import leaves no partial package');
select is((select status from public.package_import_batches where id = '64000000-0000-4000-8000-000000000002'), 'pending', 'failed import remains pending');
reset role;

select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select throws_ok($$select public.confirm_package_import('64000000-0000-4000-8000-000000000002')$$, '42501', 'admin_mfa_required', 'AAL1 administrator cannot confirm imports');
reset role;

select * from finish();
rollback;
