begin;

select plan(21);

select is(has_function_privilege('anon', 'public.upsert_student_guardian(uuid,uuid,text,boolean,boolean)', 'execute'), false, 'anonymous callers cannot link parents');
select is(has_function_privilege('anon', 'public.remove_student_guardian(uuid,uuid)', 'execute'), false, 'anonymous callers cannot unlink parents');
select is(has_function_privilege('authenticated', 'public.upsert_student_guardian(uuid,uuid,text,boolean,boolean)', 'execute'), true, 'authenticated callers reach parent linking for authorization');
select is(has_function_privilege('authenticated', 'public.remove_student_guardian(uuid,uuid)', 'execute'), true, 'authenticated callers reach parent unlinking for authorization');

insert into public.students (id, gender, full_name)
values
  ('b4000000-0000-4000-8000-000000000001', 'male', 'Family Student One'),
  ('b4000000-0000-4000-8000-000000000002', 'female', 'Family Student Two');

insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('b1000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'family.parent@example.test', '{"role":"parent","created_by":"10000000-0000-4000-8000-000000000001"}', '{"full_name":"Second Family Parent","created_by":"10000000-0000-4000-8000-000000000001"}', now(), now()),
  ('b1000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'family.student@example.test', '{"role":"student","created_by":"10000000-0000-4000-8000-000000000001"}', '{"full_name":"Family Student One","gender":"male","student_id":"b4000000-0000-4000-8000-000000000001","created_by":"10000000-0000-4000-8000-000000000001"}', now(), now()),
  ('b1000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'forged.student@example.test', '{"role":"student"}', '{"full_name":"Forged Student Link","gender":"female","student_id":"b4000000-0000-4000-8000-000000000002","created_by":"10000000-0000-4000-8000-000000000001"}', now(), now());

select is((select profile_id from public.students where id = 'b4000000-0000-4000-8000-000000000001'), 'b1000000-0000-4000-8000-000000000002'::uuid, 'student account provisioning links the existing student atomically');
select is((select count(*)::integer from public.guardians where profile_id = 'b1000000-0000-4000-8000-000000000001'), 1, 'parent account provisioning creates its guardian row atomically');
select is((select profile_id from public.students where id = 'b4000000-0000-4000-8000-000000000002'), null, 'forged user metadata cannot link a student without trusted app metadata');

select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;

select lives_ok($$select public.upsert_student_guardian('b4000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000004','father',false,true)$$, 'the admin links an existing parent account');
select is((select count(*)::integer from public.guardians where profile_id = '10000000-0000-4000-8000-000000000004'), 1, 'linking creates the missing guardian row');
select lives_ok($$select public.upsert_student_guardian('b4000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000004','father',true,true)$$, 'one parent can be linked to a second child');
select is((select count(*)::integer from public.student_guardians where guardian_id = (select id from public.guardians where profile_id = '10000000-0000-4000-8000-000000000004')), 2, 'one parent retains both child links');
select lives_ok($$select public.upsert_student_guardian('b4000000-0000-4000-8000-000000000001','b1000000-0000-4000-8000-000000000001','mother',true,false)$$, 'a student can be linked to a second parent');
select is((select count(*)::integer from public.student_guardians where student_id = 'b4000000-0000-4000-8000-000000000001'), 2, 'the student retains both parent links');
select is((select count(*)::integer from public.student_guardians where student_id = 'b4000000-0000-4000-8000-000000000001' and is_primary), 1, 'the student has exactly one primary parent');
select lives_ok($$select public.upsert_student_guardian('b4000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000004','father',true,true)$$, 'changing the primary parent is atomic');
select is((select is_primary from public.student_guardians where student_id = 'b4000000-0000-4000-8000-000000000001' and guardian_id = (select id from public.guardians where profile_id = 'b1000000-0000-4000-8000-000000000001')), false, 'the previous primary parent is demoted');
select ok((select count(*) from public.audit_logs where table_name = 'student_guardians' and action in ('INSERT','UPDATE')) >= 4, 'every family-link mutation is audited');
select lives_ok($$select public.remove_student_guardian('b4000000-0000-4000-8000-000000000001',(select id from public.guardians where profile_id = 'b1000000-0000-4000-8000-000000000001'))$$, 'the admin removes one relationship without deleting either person');
select is((select count(*)::integer from public.student_guardians where student_id = 'b4000000-0000-4000-8000-000000000001'), 1, 'unlinking preserves the other parent relationship');

reset role;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select throws_ok($$select public.upsert_student_guardian('b4000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000004','father',false,false)$$, '42501', 'admin_access_required', 'an AAL1 admin cannot change family links');

reset role;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select throws_ok($$select public.remove_student_guardian('b4000000-0000-4000-8000-000000000002',(select id from public.guardians where profile_id = '10000000-0000-4000-8000-000000000004'))$$, '42501', 'admin_access_required', 'a parent cannot change family links');

select * from finish();
rollback;
