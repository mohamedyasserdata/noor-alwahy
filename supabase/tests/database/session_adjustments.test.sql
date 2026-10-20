begin;

select plan(37);

select has_column('public', 'sessions', 'rescheduled_from', 'sessions link a replacement to its source');
select has_index('public', 'sessions', 'sessions_rescheduled_from_once_idx', 'a session is rescheduled once');
select has_index('public', 'sessions', 'sessions_makeup_source_once_idx', 'a makeup source is consumed once');
select ok(to_regprocedure('public.assign_session_substitute(uuid,uuid,text)') is not null, 'substitute RPC exists');
select ok(to_regprocedure('public.create_makeup_session(uuid,timestamptz,uuid)') is not null, 'makeup RPC exists');
select ok(to_regprocedure('public.reschedule_session(uuid,timestamptz)') is not null, 'reschedule RPC exists');
select is(has_function_privilege('public', 'public.assign_session_substitute(uuid,uuid,text)', 'EXECUTE'), false, 'public cannot assign substitutes');
select is(has_function_privilege('anon', 'public.assign_session_substitute(uuid,uuid,text)', 'EXECUTE'), false, 'anonymous cannot assign substitutes');
select is(has_function_privilege('authenticated', 'public.assign_session_substitute(uuid,uuid,text)', 'EXECUTE'), true, 'authenticated callers reach guarded substitute RPC');
select is(has_function_privilege('service_role', 'public.assign_session_substitute(uuid,uuid,text)', 'EXECUTE'), false, 'service role cannot bypass substitute approval');
select is(has_function_privilege('anon', 'public.create_makeup_session(uuid,timestamptz,uuid)', 'EXECUTE'), false, 'anonymous cannot create makeup sessions');
select is(has_function_privilege('authenticated', 'public.create_makeup_session(uuid,timestamptz,uuid)', 'EXECUTE'), true, 'authenticated callers reach guarded makeup RPC');
select is(has_function_privilege('anon', 'public.reschedule_session(uuid,timestamptz)', 'EXECUTE'), false, 'anonymous cannot reschedule sessions');
select is(has_function_privilege('authenticated', 'public.reschedule_session(uuid,timestamptz)', 'EXECUTE'), true, 'authenticated callers reach guarded reschedule RPC');
select is(has_table_privilege('authenticated', 'public.sessions', 'UPDATE'), false, 'clients cannot bypass adjustment RPCs with direct updates');

insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('f7000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'adjustments.substitute@test.local', '{"role":"teacher"}', '{"full_name":"Substitute Teacher"}', now(), now()),
  ('f7000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'adjustments.female@test.local', '{"role":"teacher"}', '{"full_name":"Female Teacher"}', now(), now()),
  ('f7000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'adjustments.otherstudent@test.local', '{"role":"student"}', '{"full_name":"Other Student"}', now(), now());

insert into public.tracks (id, code, name_ar, name_en)
values ('f7100000-0000-4000-8000-000000000001', 'adjustments-test', 'اختبار التعديلات', 'Adjustments test');

insert into public.teachers (id, profile_id, gender, status, identity_verified_at, code_of_conduct_accepted_at)
values
  ('f7200000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', 'male', 'active', now(), now()),
  ('f7200000-0000-4000-8000-000000000002', 'f7000000-0000-4000-8000-000000000001', 'male', 'active', now(), now()),
  ('f7200000-0000-4000-8000-000000000003', 'f7000000-0000-4000-8000-000000000002', 'female', 'active', now(), now());

insert into public.teacher_tracks (teacher_id, track_id)
values
  ('f7200000-0000-4000-8000-000000000001', 'f7100000-0000-4000-8000-000000000001'),
  ('f7200000-0000-4000-8000-000000000002', 'f7100000-0000-4000-8000-000000000001'),
  ('f7200000-0000-4000-8000-000000000003', 'f7100000-0000-4000-8000-000000000001');

insert into public.students (id, profile_id, full_name, gender, timezone)
values
  ('f7300000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000003', 'Adjustment Student', 'male', 'Africa/Cairo'),
  ('f7300000-0000-4000-8000-000000000002', 'f7000000-0000-4000-8000-000000000003', 'Other Student', 'male', 'Africa/Cairo');

insert into public.teacher_assignments (id, student_id, teacher_id, track_id, assigned_by, reason)
values
  ('f7500000-0000-4000-8000-000000000001', 'f7300000-0000-4000-8000-000000000001', 'f7200000-0000-4000-8000-000000000001', 'f7100000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Adjustment test'),
  ('f7500000-0000-4000-8000-000000000002', 'f7300000-0000-4000-8000-000000000002', 'f7200000-0000-4000-8000-000000000002', 'f7100000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Conflict fixture');

insert into public.subscriptions (
  id, student_id, status, start_date, current_period_start, current_period_end,
  sessions_per_period, policy_snapshot
)
values (
  'f7600000-0000-4000-8000-000000000001', 'f7300000-0000-4000-8000-000000000001',
  'active', '2029-12-01', '2029-12-01', '2030-03-31', 20,
  '{"cancel_notice_hours":12,"max_makeups_per_period":2,"makeup_valid_days":30,"student_no_show_consumes_credit":true,"student_no_show_pays_teacher":true}'
);

insert into public.sessions (id, assignment_id, student_id, teacher_id, scheduled_at, duration_min, status)
values
  ('f7800000-0000-4000-8000-000000000001', 'f7500000-0000-4000-8000-000000000001', 'f7300000-0000-4000-8000-000000000001', 'f7200000-0000-4000-8000-000000000001', '2030-01-01 10:00+00', 30, 'scheduled'),
  ('f7800000-0000-4000-8000-000000000002', 'f7500000-0000-4000-8000-000000000001', 'f7300000-0000-4000-8000-000000000001', 'f7200000-0000-4000-8000-000000000001', '2030-01-03 10:00+00', 30, 'scheduled'),
  ('f7800000-0000-4000-8000-000000000003', 'f7500000-0000-4000-8000-000000000001', 'f7300000-0000-4000-8000-000000000001', 'f7200000-0000-4000-8000-000000000001', '2030-01-09 10:00+00', 30, 'scheduled'),
  ('f7800000-0000-4000-8000-000000000004', 'f7500000-0000-4000-8000-000000000001', 'f7300000-0000-4000-8000-000000000001', 'f7200000-0000-4000-8000-000000000001', '2030-02-01 10:00+00', 30, 'scheduled'),
  ('f7800000-0000-4000-8000-000000000005', 'f7500000-0000-4000-8000-000000000001', 'f7300000-0000-4000-8000-000000000001', 'f7200000-0000-4000-8000-000000000001', '2030-02-02 10:00+00', 30, 'cancelled'),
  ('f7800000-0000-4000-8000-000000000006', 'f7500000-0000-4000-8000-000000000001', 'f7300000-0000-4000-8000-000000000001', 'f7200000-0000-4000-8000-000000000001', '2030-02-05 10:00+00', 30, 'scheduled'),
  ('f7800000-0000-4000-8000-000000000007', 'f7500000-0000-4000-8000-000000000001', 'f7300000-0000-4000-8000-000000000001', 'f7200000-0000-4000-8000-000000000001', '2030-02-03 10:00+00', 30, 'scheduled'),
  ('f7800000-0000-4000-8000-000000000008', 'f7500000-0000-4000-8000-000000000002', 'f7300000-0000-4000-8000-000000000002', 'f7200000-0000-4000-8000-000000000002', '2030-02-03 10:00+00', 30, 'scheduled');

insert into public.makeup_entitlements (
  id, subscription_id, student_id, source_session_id, outside_period_cap, expires_at
)
values (
  'f7900000-0000-4000-8000-000000000001', 'f7600000-0000-4000-8000-000000000001',
  'f7300000-0000-4000-8000-000000000001', 'f7800000-0000-4000-8000-000000000005', true,
  '2030-03-01 00:00+00'
);

select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select throws_ok(
  $$select public.assign_session_substitute('f7800000-0000-4000-8000-000000000004', 'f7200000-0000-4000-8000-000000000002', 'session')$$,
  '42501', 'admin_mfa_required', 'AAL1 administrator cannot approve a substitute'
);
select throws_ok(
  $$select public.reschedule_session('f7800000-0000-4000-8000-000000000006', '2030-02-06 10:00+00')$$,
  '42501', 'admin_mfa_required', 'AAL1 administrator cannot approve rescheduling'
);
reset role;

select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select throws_ok(
  $$select public.create_makeup_session('f7900000-0000-4000-8000-000000000001', '2030-02-10 10:00+00', null)$$,
  '42501', 'admin_mfa_required', 'teacher cannot approve a makeup session'
);
reset role;

select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;

select is(
  public.assign_session_substitute('f7800000-0000-4000-8000-000000000004', 'f7200000-0000-4000-8000-000000000002', 'session'),
  1,
  'administrator assigns a substitute to one session'
);
select is((select teacher_id from public.sessions where id = 'f7800000-0000-4000-8000-000000000004'), 'f7200000-0000-4000-8000-000000000002'::uuid, 'single session stores actual substitute');
select is((select original_teacher_id from public.sessions where id = 'f7800000-0000-4000-8000-000000000004'), 'f7200000-0000-4000-8000-000000000001'::uuid, 'single session preserves original teacher');

select is(
  public.assign_session_substitute('f7800000-0000-4000-8000-000000000001', 'f7200000-0000-4000-8000-000000000002', 'week'),
  2,
  'week scope updates scheduled sessions in the next seven days'
);
select is((select count(*)::integer from public.sessions where id in ('f7800000-0000-4000-8000-000000000001', 'f7800000-0000-4000-8000-000000000002') and teacher_id = 'f7200000-0000-4000-8000-000000000002'), 2, 'week sessions use substitute');
select is((select teacher_id from public.sessions where id = 'f7800000-0000-4000-8000-000000000003'), 'f7200000-0000-4000-8000-000000000001'::uuid, 'session outside seven days is unchanged');
select throws_ok(
  $$select public.assign_session_substitute('f7800000-0000-4000-8000-000000000003', 'f7200000-0000-4000-8000-000000000003', 'session')$$,
  'P0001', 'gender_mismatch', 'opposite-gender substitute is rejected by the database'
);
select throws_ok(
  $$select public.assign_session_substitute('f7800000-0000-4000-8000-000000000007', 'f7200000-0000-4000-8000-000000000002', 'session')$$,
  '23P01', null, 'substitute overlap is rejected by the database'
);

select ok(
  public.create_makeup_session('f7900000-0000-4000-8000-000000000001', '2030-02-10 10:00+00', null) is not null,
  'administrator creates a linked makeup session'
);
select is((select kind from public.sessions where makeup_of = 'f7800000-0000-4000-8000-000000000005'), 'makeup'::public.session_kind, 'created session is a makeup');
select is((select used_by_session_id from public.makeup_entitlements where id = 'f7900000-0000-4000-8000-000000000001'), (select id from public.sessions where makeup_of = 'f7800000-0000-4000-8000-000000000005'), 'entitlement points to its makeup session');
select throws_ok(
  $$select public.create_makeup_session('f7900000-0000-4000-8000-000000000001', '2030-02-11 10:00+00', null)$$,
  'P0001', 'makeup_entitlement_unavailable', 'used entitlement cannot create a second makeup'
);

select ok(
  public.reschedule_session('f7800000-0000-4000-8000-000000000006', '2030-02-06 10:00+00') is not null,
  'administrator reschedules a scheduled session'
);
select is((select status from public.sessions where id = 'f7800000-0000-4000-8000-000000000006'), 'rescheduled'::public.session_status, 'source session becomes rescheduled');
select is((select scheduled_at from public.sessions where rescheduled_from = 'f7800000-0000-4000-8000-000000000006'), '2030-02-06 10:00+00'::timestamptz, 'replacement stores the approved time');
select is((select status from public.sessions where rescheduled_from = 'f7800000-0000-4000-8000-000000000006'), 'scheduled'::public.session_status, 'replacement remains scheduled');
select throws_ok(
  $$select public.reschedule_session('f7800000-0000-4000-8000-000000000006', '2030-02-07 10:00+00')$$,
  'P0001', 'session_not_adjustable', 'rescheduled source cannot be rescheduled twice'
);
select ok((select count(*) >= 3 from public.notifications where type = 'schedule_changed'), 'student receives schedule change notifications');

reset role;

select * from finish();
rollback;
