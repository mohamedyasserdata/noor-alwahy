begin;

select plan(34);

select has_table('public', 'session_alerts', 'session alerts table exists');
select is((select relrowsecurity from pg_class where oid = 'public.session_alerts'::regclass), true, 'session alerts have RLS');
select ok(to_regprocedure('private.detect_teacher_lateness(timestamptz)') is not null, 'private lateness detector exists');
select ok(to_regprocedure('public.get_attendance_report(text,date)') is not null, 'guarded attendance report RPC exists');
select is(has_function_privilege('authenticated', 'private.detect_teacher_lateness(timestamptz)', 'EXECUTE'), false, 'clients cannot run lateness detector');
select is(has_function_privilege('authenticated', 'public.get_attendance_report(text,date)', 'EXECUTE'), true, 'authenticated callers reach guarded report');
select is(has_function_privilege('anon', 'public.get_attendance_report(text,date)', 'EXECUTE'), false, 'anonymous callers cannot request reports');
select is(has_table_privilege('authenticated', 'public.session_alerts', 'INSERT'), false, 'clients cannot forge alerts');
select is(
  (select array_to_string(proconfig, ',') from pg_proc where oid = 'private.detect_teacher_lateness(timestamptz)'::regprocedure),
  'search_path=""',
  'lateness detector pins an empty search path'
);
select is(
  (select array_to_string(proconfig, ',') from pg_proc where oid = 'public.get_attendance_report(text,date)'::regprocedure),
  'search_path=""',
  'report RPC pins an empty search path'
);
select is((select (value ->> 'attendance_lock_hours')::integer from public.app_settings where key = 'attendance_policy'), 48, 'attendance lock defaults to 48 hours');
select is((select (value ->> 'late_tolerance_min')::integer from public.app_settings where key = 'attendance_policy'), 10, 'teacher lateness tolerance defaults to ten minutes');
select is((select (value ->> 'teacher_absence_alert_threshold')::integer from public.app_settings where key = 'attendance_policy'), 3, 'absence threshold is stored as a setting');
select throws_ok(
  $$insert into public.app_settings (key, value) values ('attendance_policy', '{"attendance_lock_hours":-1,"late_tolerance_min":10,"teacher_absence_alert_threshold":3,"teacher_absence_window_days":30}') on conflict (key) do update set value = excluded.value$$,
  '23514',
  null,
  'invalid attendance policy is rejected by the database'
);
select ok(exists(select 1 from cron.job where jobname = 'detect-teacher-lateness'), 'teacher lateness detector is scheduled');

insert into public.tracks (id, code, name_ar, name_en)
values ('f7100000-0000-4000-8000-000000000001', 'attendance-controls', 'ضوابط الحضور', 'Attendance controls');

insert into public.teachers (id, profile_id, gender, status, identity_verified_at, code_of_conduct_accepted_at)
values ('f7200000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', 'male', 'active', now(), now());
insert into public.teacher_tracks (teacher_id, track_id)
values ('f7200000-0000-4000-8000-000000000001', 'f7100000-0000-4000-8000-000000000001');

insert into public.students (id, profile_id, full_name, gender, timezone)
values ('f7300000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000003', 'Attendance Controls Student', 'male', 'Africa/Cairo');
insert into public.guardians (id, profile_id)
values ('f7400000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000004');
insert into public.student_guardians (student_id, guardian_id, is_primary)
values ('f7300000-0000-4000-8000-000000000001', 'f7400000-0000-4000-8000-000000000001', true);
insert into public.teacher_assignments (id, student_id, teacher_id, track_id, assigned_by, reason)
values ('f7500000-0000-4000-8000-000000000001', 'f7300000-0000-4000-8000-000000000001', 'f7200000-0000-4000-8000-000000000001', 'f7100000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Attendance controls test');

insert into public.subscriptions (
  id, student_id, status, start_date, current_period_start, current_period_end,
  sessions_per_period, policy_snapshot
)
values (
  'f7600000-0000-4000-8000-000000000001', 'f7300000-0000-4000-8000-000000000001',
  'active', current_date - 40, current_date - 40, current_date + 40, 20,
  '{"cancel_notice_hours":12,"max_makeups_per_period":10,"makeup_valid_days":30,"student_no_show_consumes_credit":true,"student_no_show_pays_teacher":true}'
);
insert into public.session_credit_ledger (subscription_id, delta, reason, note)
values ('f7600000-0000-4000-8000-000000000001', 20, 'grant', 'attendance controls fixture');
insert into public.teacher_rates (teacher_id, rate_per_session, currency, valid_from, created_by)
values ('f7200000-0000-4000-8000-000000000001', 100, 'EGP', current_date - 365, '10000000-0000-4000-8000-000000000001');

insert into public.sessions (id, assignment_id, student_id, teacher_id, original_teacher_id, kind, scheduled_at, duration_min)
values
  ('f7800000-0000-4000-8000-000000000001', 'f7500000-0000-4000-8000-000000000001', 'f7300000-0000-4000-8000-000000000001', 'f7200000-0000-4000-8000-000000000001', 'f7200000-0000-4000-8000-000000000001', 'regular', now() - interval '4 days', 30),
  ('f7800000-0000-4000-8000-000000000002', 'f7500000-0000-4000-8000-000000000001', 'f7300000-0000-4000-8000-000000000001', 'f7200000-0000-4000-8000-000000000001', 'f7200000-0000-4000-8000-000000000001', 'regular', now() - interval '20 minutes', 30),
  ('f7800000-0000-4000-8000-000000000003', 'f7500000-0000-4000-8000-000000000001', 'f7300000-0000-4000-8000-000000000001', 'f7200000-0000-4000-8000-000000000001', 'f7200000-0000-4000-8000-000000000001', 'regular', now() - interval '3 days', 30),
  ('f7800000-0000-4000-8000-000000000004', 'f7500000-0000-4000-8000-000000000001', 'f7300000-0000-4000-8000-000000000001', 'f7200000-0000-4000-8000-000000000001', 'f7200000-0000-4000-8000-000000000001', 'regular', now() - interval '2 days', 30),
  ('f7800000-0000-4000-8000-000000000005', 'f7500000-0000-4000-8000-000000000001', 'f7300000-0000-4000-8000-000000000001', 'f7200000-0000-4000-8000-000000000001', 'f7200000-0000-4000-8000-000000000001', 'regular', now() - interval '1 day', 30);

select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select throws_ok(
  $$select public.record_attendance('f7800000-0000-4000-8000-000000000001', 'present')$$,
  'P0001', 'attendance_locked', 'teacher cannot record attendance after the configured deadline'
);
reset role;

select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
select lives_ok(
  $$select public.record_attendance('f7800000-0000-4000-8000-000000000001', 'present')$$,
  'AAL2 administrator can record after the deadline'
);
reset role;
select is(
  (select locked_at from public.attendance where session_id = 'f7800000-0000-4000-8000-000000000001'),
  (select ends_at + interval '48 hours' from public.sessions where id = 'f7800000-0000-4000-8000-000000000001'),
  'attendance stores its calculated lock timestamp'
);

select is(private.detect_teacher_lateness(now()), 1, 'lateness detector creates one alert');
select is(private.detect_teacher_lateness(now()), 0, 'lateness detector is idempotent');
select is((select count(*)::integer from public.session_alerts where session_id = 'f7800000-0000-4000-8000-000000000002' and type = 'teacher_late'), 1, 'one teacher-late alert is persisted');
select is((select count(*)::integer from public.notifications where user_id = '10000000-0000-4000-8000-000000000004' and type = 'teacher_late'), 1, 'parent receives immediate teacher-late notification');
select is((select count(*)::integer from public.notifications where user_id = '10000000-0000-4000-8000-000000000001' and type = 'teacher_late'), 1, 'administrator receives teacher-late notification');

insert into public.attendance (session_id, status, recorded_by, locked_at)
values
  ('f7800000-0000-4000-8000-000000000003', 'teacher_absent', '10000000-0000-4000-8000-000000000001', now()),
  ('f7800000-0000-4000-8000-000000000004', 'teacher_absent', '10000000-0000-4000-8000-000000000001', now()),
  ('f7800000-0000-4000-8000-000000000005', 'teacher_absent', '10000000-0000-4000-8000-000000000001', now());
select is((select count(*)::integer from public.session_alerts where teacher_id = 'f7200000-0000-4000-8000-000000000001' and type = 'teacher_absence_threshold'), 1, 'absence threshold creates one aggregate alert');
select is((select count(*)::integer from public.notifications where user_id = '10000000-0000-4000-8000-000000000001' and type = 'teacher_absence_threshold'), 1, 'administrator receives the threshold notification once');

select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select throws_ok(
  $$select * from public.get_attendance_report('monthly', current_date)$$,
  '42501', 'mfa_required', 'attendance reports require AAL2'
);
reset role;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
select lives_ok($$select * from public.get_attendance_report('daily', current_date)$$, 'daily attendance report is available');
select lives_ok($$select * from public.get_attendance_report('weekly', current_date)$$, 'weekly attendance report is available');
select lives_ok($$select * from public.get_attendance_report('monthly', current_date)$$, 'monthly attendance report is available');
select throws_ok($$select * from public.get_attendance_report('yearly', current_date)$$, '22023', 'invalid_attendance_report_period', 'unknown report period is rejected');
select ok(exists(select 1 from public.get_attendance_report('monthly', current_date) where entity_type = 'teacher' and entity_id = 'f7200000-0000-4000-8000-000000000001'), 'report includes the teacher aggregate');
select ok(exists(select 1 from public.get_attendance_report('monthly', current_date) where entity_type = 'student' and entity_id = 'f7300000-0000-4000-8000-000000000001'), 'report includes the student aggregate');
reset role;

select * from finish();
rollback;
