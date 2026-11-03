begin;

select plan(19);

select has_column('public', 'attendance', 'student_id', 'attendance identifies the participant');
select has_column('public', 'attendance', 'correction_reason', 'attendance corrections store a reason');
select ok(
  to_regprocedure('public.record_student_attendance(uuid,uuid,attendance_status,text)') is not null,
  'participant attendance RPC exists'
);
select is(
  has_function_privilege(
    'authenticated',
    'public.record_student_attendance(uuid,uuid,attendance_status,text)',
    'EXECUTE'
  ),
  true,
  'authenticated callers can reach the guarded RPC'
);
select is(
  has_function_privilege(
    'anon',
    'public.record_student_attendance(uuid,uuid,attendance_status,text)',
    'EXECUTE'
  ),
  false,
  'anonymous callers cannot record participant attendance'
);

insert into auth.users (
  id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('bb000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'group.attendance.teacher@test.local', '{"role":"teacher"}', '{"full_name":"Group Attendance Teacher"}', now(), now()),
  ('bb000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'group.attendance.other.teacher@test.local', '{"role":"teacher"}', '{"full_name":"Other Attendance Teacher"}', now(), now()),
  ('bb000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'group.attendance.primary@test.local', '{"role":"student"}', '{"full_name":"Primary Attendance Student"}', now(), now()),
  ('bb000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'group.attendance.second@test.local', '{"role":"student"}', '{"full_name":"Second Attendance Student"}', now(), now()),
  ('bb000000-0000-4000-8000-000000000005', 'authenticated', 'authenticated', 'group.attendance.stranger@test.local', '{"role":"student"}', '{"full_name":"Stranger Attendance Student"}', now(), now());

insert into public.tracks (id, code, name_ar, name_en)
values ('bb100000-0000-4000-8000-000000000001', 'participant-attendance', 'حضور المشاركين', 'Participant attendance');

insert into public.teachers (
  id, profile_id, gender, status, identity_verified_at, code_of_conduct_accepted_at
)
values
  ('bb200000-0000-4000-8000-000000000001', 'bb000000-0000-4000-8000-000000000001', 'male', 'active', now(), now()),
  ('bb200000-0000-4000-8000-000000000002', 'bb000000-0000-4000-8000-000000000002', 'male', 'active', now(), now());

insert into public.teacher_tracks (teacher_id, track_id)
values
  ('bb200000-0000-4000-8000-000000000001', 'bb100000-0000-4000-8000-000000000001'),
  ('bb200000-0000-4000-8000-000000000002', 'bb100000-0000-4000-8000-000000000001');

insert into public.students (id, profile_id, full_name, gender, timezone)
values
  ('bb300000-0000-4000-8000-000000000001', 'bb000000-0000-4000-8000-000000000003', 'Primary Attendance Student', 'male', 'Africa/Cairo'),
  ('bb300000-0000-4000-8000-000000000002', 'bb000000-0000-4000-8000-000000000004', 'Second Attendance Student', 'male', 'Africa/Cairo'),
  ('bb300000-0000-4000-8000-000000000003', 'bb000000-0000-4000-8000-000000000005', 'Stranger Attendance Student', 'male', 'Africa/Cairo');

insert into public.teacher_assignments (
  id, student_id, teacher_id, track_id, assigned_by, reason
)
values
  ('bb400000-0000-4000-8000-000000000001', 'bb300000-0000-4000-8000-000000000001', 'bb200000-0000-4000-8000-000000000001', 'bb100000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Primary group attendance assignment'),
  ('bb400000-0000-4000-8000-000000000002', 'bb300000-0000-4000-8000-000000000002', 'bb200000-0000-4000-8000-000000000001', 'bb100000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Secondary group attendance assignment');

insert into public.sessions (
  id, assignment_id, student_id, teacher_id, scheduled_at, duration_min, format
)
values (
  'bb500000-0000-4000-8000-000000000001',
  'bb400000-0000-4000-8000-000000000001',
  'bb300000-0000-4000-8000-000000000001',
  'bb200000-0000-4000-8000-000000000001',
  statement_timestamp(),
  30,
  'group'
);

insert into public.session_participants (session_id, student_id, assignment_id, is_primary)
values (
  'bb500000-0000-4000-8000-000000000001',
  'bb300000-0000-4000-8000-000000000002',
  'bb400000-0000-4000-8000-000000000002',
  false
);

select set_config(
  'request.jwt.claims',
  '{"sub":"bb000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',
  true
);
set local role authenticated;

select lives_ok(
  $$select public.record_student_attendance(
    'bb500000-0000-4000-8000-000000000001',
    'bb300000-0000-4000-8000-000000000001',
    'present',
    null
  )$$,
  'teacher records primary participant attendance'
);
select lives_ok(
  $$select public.record_student_attendance(
    'bb500000-0000-4000-8000-000000000001',
    'bb300000-0000-4000-8000-000000000002',
    'student_absent',
    null
  )$$,
  'teacher records secondary participant attendance independently'
);
select is(
  (select count(*)::integer from public.attendance where session_id = 'bb500000-0000-4000-8000-000000000001'),
  2,
  'group session stores one attendance row per participant'
);
select is(
  (select status from public.attendance where session_id = 'bb500000-0000-4000-8000-000000000001' and student_id = 'bb300000-0000-4000-8000-000000000002'),
  'student_absent'::public.attendance_status,
  'secondary participant keeps their own status'
);
select throws_ok(
  $$select public.record_student_attendance(
    'bb500000-0000-4000-8000-000000000001',
    'bb300000-0000-4000-8000-000000000002',
    'present',
    null
  )$$,
  '22023',
  'attendance_correction_reason_required',
  'correction is rejected without a reason'
);
select lives_ok(
  $$select public.record_student_attendance(
    'bb500000-0000-4000-8000-000000000001',
    'bb300000-0000-4000-8000-000000000002',
    'present',
    'Teacher verified the student joined after the first record'
  )$$,
  'group attendance can be corrected with a reason'
);
select is(
  (select correction_reason from public.attendance where session_id = 'bb500000-0000-4000-8000-000000000001' and student_id = 'bb300000-0000-4000-8000-000000000002'),
  'Teacher verified the student joined after the first record',
  'correction reason is retained'
);
select throws_ok(
  $$select public.record_student_attendance(
    'bb500000-0000-4000-8000-000000000001',
    'bb300000-0000-4000-8000-000000000003',
    'present',
    null
  )$$,
  '42501',
  'attendance_student_not_participant',
  'teacher cannot add attendance for a non-participant'
);

reset role;
select is(
  (select count(*)::integer from public.session_credit_ledger where session_id = 'bb500000-0000-4000-8000-000000000001'),
  0,
  'group attendance does not invent a credit policy'
);
select is(
  (select count(*)::integer from public.teacher_payout_items where session_id = 'bb500000-0000-4000-8000-000000000001'),
  0,
  'group attendance does not invent a payout policy'
);
select ok(
  exists (
    select 1
    from public.audit_logs
    where table_name = 'attendance'
      and action = 'UPDATE'
      and after ->> 'correction_reason' = 'Teacher verified the student joined after the first record'
  ),
  'attendance correction is audited'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"bb000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}',
  true
);
set local role authenticated;
select throws_ok(
  $$select public.record_student_attendance(
    'bb500000-0000-4000-8000-000000000001',
    'bb300000-0000-4000-8000-000000000001',
    'late',
    'Unrelated teacher attempt'
  )$$,
  '42501',
  'attendance_forbidden',
  'unrelated teacher cannot change group attendance'
);

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"bb000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}',
  true
);
set local role authenticated;
select is((select count(*)::integer from public.attendance), 1, 'primary student reads only their attendance row');

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"bb000000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal1"}',
  true
);
set local role authenticated;
select is((select count(*)::integer from public.attendance), 1, 'secondary student reads only their attendance row');

select * from finish();
rollback;
