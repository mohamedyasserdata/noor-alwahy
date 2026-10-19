begin;

select plan(19);

insert into public.tracks (id, code, name_ar, name_en)
values ('a2000000-0000-4000-8000-000000000001', 'student-management', 'إدارة الطلاب', 'Student management');
insert into public.levels (id, track_id, name_ar, name_en)
values ('a3000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000001', 'مستوى الاختبار', 'Test level');

select is(has_function_privilege('anon', 'public.upsert_student(jsonb)', 'execute'), false, 'anonymous callers cannot execute student upsert');
select is(has_function_privilege('anon', 'public.archive_student(uuid)', 'execute'), false, 'anonymous callers cannot execute student archive');
select is(has_function_privilege('anon', 'public.record_student_export(integer)', 'execute'), false, 'anonymous callers cannot record exports');
select is(has_function_privilege('authenticated', 'public.upsert_student(jsonb)', 'execute'), true, 'authenticated callers reach student upsert for RLS authorization');

select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;

select is(
  public.upsert_student('{"full_name":"Managed Student","gender":"female","birth_date":"2014-05-10","status":"active","level_id":"a3000000-0000-4000-8000-000000000001","joined_at":"2026-10-19","country_code":"EG","timezone":"Africa/Cairo","health_notes":"secret-health-sentinel","special_notes":"secret-special-sentinel","share_with_teacher":true}'::jsonb) is not null,
  true,
  'an AAL2 administrator atomically creates a student and private notes'
);
select is((select count(*)::integer from public.students where full_name = 'Managed Student'), 1, 'the student record is created once');
select ok((select student_no like 'NW-%' from public.students where full_name = 'Managed Student'), 'the generated student number uses the academy prefix');
select is((select count(*)::integer from public.get_student_private_notes((select id from public.students where full_name = 'Managed Student'))), 1, 'the private notes row is created and available only through audited access');
select is((select share_with_teacher from public.get_student_private_notes((select id from public.students where full_name = 'Managed Student'))), true, 'audited private-note access returns the sharing preference');
select is((select count(*)::integer from public.audit_logs where table_name = 'students' and action = 'INSERT' and record_id = (select id::text from public.students where full_name = 'Managed Student')), 1, 'student creation is audited');
select is((select count(*)::integer from public.audit_logs where table_name = 'student_private_notes' and action = 'INSERT'), 1, 'private-note creation is audited');
select is((select count(*)::integer from public.audit_logs where coalesce(before::text, '') || coalesce(after::text, '') like '%secret-%'), 0, 'audit history never copies sensitive note text');

select is(
  public.upsert_student(jsonb_build_object('student_id', (select id from public.students where full_name = 'Managed Student'), 'full_name', 'Managed Student Updated', 'gender', 'female', 'birth_date', '2014-05-10', 'status', 'suspended', 'level_id', 'a3000000-0000-4000-8000-000000000001', 'joined_at', '2026-10-19', 'country_code', 'EG', 'timezone', 'Africa/Cairo', 'health_notes', '', 'special_notes', 'updated-secret-sentinel', 'share_with_teacher', false)) is not null,
  true,
  'the atomic RPC updates the student and notes'
);
select is((select status::text from public.students where full_name = 'Managed Student Updated'), 'suspended', 'the student status is updated');
select lives_ok($$select public.archive_student((select id from public.students where full_name = 'Managed Student Updated'))$$, 'the administrator archives without deleting the record');
select is((select status::text from public.students where full_name = 'Managed Student Updated'), 'archived', 'archive preserves the student and changes its status');
select lives_ok($$select public.record_student_export(1)$$, 'the administrator records a student export');
select is((select count(*)::integer from public.audit_logs where action = 'EXPORT' and table_name = 'students' and after = '{"record_count": 1}'::jsonb), 1, 'the export audit stores only a record count');

reset role;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select throws_ok(
  $$select public.upsert_student('{"full_name":"Blocked Student","gender":"male","status":"active","joined_at":"2026-10-19","timezone":"Africa/Cairo"}'::jsonb)$$,
  '42501',
  null,
  'an AAL1 administrator cannot create a student'
);

select * from finish();
rollback;
