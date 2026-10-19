begin;
select plan(14);

insert into public.tracks(id,code,name_ar,name_en) values ('f8100000-0000-4000-8000-000000000001','schedule-test','جدول','Schedule');
insert into public.teachers(id,profile_id,gender,max_students,status,identity_verified_at,code_of_conduct_accepted_at)
values ('f8200000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','male',5,'active',now(),now());
insert into public.teacher_tracks values ('f8200000-0000-4000-8000-000000000001','f8100000-0000-4000-8000-000000000001',now(),now());
insert into public.students(id,profile_id,full_name,gender,timezone) values
 ('f8300000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000003','Schedule Student','male','Africa/Cairo'),
 ('f8300000-0000-4000-8000-000000000002',null,'Other Student','male','Asia/Riyadh');
insert into public.guardians(id,profile_id) values ('f8400000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000004');
insert into public.student_guardians(student_id,guardian_id,is_primary) values ('f8300000-0000-4000-8000-000000000001','f8400000-0000-4000-8000-000000000001',true);
insert into public.teacher_assignments(id,student_id,teacher_id,track_id,assigned_by,reason) values
 ('f8500000-0000-4000-8000-000000000001','f8300000-0000-4000-8000-000000000001','f8200000-0000-4000-8000-000000000001','f8100000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','Schedule test'),
 ('f8500000-0000-4000-8000-000000000002','f8300000-0000-4000-8000-000000000002','f8200000-0000-4000-8000-000000000001','f8100000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','Other schedule');

select has_function('public','get_visible_schedule',array[]::text[],'safe schedule reader exists');
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
set local role authenticated;
select lives_ok($$insert into public.schedule_slots(assignment_id,weekday,local_start_time,duration_min,anchor_timezone) values ('f8500000-0000-4000-8000-000000000001',5,'18:00',30,'Africa/Cairo')$$,'admin creates weekly slot');
select throws_ok($$insert into public.schedule_slots(assignment_id,weekday,local_start_time,duration_min,anchor_timezone) values ('f8500000-0000-4000-8000-000000000001',5,'19:00',30,'Not/AZone')$$,'22023','invalid_anchor_timezone','invalid timezone is rejected in database');
select is((select count(*)::integer from public.get_visible_schedule()),1,'admin reads active visible schedule');

reset role;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}',true);
set local role authenticated;
select is((select count(*)::integer from public.get_visible_schedule()),1,'teacher reads own assigned schedule only');
select throws_ok($$insert into public.schedule_slots(assignment_id,weekday,local_start_time,duration_min,anchor_timezone) values ('f8500000-0000-4000-8000-000000000002',4,'18:00',30,'Asia/Riyadh') returning id$$,'42501',null,'teacher cannot create slots');

reset role;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}',true);
set local role authenticated;
select is((select count(*)::integer from public.get_visible_schedule()),1,'student reads own schedule only');
select is((select student_name from public.get_visible_schedule()),'Schedule Student','student safe view returns own identity');

reset role;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal1"}',true);
set local role authenticated;
select is((select count(*)::integer from public.get_visible_schedule()),1,'parent reads child schedule only');

reset role;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000005","role":"authenticated","aal":"aal1"}',true);
set local role authenticated;
select is((select count(*)::integer from public.get_visible_schedule()),0,'unrelated user reads no schedule');

reset role;
select set_config('request.jwt.claims','{"role":"anon"}',true);
set local role anon;
select throws_ok($$select * from public.get_visible_schedule()$$,'42501',null,'anonymous cannot execute schedule reader');
select throws_ok($$select * from public.schedule_slots$$,'42501',null,'anonymous cannot read raw slots');

reset role;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
set local role authenticated;
update public.teacher_assignments set status='paused' where id='f8500000-0000-4000-8000-000000000001';
select throws_ok($$insert into public.schedule_slots(assignment_id,weekday,local_start_time,duration_min,anchor_timezone) values ('f8500000-0000-4000-8000-000000000001',6,'18:00',30,'Africa/Cairo')$$,'P0001','active_assignment_required','paused assignment cannot receive a new slot');
select is((select count(*)::integer from public.get_visible_schedule()),0,'paused assignment is hidden from schedule');

select * from finish();
rollback;
