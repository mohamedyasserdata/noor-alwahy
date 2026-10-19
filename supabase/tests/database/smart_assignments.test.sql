begin;

select plan(18);

insert into auth.users (id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
 ('f7000000-0000-4000-8000-000000000001','authenticated','authenticated','smart.one@test.local','{"role":"teacher"}','{"full_name":"Available Male"}',now(),now()),
 ('f7000000-0000-4000-8000-000000000002','authenticated','authenticated','smart.two@test.local','{"role":"teacher"}','{"full_name":"Full Male"}',now(),now()),
 ('f7000000-0000-4000-8000-000000000003','authenticated','authenticated','smart.three@test.local','{"role":"teacher"}','{"full_name":"Female Teacher"}',now(),now()),
 ('f7000000-0000-4000-8000-000000000004','authenticated','authenticated','smart.four@test.local','{"role":"teacher"}','{"full_name":"Alternative Male"}',now(),now());
insert into public.tracks (id,code,name_ar,name_en) values ('f7100000-0000-4000-8000-000000000001','smart-test','ذكي','Smart');
insert into public.teachers (id,profile_id,gender,max_students,status,identity_verified_at,code_of_conduct_accepted_at) values
 ('f7200000-0000-4000-8000-000000000001','f7000000-0000-4000-8000-000000000001','male',7,'active',now(),now()),
 ('f7200000-0000-4000-8000-000000000002','f7000000-0000-4000-8000-000000000002','male',1,'active',now(),now()),
 ('f7200000-0000-4000-8000-000000000003','f7000000-0000-4000-8000-000000000003','female',10,'active',now(),now()),
 ('f7200000-0000-4000-8000-000000000004','f7000000-0000-4000-8000-000000000004','male',3,'active',now(),now());
insert into public.teacher_tracks (teacher_id,track_id) select id,'f7100000-0000-4000-8000-000000000001' from public.teachers where id::text like 'f7200000-%';
insert into public.teacher_availability (teacher_id,weekday,start_time,end_time,status) values ('f7200000-0000-4000-8000-000000000001',1,'09:00','11:00','approved');
insert into public.students (id,full_name,gender,joined_at) values
 ('f7300000-0000-4000-8000-000000000001','Target Male','male',current_date),
 ('f7300000-0000-4000-8000-000000000002','Capacity Student','male',current_date),
 ('f7300000-0000-4000-8000-000000000003','Female Student','female',current_date);
insert into public.teacher_assignments (student_id,teacher_id,track_id,assigned_by,reason) values ('f7300000-0000-4000-8000-000000000002','f7200000-0000-4000-8000-000000000002','f7100000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','Fill capacity');
insert into public.students (full_name,gender,joined_at)
select 'Load Student ' || number,'male',current_date from generate_series(1,6) number;
insert into public.teacher_assignments (student_id,teacher_id,track_id,assigned_by,reason)
select id,'f7200000-0000-4000-8000-000000000001','f7100000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','Existing load'
from public.students where full_name like 'Load Student %';

select has_function('public','suggest_teachers',array['uuid','uuid'],'suggestion RPC exists');
select has_function('public','manage_teacher_assignment',array['uuid','uuid','uuid','text','text'],'assignment workflow RPC exists');
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
set local role authenticated;
select is((select count(*)::integer from public.suggest_teachers('f7300000-0000-4000-8000-000000000001','f7100000-0000-4000-8000-000000000001')),2,'only matching teachers with capacity are suggested');
select is((select teacher_id from public.suggest_teachers('f7300000-0000-4000-8000-000000000001','f7100000-0000-4000-8000-000000000001') limit 1),'f7200000-0000-4000-8000-000000000001'::uuid,'opposite gender and full teacher never appear');
select is((select approved_slots from public.suggest_teachers('f7300000-0000-4000-8000-000000000001','f7100000-0000-4000-8000-000000000001') limit 1),1,'approved availability contributes to ranking');
select is((select near_capacity from public.suggest_teachers('f7300000-0000-4000-8000-000000000001','f7100000-0000-4000-8000-000000000001') limit 1),true,'85 percent capacity warning is returned');
select lives_ok($$select public.manage_teacher_assignment('f7300000-0000-4000-8000-000000000001','f7200000-0000-4000-8000-000000000001','f7100000-0000-4000-8000-000000000001','Initial assignment','assign')$$,'admin assigns a suggested teacher');
select throws_ok($$select public.manage_teacher_assignment('f7300000-0000-4000-8000-000000000003','f7200000-0000-4000-8000-000000000001','f7100000-0000-4000-8000-000000000001','Wrong gender','assign')$$,'P0001','gender_mismatch','RPC cannot bypass gender trigger');
select throws_ok($$insert into public.teacher_assignments (student_id,teacher_id,track_id,assigned_by,reason) values ('f7300000-0000-4000-8000-000000000001','f7200000-0000-4000-8000-000000000002','f7100000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','Over capacity')$$,'P0001','teacher_capacity_reached','direct SQL cannot exceed teacher capacity');
select throws_ok($$select public.manage_teacher_assignment('f7300000-0000-4000-8000-000000000001','f7200000-0000-4000-8000-000000000003','f7100000-0000-4000-8000-000000000001','Wrong-gender change','change')$$,'P0001','gender_mismatch','failed change rolls back ending the current assignment');
select is((select teacher_id from public.teacher_assignments where student_id='f7300000-0000-4000-8000-000000000001' and status='active'),'f7200000-0000-4000-8000-000000000001'::uuid,'failed change preserves the original assignment');
select lives_ok($$select public.manage_teacher_assignment('f7300000-0000-4000-8000-000000000001','f7200000-0000-4000-8000-000000000004','f7100000-0000-4000-8000-000000000001','Approved teacher change','change')$$,'same-gender teacher change succeeds');
select is((select count(*)::integer from public.teacher_assignments where student_id='f7300000-0000-4000-8000-000000000001' and status='ended'),1,'teacher change preserves ended history');
select lives_ok($$select public.manage_teacher_assignment('f7300000-0000-4000-8000-000000000001','f7200000-0000-4000-8000-000000000004','f7100000-0000-4000-8000-000000000001','Approved leave','pause')$$,'assignment can be paused');
select lives_ok($$select public.manage_teacher_assignment('f7300000-0000-4000-8000-000000000001','f7200000-0000-4000-8000-000000000004','f7100000-0000-4000-8000-000000000001','Return from leave','resume')$$,'assignment can resume');
select lives_ok($$select public.manage_teacher_assignment('f7300000-0000-4000-8000-000000000001','f7200000-0000-4000-8000-000000000004','f7100000-0000-4000-8000-000000000001','Program ended','end')$$,'assignment can end while history remains');
select is((select count(*)::integer from public.teacher_assignments where student_id='f7300000-0000-4000-8000-000000000001'),2,'complete assignment history is retained');

reset role;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}',true);
set local role authenticated;
select throws_ok($$select * from public.suggest_teachers('f7300000-0000-4000-8000-000000000001','f7100000-0000-4000-8000-000000000001')$$,'42501','admin_access_required','non-admin cannot enumerate suggestions');

select * from finish();
rollback;
