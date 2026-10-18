begin;

select plan(27);

select is(has_table_privilege('anon', 'public.app_settings', 'select'), false, 'anonymous callers do not receive table-wide select');
select is(has_column_privilege('anon', 'public.app_settings', 'key', 'select'), true, 'anonymous callers can select public setting keys');
select is(has_column_privilege('anon', 'public.app_settings', 'value', 'select'), true, 'anonymous callers can select public setting values');
select is(has_column_privilege('anon', 'public.app_settings', 'updated_by', 'select'), false, 'anonymous callers cannot select update metadata');
select is(has_function_privilege('anon', 'public.update_public_app_settings(jsonb,jsonb)', 'execute'), false, 'anonymous callers cannot execute the settings RPC');
select is(has_function_privilege('authenticated', 'public.update_public_app_settings(jsonb,jsonb)', 'execute'), true, 'authenticated callers reach the RPC for RLS to authorize');

insert into public.app_settings (key, value)
values ('internal.test', '{"secret":"not public"}');

set local role anon;
select is((select count(*)::integer from public.app_settings), 2, 'anonymous visitors read only the two public settings');
select is((select value ->> 'name_en' from public.app_settings where key = 'academy_profile'), 'Noor Al-Wahy Academy'::text, 'the public academy profile is readable');
select throws_ok(
  $$update public.app_settings set value = '{"ar":"changed","en":"changed"}' where key = 'support_hours'$$,
  '42501',
  'permission denied for table app_settings',
  'anonymous visitors cannot update settings'
);

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}',
  true
);
set local role authenticated;

select is((select count(*)::integer from public.app_settings), 2, 'a non-admin reads public settings only');
select is((select count(*)::integer from public.app_settings where key = 'internal.test'), 0, 'a non-admin cannot read internal settings');

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',
  true
);
set local role authenticated;

select is((select count(*)::integer from public.app_settings), 2, 'an AAL1 admin still reads public settings only');
update public.app_settings set value = '{"ar":"changed","en":"changed"}' where key = 'support_hours';
select throws_ok(
  $$select public.update_public_app_settings(
    '{"name_ar":"أكاديمية نور الوحي","name_en":"Noor","description_ar":"وصف صالح","description_en":"Valid description","logo_url":null}',
    '{"ar":"الأحد إلى الخميس","en":"Sunday to Thursday"}'
  )$$,
  'P0001',
  'academy_profile_missing',
  'an AAL1 admin cannot use the settings RPC'
);

reset role;
select is((select value ->> 'en' from public.app_settings where key = 'support_hours'), 'Responses are provided during the academy’s announced working hours.'::text, 'an AAL1 admin cannot update settings');

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',
  true
);
set local role authenticated;

select is((select count(*)::integer from public.app_settings), 3, 'an AAL2 admin reads public and internal settings');
select lives_ok(
  $$insert into public.app_settings (key, value) values ('internal.audit_probe', '{"enabled":true}')$$,
  'an AAL2 admin creates a setting'
);
select lives_ok(
  $$update public.app_settings set value = '{"enabled":false}' where key = 'internal.audit_probe'$$,
  'an AAL2 admin updates a setting'
);
select lives_ok(
  $$delete from public.app_settings where key = 'internal.audit_probe'$$,
  'an AAL2 admin deletes a setting'
);
select is(
  (
    select count(*)::integer
    from public.audit_logs
    where table_name = 'app_settings'
      and record_id = 'internal.audit_probe'
      and user_id = '10000000-0000-4000-8000-000000000001'
  ),
  3,
  'each setting change is audited with the AAL2 administrator'
);
select lives_ok(
  $$update public.app_settings set value = jsonb_set(value, '{name_en}', '"Noor Academy"') where key = 'academy_profile'$$,
  'an AAL2 admin updates the public academy profile'
);
reset role;
select is(
  (select updated_by from public.app_settings where key = 'academy_profile'),
  '10000000-0000-4000-8000-000000000001'::uuid,
  'the database records the administrator who updated the setting'
);
set local role authenticated;
select lives_ok(
  $$select public.update_public_app_settings(
    '{"name_ar":"أكاديمية نور الوحي","name_en":"Noor Al-Wahy Academy","description_ar":"تعليم قرآني آمن وواضح","description_en":"Safe and clear Quran learning","logo_url":"/icon.svg"}',
    '{"ar":"الأحد إلى الخميس","en":"Sunday to Thursday"}'
  )$$,
  'the AAL2 admin updates both public settings atomically through the RPC'
);
select is(
  (select value ->> 'logo_url' from public.app_settings where key = 'academy_profile'),
  '/icon.svg'::text,
  'the academy logo path is stored'
);
select throws_ok(
  $$select public.update_public_app_settings(
    '{"name_ar":"","name_en":"Noor","description_ar":"وصف صالح","description_en":"Valid description","logo_url":null}',
    '{"ar":"قيمة لا يجب حفظها","en":"This must not persist"}'
  )$$,
  '23514',
  null,
  'an invalid academy profile rejects the atomic update'
);
select is(
  (select value ->> 'en' from public.app_settings where key = 'support_hours'),
  'Sunday to Thursday'::text,
  'a failed atomic update leaves support hours unchanged'
);
select throws_ok(
  $$update public.app_settings set value = jsonb_set(value, '{logo_url}', '"https://example.test/logo.svg"') where key = 'academy_profile'$$,
  '23514',
  null,
  'the database rejects an external logo URL'
);
select throws_ok(
  $$update public.app_settings set value = value || '{"private_note":"must not become public"}' where key = 'academy_profile'$$,
  '23514',
  null,
  'the database rejects extra fields in public settings'
);

select * from finish();

rollback;
