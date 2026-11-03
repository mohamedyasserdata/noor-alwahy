begin;

select plan(18);

select has_table('public', 'teacher_attendance', 'teacher attendance register exists');
select is(
  (select relrowsecurity from pg_class where oid = 'public.teacher_attendance'::regclass),
  true,
  'teacher attendance register has RLS'
);
select ok(
  to_regprocedure('public.record_teacher_attendance(uuid,text,integer,text)') is not null,
  'guarded teacher attendance RPC exists'
);
select is(
  has_function_privilege(
    'authenticated',
    'public.record_teacher_attendance(uuid,text,integer,text)',
    'EXECUTE'
  ),
  true,
  'authenticated callers can reach the guarded RPC'
);
select is(
  has_table_privilege('authenticated', 'public.teacher_attendance', 'UPDATE'),
  false,
  'authenticated users cannot directly correct the register'
);
select is(
  (
    select array_to_string(proconfig, ',')
    from pg_proc
    where oid = 'public.record_teacher_attendance(uuid,text,integer,text)'::regprocedure
  ),
  'search_path=""',
  'teacher attendance RPC pins an empty search path'
);

insert into auth.users (
  id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  (
    'd9000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated',
    'teacher.attendance.admin@test.local', '{"role":"admin"}',
    '{"full_name":"Teacher Attendance Admin"}', now(), now()
  ),
  (
    'd9000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated',
    'teacher.attendance.teacher@test.local', '{"role":"teacher"}',
    '{"full_name":"Teacher Attendance Teacher"}', now(), now()
  ),
  (
    'd9000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated',
    'teacher.attendance.student@test.local', '{"role":"student"}',
    '{"full_name":"Teacher Attendance Student"}', now(), now()
  );

insert into public.tracks (id, code, name_ar, name_en)
values (
  'd9100000-0000-4000-8000-000000000001',
  'teacher-attendance-test',
  'اختبار حضور المدرس',
  'Teacher attendance test'
);
insert into public.teachers (
  id, profile_id, gender, status, identity_verified_at, code_of_conduct_accepted_at
)
values (
  'd9200000-0000-4000-8000-000000000001',
  'd9000000-0000-4000-8000-000000000002',
  'male', 'active', now(), now()
);
insert into public.teacher_tracks (teacher_id, track_id)
values (
  'd9200000-0000-4000-8000-000000000001',
  'd9100000-0000-4000-8000-000000000001'
);
insert into public.students (id, profile_id, full_name, gender, timezone)
values (
  'd9300000-0000-4000-8000-000000000001',
  'd9000000-0000-4000-8000-000000000003',
  'Teacher Attendance Student', 'male', 'Africa/Cairo'
);
insert into public.teacher_assignments (
  id, student_id, teacher_id, track_id, assigned_by, reason
)
values (
  'd9400000-0000-4000-8000-000000000001',
  'd9300000-0000-4000-8000-000000000001',
  'd9200000-0000-4000-8000-000000000001',
  'd9100000-0000-4000-8000-000000000001',
  'd9000000-0000-4000-8000-000000000001',
  'Teacher attendance test'
);
insert into public.sessions (
  id, assignment_id, student_id, teacher_id, scheduled_at, duration_min
)
values (
  'd9500000-0000-4000-8000-000000000001',
  'd9400000-0000-4000-8000-000000000001',
  'd9300000-0000-4000-8000-000000000001',
  'd9200000-0000-4000-8000-000000000001',
  statement_timestamp() - interval '2 hours',
  30
);

select set_config(
  'request.jwt.claims',
  '{"sub":"d9000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}',
  true
);
set local role authenticated;
select throws_ok(
  $$select public.record_teacher_attendance(
    'd9500000-0000-4000-8000-000000000001', 'present', 30, null
  )$$,
  '42501',
  'teacher_attendance_admin_required',
  'teacher cannot record their own attendance'
);
select is(
  (select count(*)::integer from public.teacher_attendance),
  0,
  'teacher sees no fabricated attendance row'
);

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"d9000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',
  true
);
set local role authenticated;
select lives_ok(
  $$select public.record_teacher_attendance(
    'd9500000-0000-4000-8000-000000000001', 'late', 22, 'Late arrival confirmed'
  )$$,
  'AAL2 administrator records teacher attendance'
);
select is(
  (
    select status
    from public.teacher_attendance
    where session_id = 'd9500000-0000-4000-8000-000000000001'
  ),
  'late',
  'admin record is persisted'
);
select throws_ok(
  $$select public.record_teacher_attendance(
    'd9500000-0000-4000-8000-000000000001', 'present', 30, null
  )$$,
  '22023',
  'teacher_attendance_correction_reason_required',
  'attendance correction requires a reason'
);
select lives_ok(
  $$select public.record_teacher_attendance(
    'd9500000-0000-4000-8000-000000000001', 'present', 30, 'Corrected after review'
  )$$,
  'AAL2 administrator can correct teacher attendance'
);
select is(
  (
    select status
    from public.teacher_attendance
    where session_id = 'd9500000-0000-4000-8000-000000000001'
  ),
  'present',
  'correction replaces the current status'
);
select is(
  (
    select count(*)::integer
    from public.audit_logs
    where table_name = 'teacher_attendance'
      and record_id = (
        select id::text
        from public.teacher_attendance
        where session_id = 'd9500000-0000-4000-8000-000000000001'
      )
  ),
  2,
  'initial record and correction are both audited'
);
select ok(
  exists (
    select 1
    from public.get_attendance_report('daily', current_date)
    where entity_type = 'teacher'
      and entity_id = 'd9200000-0000-4000-8000-000000000001'
      and attended_count = 1
  ),
  'administrative report uses the independent teacher attendance row'
);

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"d9000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}',
  true
);
set local role authenticated;
select is(
  (select count(*)::integer from public.teacher_attendance),
  1,
  'teacher can read their own attendance row'
);
select throws_ok(
  $$update public.teacher_attendance
    set status = 'absent'
    where session_id = 'd9500000-0000-4000-8000-000000000001'$$,
  '42501',
  null,
  'teacher cannot correct their own attendance directly'
);

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"d9000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}',
  true
);
set local role authenticated;
select is(
  (select count(*)::integer from public.teacher_attendance),
  0,
  'student cannot read teacher attendance rows'
);

select * from finish();
rollback;
