begin;

select plan(25);

insert into auth.users (id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values ('e6000000-0000-4000-8000-000000000001','authenticated','authenticated','other.teacher@test.local','{"role":"teacher"}','{"full_name":"Other Teacher"}',now(),now());
insert into public.tracks (id,code,name_ar,name_en) values ('e6100000-0000-4000-8000-000000000001','assign-test','تعيين','Assignment');
insert into public.teachers (id,profile_id,gender,status,identity_verified_at,code_of_conduct_accepted_at) values
  ('e6200000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','male','active',now(),now()),
  ('e6200000-0000-4000-8000-000000000002','e6000000-0000-4000-8000-000000000001','male','active',now(),now());
insert into public.teacher_tracks (teacher_id,track_id) values
  ('e6200000-0000-4000-8000-000000000001','e6100000-0000-4000-8000-000000000001'),
  ('e6200000-0000-4000-8000-000000000002','e6100000-0000-4000-8000-000000000001');
insert into public.students (id,full_name,gender,joined_at) values
  ('e6300000-0000-4000-8000-000000000001','Matching Student','male',current_date),
  ('e6300000-0000-4000-8000-000000000002','Mismatched Student','female',current_date);
insert into public.student_private_notes (student_id,health_notes,special_notes,share_with_teacher) values
  ('e6300000-0000-4000-8000-000000000001','Shared health','Shared note',true),
  ('e6300000-0000-4000-8000-000000000002','Hidden health','Hidden note',false);

select has_table('public','teacher_assignments','teacher assignments table exists');
select has_table('public','schedule_slots','schedule slots table exists');
select is((select relrowsecurity from pg_class where oid='public.teacher_assignments'::regclass),true,'assignment RLS is enabled');
select is((select relrowsecurity from pg_class where oid='public.schedule_slots'::regclass),true,'slot RLS is enabled');
select has_index('public','teacher_assignments','teacher_assignments_one_current_idx','current assignment unique index exists');

select lives_ok($$insert into public.teacher_assignments (id,student_id,teacher_id,track_id,assigned_by,reason) values ('e6400000-0000-4000-8000-000000000001','e6300000-0000-4000-8000-000000000001','e6200000-0000-4000-8000-000000000001','e6100000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','Initial match')$$,'matching genders are accepted');
select throws_ok($$insert into public.teacher_assignments (student_id,teacher_id,track_id,assigned_by,reason) values ('e6300000-0000-4000-8000-000000000002','e6200000-0000-4000-8000-000000000001','e6100000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','Wrong gender')$$,'P0001','gender_mismatch','opposite genders are rejected');
select lives_ok($$update public.teacher_assignments set teacher_id='e6200000-0000-4000-8000-000000000002',reason='Temporary same-gender alternative' where id='e6400000-0000-4000-8000-000000000001'$$,'same-gender alternative is accepted');
select throws_ok($$update public.students set gender='female' where id='e6300000-0000-4000-8000-000000000001'$$,'P0001','gender_change_blocked_active_assignment','assigned student gender cannot change');
select throws_ok($$update public.teachers set gender='female' where id='e6200000-0000-4000-8000-000000000002'$$,'P0001','gender_change_blocked_active_assignment','assigned teacher gender cannot change');
select throws_ok($$insert into public.teacher_assignments (student_id,teacher_id,track_id,assigned_by,reason) values ('e6300000-0000-4000-8000-000000000001','e6200000-0000-4000-8000-000000000001','e6100000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','Duplicate')$$,'23505',null,'only one current assignment exists per student and track');
select lives_ok($$insert into public.schedule_slots (id,assignment_id,weekday,local_start_time,duration_min,anchor_timezone) values ('e6500000-0000-4000-8000-000000000001','e6400000-0000-4000-8000-000000000001',2,'09:00',30,'Africa/Cairo')$$,'valid weekly slot is accepted');
select throws_ok($$insert into public.schedule_slots (assignment_id,weekday,local_start_time,duration_min,anchor_timezone) values ('e6400000-0000-4000-8000-000000000001',7,'09:00',30,'Africa/Cairo')$$,'23514',null,'invalid weekday is rejected');

select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}',true);
set local role authenticated;
select is((select count(*)::integer from public.teacher_assignments),0,'replaced teacher no longer sees the assignment');
select is((select count(*)::integer from public.students where id::text like 'e6300000-%'),0,'replaced teacher sees no former student');
select throws_ok($$select count(*) from public.student_private_notes$$,'42501',null,'teacher cannot read raw private notes');
select throws_ok($$select * from public.get_shared_student_notes('e6300000-0000-4000-8000-000000000001')$$,'42501','assigned_teacher_required','former teacher cannot call shared note RPC');
select is((select count(*)::integer from public.profile_private),1,'teacher sees only their own private profile and no family contacts');

reset role;
select set_config('request.jwt.claims','{"sub":"e6000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);
set local role authenticated;
select is((select count(*)::integer from public.teacher_assignments),1,'assigned alternative sees exactly their assignment');
select is((select count(*)::integer from public.schedule_slots),1,'assigned alternative sees their weekly slot');
select is((select count(*)::integer from public.students where id::text like 'e6300000-%'),1,'assigned alternative sees only their student');
select is((select count(*)::integer from public.get_shared_student_notes('e6300000-0000-4000-8000-000000000001')),1,'assigned teacher reads explicitly shared notes through audited RPC');

reset role;
update public.teacher_assignments set status='ended',end_date=current_date where id='e6400000-0000-4000-8000-000000000001';
select lives_ok($$update public.students set gender='female' where id='e6300000-0000-4000-8000-000000000001'$$,'gender can change after the assignment ends');
select lives_ok($$update public.teachers set gender='female' where id='e6200000-0000-4000-8000-000000000002'$$,'teacher gender can change after the assignment ends');
select ok((select count(*) >= 3 from public.audit_logs where table_name in ('teacher_assignments','schedule_slots')),'assignment and slot changes are audited');

select * from finish();
rollback;
