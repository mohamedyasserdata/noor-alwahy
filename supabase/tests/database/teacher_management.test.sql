begin;

select plan(17);

select has_function('public', 'upsert_teacher', array['jsonb'], 'teacher upsert RPC exists');
select has_function('public', 'accept_teacher_code_of_conduct', array[]::text[], 'conduct acceptance RPC exists');
select is(has_function_privilege('anon', 'public.upsert_teacher(jsonb)', 'execute'), false, 'anonymous cannot manage teachers');
select is(has_function_privilege('anon', 'public.accept_teacher_code_of_conduct()', 'execute'), false, 'anonymous cannot accept conduct');

select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
insert into public.tracks (id, code, name_ar, name_en) values
  ('d2000000-0000-4000-8000-000000000001', 'teacher-test', 'مسار المدرس', 'Teacher test');
select lives_ok(
  $$select public.upsert_teacher('{"profile_id":"10000000-0000-4000-8000-000000000002","gender":"male","specialization":"Quran","ijazah_info":[{"riwaya":"Hafs","sanad":"Verified"}],"max_students":12,"status":"pending","identity_verified":true,"track_ids":["d2000000-0000-4000-8000-000000000001"]}')$$,
  'AAL2 admin creates a pending verified teacher'
);
select is((select count(*)::integer from public.teacher_tracks where track_id = 'd2000000-0000-4000-8000-000000000001'), 1, 'teacher tracks are replaced atomically');
select ok((select identity_verified_at is not null from public.teachers where profile_id = '10000000-0000-4000-8000-000000000002'), 'identity verification is timestamped');
select throws_ok(
  $$select public.upsert_teacher(jsonb_build_object('teacher_id',(select id from public.teachers where profile_id='10000000-0000-4000-8000-000000000002'),'profile_id','10000000-0000-4000-8000-000000000002','gender','male','max_students',12,'status','active','identity_verified',true,'track_ids',jsonb_build_array('d2000000-0000-4000-8000-000000000001')))$$,
  '23514', 'teacher_activation_requirements', 'activation is blocked before conduct acceptance'
);

reset role;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select lives_ok($$select public.accept_teacher_code_of_conduct()$$, 'the teacher accepts the conduct code');
select ok((select code_of_conduct_accepted_at is not null from public.teachers), 'conduct acceptance is timestamped');
select lives_ok($$insert into public.teacher_availability (teacher_id,weekday,start_time,end_time) select id,1,'09:00','10:00' from public.teachers$$, 'teacher proposes their own availability');
select throws_ok($$update public.teacher_availability set status='approved' returning id$$, '42501', null, 'teacher cannot approve availability');
select throws_ok($$select public.upsert_teacher('{}')$$, '42501', 'admin_access_required', 'teacher cannot manage teacher profiles');

reset role;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
select lives_ok($$update public.teacher_availability set status='approved'$$, 'admin approves proposed availability');
select lives_ok(
  $$select public.upsert_teacher(jsonb_build_object('teacher_id',(select id from public.teachers where profile_id='10000000-0000-4000-8000-000000000002'),'profile_id','10000000-0000-4000-8000-000000000002','gender','male','specialization','Quran','ijazah_info','[]'::jsonb,'max_students',12,'status','active','identity_verified',true,'track_ids',jsonb_build_array('d2000000-0000-4000-8000-000000000001')))$$,
  'admin activates a verified teacher who accepted the code'
);
select is((select status from public.teachers), 'active', 'teacher is active');
select ok((select count(*) >= 4 from public.audit_logs where table_name in ('teachers','teacher_tracks','teacher_availability')), 'teacher changes are audited');

select * from finish();
rollback;
