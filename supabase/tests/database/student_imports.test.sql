begin;

select plan(15);

select has_table('public', 'student_import_batches', 'student import batches table exists');
select is((select relrowsecurity from pg_class where oid = 'public.student_import_batches'::regclass), true, 'student import batches use RLS');
select is(has_function_privilege('anon', 'public.confirm_student_import(uuid)', 'execute'), false, 'anonymous callers cannot confirm imports');
select is(has_function_privilege('authenticated', 'public.confirm_student_import(uuid)', 'execute'), true, 'authenticated callers reach confirmation for authorization');

select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;

select lives_ok(
  $$insert into public.student_import_batches (id,created_by,source_name,row_count,payload) values (
    'c1000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','valid.xlsx',2,
    '[{"full_name":"Imported Student One","gender":"male","birth_date":"2014-01-01","status":"active","level_id":null,"joined_at":"2026-10-19","country_code":"EG","timezone":"Africa/Cairo","health_notes":null,"special_notes":null,"share_with_teacher":false},{"full_name":"Imported Student Two","gender":"female","birth_date":null,"status":"active","level_id":null,"joined_at":"2026-10-19","country_code":null,"timezone":"Africa/Cairo","health_notes":"private sentinel","special_notes":null,"share_with_teacher":true}]'
  )$$,
  'an AAL2 admin stages a validated import'
);
select is(public.confirm_student_import('c1000000-0000-4000-8000-000000000001'), 2, 'confirmation imports every row in one call');
select is((select count(*)::integer from public.students where full_name like 'Imported Student%'), 2, 'both valid students are created');
select is((select status || ':' || jsonb_array_length(payload)::text from public.student_import_batches where id = 'c1000000-0000-4000-8000-000000000001'), 'confirmed:0', 'confirmation clears sensitive staging payload');
select is((select count(*)::integer from public.audit_logs where action = 'IMPORT' and table_name = 'students' and record_id = 'c1000000-0000-4000-8000-000000000001' and after ->> 'record_count' = '2'), 1, 'the import count and source are audited');

select lives_ok(
  $$insert into public.student_import_batches (id,created_by,source_name,row_count,payload) values (
    'c1000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','duplicate.xlsx',2,
    '[{"full_name":"Must Roll Back","gender":"male","birth_date":"2015-02-02","status":"active","level_id":null,"joined_at":"2026-10-19","country_code":null,"timezone":"Africa/Cairo","health_notes":null,"special_notes":null,"share_with_teacher":false},{"full_name":"Imported Student One","gender":"male","birth_date":"2014-01-01","status":"active","level_id":null,"joined_at":"2026-10-19","country_code":"EG","timezone":"Africa/Cairo","health_notes":null,"special_notes":null,"share_with_teacher":false}]'
  )$$,
  'a second validated batch is staged'
);
select throws_ok($$select public.confirm_student_import('c1000000-0000-4000-8000-000000000002')$$, '23505', 'duplicate_student', 'a race-time duplicate rejects the whole import');
select is((select count(*)::integer from public.students where full_name = 'Must Roll Back'), 0, 'a duplicate leaves no earlier row partially imported');
select throws_ok($$update public.student_import_batches set source_name = 'tampered.xlsx' where id = 'c1000000-0000-4000-8000-000000000002'$$, '42501', null, 'even an admin cannot directly mutate a staged batch');

reset role;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select throws_ok($$insert into public.student_import_batches (created_by,source_name,row_count,payload) values ('10000000-0000-4000-8000-000000000001','blocked.xlsx',1,'[{}]')$$, '42501', null, 'an AAL1 admin cannot stage an import');
select throws_ok($$select public.confirm_student_import('c1000000-0000-4000-8000-000000000002')$$, '42501', 'admin_access_required', 'an AAL1 admin cannot confirm an import');

select * from finish();
rollback;
