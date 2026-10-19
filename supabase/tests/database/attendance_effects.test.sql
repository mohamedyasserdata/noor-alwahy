begin;

select plan(73);

select has_table('public', 'attendance', 'attendance table exists');
select has_table('public', 'teacher_rates', 'teacher rates table exists');
select has_table('public', 'teacher_payout_items', 'teacher payout items table exists');
select has_table('public', 'makeup_entitlements', 'makeup entitlements table exists');
select is((select relrowsecurity from pg_class where oid = 'public.attendance'::regclass), true, 'attendance has RLS');
select is((select relrowsecurity from pg_class where oid = 'public.teacher_rates'::regclass), true, 'teacher rates have RLS');
select is((select relrowsecurity from pg_class where oid = 'public.teacher_payout_items'::regclass), true, 'payout items have RLS');
select is((select relrowsecurity from pg_class where oid = 'public.makeup_entitlements'::regclass), true, 'makeup entitlements have RLS');
select ok(to_regprocedure('public.record_attendance(uuid,attendance_status,timestamptz,timestamptz,integer,timestamptz)') is not null, 'guarded attendance RPC exists');
select ok(to_regprocedure('private.apply_attendance_effects(uuid)') is not null, 'private attendance effects helper exists');
select is(has_function_privilege('public', 'public.record_attendance(uuid,attendance_status,timestamptz,timestamptz,integer,timestamptz)', 'EXECUTE'), false, 'public cannot record attendance');
select is(has_function_privilege('anon', 'public.record_attendance(uuid,attendance_status,timestamptz,timestamptz,integer,timestamptz)', 'EXECUTE'), false, 'anonymous cannot record attendance');
select is(has_function_privilege('authenticated', 'public.record_attendance(uuid,attendance_status,timestamptz,timestamptz,integer,timestamptz)', 'EXECUTE'), true, 'authenticated callers reach guarded RPC');
select is(has_function_privilege('service_role', 'public.record_attendance(uuid,attendance_status,timestamptz,timestamptz,integer,timestamptz)', 'EXECUTE'), false, 'service role cannot bypass guarded RPC');
select is(has_function_privilege('authenticated', 'private.apply_attendance_effects(uuid)', 'EXECUTE'), false, 'clients cannot execute effects helper');
select is(has_table_privilege('authenticated', 'public.attendance', 'INSERT'), false, 'clients cannot insert attendance directly');
select is(has_table_privilege('authenticated', 'public.teacher_payout_items', 'INSERT'), false, 'clients cannot forge payout items');
select ok(to_regclass('public.teacher_payout_items_session_id_key') is not null, 'a session can be paid only once');
select ok(to_regclass('public.session_credit_ledger_consume_once_idx') is not null, 'a session can consume credit only once');
select is((select array_to_string(proconfig, ',') from pg_proc where oid = 'public.record_attendance(uuid,attendance_status,timestamptz,timestamptz,integer,timestamptz)'::regprocedure), 'search_path=""', 'attendance RPC pins an empty search path');
select is((select array_to_string(proconfig, ',') from pg_proc where oid = 'private.apply_attendance_effects(uuid)'::regprocedure), 'search_path=""', 'effects helper pins an empty search path');
select has_column('public', 'subscriptions', 'policy_snapshot', 'subscriptions snapshot attendance policy');
select ok(exists(select 1 from pg_constraint where conrelid = 'public.subscriptions'::regclass and conname = 'subscriptions_policy_snapshot_valid'), 'policy snapshot is database validated');

insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('e7000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'attendance.substitute@test.local', '{"role":"teacher"}', '{"full_name":"Substitute Teacher"}', now(), now()),
  ('e7000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'attendance.unrelated@test.local', '{"role":"teacher"}', '{"full_name":"Unrelated Teacher"}', now(), now());

insert into public.tracks (id, code, name_ar, name_en)
values ('e7100000-0000-4000-8000-000000000001', 'attendance-test', 'اختبار الحضور', 'Attendance test');

insert into public.teachers (id, profile_id, gender, status, identity_verified_at, code_of_conduct_accepted_at)
values
  ('e7200000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', 'male', 'active', now(), now()),
  ('e7200000-0000-4000-8000-000000000002', 'e7000000-0000-4000-8000-000000000001', 'male', 'active', now(), now()),
  ('e7200000-0000-4000-8000-000000000003', 'e7000000-0000-4000-8000-000000000002', 'male', 'active', now(), now());

insert into public.teacher_tracks (teacher_id, track_id)
values
  ('e7200000-0000-4000-8000-000000000001', 'e7100000-0000-4000-8000-000000000001'),
  ('e7200000-0000-4000-8000-000000000002', 'e7100000-0000-4000-8000-000000000001'),
  ('e7200000-0000-4000-8000-000000000003', 'e7100000-0000-4000-8000-000000000001');

insert into public.students (id, profile_id, full_name, gender, timezone)
values ('e7300000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000003', 'Attendance Student', 'male', 'Africa/Cairo');
insert into public.guardians (id, profile_id)
values ('e7400000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000004');
insert into public.student_guardians (student_id, guardian_id, is_primary)
values ('e7300000-0000-4000-8000-000000000001', 'e7400000-0000-4000-8000-000000000001', true);
insert into public.teacher_assignments (id, student_id, teacher_id, track_id, assigned_by, reason)
values ('e7500000-0000-4000-8000-000000000001', 'e7300000-0000-4000-8000-000000000001', 'e7200000-0000-4000-8000-000000000001', 'e7100000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Attendance test');

insert into public.subscriptions (
  id, student_id, status, start_date, current_period_start, current_period_end,
  sessions_per_period, policy_snapshot
)
values (
  'e7600000-0000-4000-8000-000000000001', 'e7300000-0000-4000-8000-000000000001',
  'active', '2026-10-01', '2026-10-01', '2026-10-31', 20,
  '{"cancel_notice_hours":12,"max_makeups_per_period":2,"makeup_valid_days":30,"student_no_show_consumes_credit":true,"student_no_show_pays_teacher":true}'
);
insert into public.session_credit_ledger (subscription_id, delta, reason, note)
values ('e7600000-0000-4000-8000-000000000001', 20, 'grant', 'attendance fixture');

insert into public.teacher_rates (id, teacher_id, rate_per_session, currency, valid_from, created_by)
values
  ('e7700000-0000-4000-8000-000000000001', 'e7200000-0000-4000-8000-000000000001', 100.00, 'EGP', '2026-01-01', '10000000-0000-4000-8000-000000000001'),
  ('e7700000-0000-4000-8000-000000000002', 'e7200000-0000-4000-8000-000000000002', 150.00, 'EGP', '2026-01-01', '10000000-0000-4000-8000-000000000001');

insert into public.sessions (id, assignment_id, student_id, teacher_id, original_teacher_id, kind, makeup_of, scheduled_at, duration_min)
values
  ('e7800000-0000-4000-8000-000000000001', 'e7500000-0000-4000-8000-000000000001', 'e7300000-0000-4000-8000-000000000001', 'e7200000-0000-4000-8000-000000000001', null, 'regular', null, '2026-10-01 08:00+00', 30),
  ('e7800000-0000-4000-8000-000000000002', 'e7500000-0000-4000-8000-000000000001', 'e7300000-0000-4000-8000-000000000001', 'e7200000-0000-4000-8000-000000000001', null, 'regular', null, '2026-10-02 08:00+00', 30),
  ('e7800000-0000-4000-8000-000000000003', 'e7500000-0000-4000-8000-000000000001', 'e7300000-0000-4000-8000-000000000001', 'e7200000-0000-4000-8000-000000000001', null, 'regular', null, '2026-10-03 08:00+00', 30),
  ('e7800000-0000-4000-8000-000000000004', 'e7500000-0000-4000-8000-000000000001', 'e7300000-0000-4000-8000-000000000001', 'e7200000-0000-4000-8000-000000000001', null, 'regular', null, '2026-10-04 08:00+00', 30),
  ('e7800000-0000-4000-8000-000000000005', 'e7500000-0000-4000-8000-000000000001', 'e7300000-0000-4000-8000-000000000001', 'e7200000-0000-4000-8000-000000000001', null, 'regular', null, '2026-10-05 08:00+00', 30),
  ('e7800000-0000-4000-8000-000000000006', 'e7500000-0000-4000-8000-000000000001', 'e7300000-0000-4000-8000-000000000001', 'e7200000-0000-4000-8000-000000000001', null, 'regular', null, '2026-10-06 08:00+00', 30),
  ('e7800000-0000-4000-8000-000000000007', 'e7500000-0000-4000-8000-000000000001', 'e7300000-0000-4000-8000-000000000001', 'e7200000-0000-4000-8000-000000000001', null, 'regular', null, '2026-10-07 08:00+00', 30),
  ('e7800000-0000-4000-8000-000000000008', 'e7500000-0000-4000-8000-000000000001', 'e7300000-0000-4000-8000-000000000001', 'e7200000-0000-4000-8000-000000000001', null, 'regular', null, '2026-10-08 08:00+00', 30),
  ('e7800000-0000-4000-8000-000000000009', 'e7500000-0000-4000-8000-000000000001', 'e7300000-0000-4000-8000-000000000001', 'e7200000-0000-4000-8000-000000000001', null, 'regular', null, '2026-10-09 08:00+00', 30),
  ('e7800000-0000-4000-8000-000000000010', 'e7500000-0000-4000-8000-000000000001', 'e7300000-0000-4000-8000-000000000001', 'e7200000-0000-4000-8000-000000000002', 'e7200000-0000-4000-8000-000000000001', 'regular', null, '2026-10-10 08:00+00', 30),
  ('e7800000-0000-4000-8000-000000000011', 'e7500000-0000-4000-8000-000000000001', 'e7300000-0000-4000-8000-000000000001', 'e7200000-0000-4000-8000-000000000001', null, 'makeup', 'e7800000-0000-4000-8000-000000000007', '2026-10-11 08:00+00', 30),
  ('e7800000-0000-4000-8000-000000000012', 'e7500000-0000-4000-8000-000000000001', 'e7300000-0000-4000-8000-000000000001', 'e7200000-0000-4000-8000-000000000001', null, 'regular', null, '2026-10-12 08:00+00', 30),
  ('e7800000-0000-4000-8000-000000000013', 'e7500000-0000-4000-8000-000000000001', 'e7300000-0000-4000-8000-000000000001', 'e7200000-0000-4000-8000-000000000001', null, 'regular', null, '2026-10-13 08:00+00', 30);

select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;

select lives_ok($$select public.record_attendance('e7800000-0000-4000-8000-000000000001', 'present', null, '2026-10-01 08:00+00', 30, null)$$, 'actual teacher records present attendance');
select is((select status from public.sessions where id = 'e7800000-0000-4000-8000-000000000001'), 'held'::public.session_status, 'present session becomes held');
reset role;
select is((select count(*)::integer from public.session_credit_ledger where session_id = 'e7800000-0000-4000-8000-000000000001' and reason = 'consume'), 1, 'present consumes one credit');
select is((select count(*)::integer from public.teacher_payout_items where session_id = 'e7800000-0000-4000-8000-000000000001'), 1, 'present pays teacher once');
set local role authenticated;
select lives_ok($$select public.record_attendance('e7800000-0000-4000-8000-000000000001', 'present', null, '2026-10-01 08:00+00', 30, null)$$, 'identical attendance retry is idempotent');
reset role;
select is((select count(*)::integer from public.session_credit_ledger where session_id = 'e7800000-0000-4000-8000-000000000001' and reason = 'consume'), 1, 'retry does not consume twice');
select is((select count(*)::integer from public.teacher_payout_items where session_id = 'e7800000-0000-4000-8000-000000000001'), 1, 'retry does not pay twice');
set local role authenticated;
select throws_ok($$select public.record_attendance('e7800000-0000-4000-8000-000000000001', 'late', null, null, 20, null)$$, 'P0001', 'attendance_conflict', 'conflicting retry is rejected');

reset role;
select set_config('request.jwt.claims', '{"sub":"e7000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select throws_ok($$select public.record_attendance('e7800000-0000-4000-8000-000000000002', 'late', null, null, 20, null)$$, '42501', 'attendance_forbidden', 'unrelated teacher cannot record attendance');
reset role;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select throws_ok($$select public.record_attendance('e7800000-0000-4000-8000-000000000002', 'late', null, null, 20, null)$$, '42501', 'attendance_forbidden', 'AAL1 administrator cannot record attendance');
reset role;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select throws_ok($$select public.record_attendance('e7800000-0000-4000-8000-000000000002', 'late', null, null, 20, null)$$, '42501', 'attendance_forbidden', 'student cannot record attendance');

reset role;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select lives_ok($$select public.record_attendance('e7800000-0000-4000-8000-000000000002', 'late', '2026-10-02 08:08+00', '2026-10-02 08:00+00', 22, null)$$, 'late consumes and pays');
reset role;
select is((select count(*)::integer from public.session_credit_ledger where session_id = 'e7800000-0000-4000-8000-000000000002'), 1, 'late consumes one credit');
select is((select count(*)::integer from public.teacher_payout_items where session_id = 'e7800000-0000-4000-8000-000000000002'), 1, 'late pays once');
set local role authenticated;
select lives_ok($$select public.record_attendance('e7800000-0000-4000-8000-000000000003', 'student_absent', null, '2026-10-03 08:00+00', 30, null)$$, 'policy-paid student absence records');
reset role;
select is((select count(*)::integer from public.session_credit_ledger where session_id = 'e7800000-0000-4000-8000-000000000003'), 1, 'student absence consumes by policy');
select is((select kind from public.teacher_payout_items where session_id = 'e7800000-0000-4000-8000-000000000003'), 'no_show', 'student absence pays as no-show by policy');
reset role;

update public.subscriptions
set policy_snapshot = jsonb_set(jsonb_set(policy_snapshot, '{student_no_show_consumes_credit}', 'false'), '{student_no_show_pays_teacher}', 'false')
where id = 'e7600000-0000-4000-8000-000000000001';
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select lives_ok($$select public.record_attendance('e7800000-0000-4000-8000-000000000004', 'student_absent', null, '2026-10-04 08:00+00', 30, null)$$, 'policy-free student absence records');
reset role;
select is((select count(*)::integer from public.session_credit_ledger where session_id = 'e7800000-0000-4000-8000-000000000004'), 0, 'student absence does not consume when policy disables it');
select is((select count(*)::integer from public.teacher_payout_items where session_id = 'e7800000-0000-4000-8000-000000000004'), 0, 'student absence does not pay when policy disables it');
set local role authenticated;
select lives_ok($$select public.record_attendance('e7800000-0000-4000-8000-000000000005', 'student_excused', null, null, null, '2026-10-04 18:00+00')$$, 'timely excused absence records');
reset role;
select is((select count(*)::integer from public.session_credit_ledger where session_id = 'e7800000-0000-4000-8000-000000000005'), 0, 'timely excuse does not consume');
select is((select count(*)::integer from public.makeup_entitlements where source_session_id = 'e7800000-0000-4000-8000-000000000005'), 1, 'timely excuse creates capped makeup entitlement');
reset role;

update public.subscriptions
set policy_snapshot = jsonb_set(jsonb_set(policy_snapshot, '{student_no_show_consumes_credit}', 'true'), '{student_no_show_pays_teacher}', 'true')
where id = 'e7600000-0000-4000-8000-000000000001';
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select lives_ok($$select public.record_attendance('e7800000-0000-4000-8000-000000000006', 'student_excused', null, '2026-10-06 08:00+00', 30, '2026-10-06 07:00+00')$$, 'late excuse is treated as absence');
reset role;
select is((select count(*)::integer from public.session_credit_ledger where session_id = 'e7800000-0000-4000-8000-000000000006'), 1, 'late excuse consumes by no-show policy');
select is((select count(*)::integer from public.makeup_entitlements where source_session_id = 'e7800000-0000-4000-8000-000000000006'), 0, 'late excuse creates no makeup');
set local role authenticated;
select lives_ok($$select public.record_attendance('e7800000-0000-4000-8000-000000000007', 'teacher_absent', null, null, null, null)$$, 'teacher absence records');
reset role;
select is((select count(*)::integer from public.session_credit_ledger where session_id = 'e7800000-0000-4000-8000-000000000007'), 0, 'teacher absence does not consume');
select is((select count(*)::integer from public.teacher_payout_items where session_id = 'e7800000-0000-4000-8000-000000000007'), 0, 'teacher absence does not pay');
select is((select outside_period_cap from public.makeup_entitlements where source_session_id = 'e7800000-0000-4000-8000-000000000007'), true, 'teacher absence guarantees makeup outside cap');
select ok((select count(*) >= 1 from public.notifications where type = 'teacher_absent' and user_id = '10000000-0000-4000-8000-000000000001'), 'teacher absence alerts administration');
set local role authenticated;
select lives_ok($$select public.record_attendance('e7800000-0000-4000-8000-000000000008', 'cancelled_teacher', null, null, null, null)$$, 'teacher cancellation records');
reset role;
select is((select outside_period_cap from public.makeup_entitlements where source_session_id = 'e7800000-0000-4000-8000-000000000008'), true, 'teacher cancellation guarantees makeup');
reset role;

select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
select lives_ok($$select public.record_attendance('e7800000-0000-4000-8000-000000000009', 'cancelled_admin', null, null, null, null)$$, 'AAL2 administrator records administrative cancellation');
select is((select outside_period_cap from public.makeup_entitlements where source_session_id = 'e7800000-0000-4000-8000-000000000009'), true, 'administrative cancellation defaults to makeup');
reset role;

select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select lives_ok($$select public.record_attendance('e7800000-0000-4000-8000-000000000012', 'student_excused', null, null, null, '2026-10-11 18:00+00')$$, 'second timely excuse records');
select is((select count(*)::integer from public.makeup_entitlements where subscription_id = 'e7600000-0000-4000-8000-000000000001' and not outside_period_cap), 2, 'makeup cap admits second entitlement');
select lives_ok($$select public.record_attendance('e7800000-0000-4000-8000-000000000013', 'student_excused', null, null, null, '2026-10-12 18:00+00')$$, 'third timely excuse still records attendance');
select is((select count(*)::integer from public.makeup_entitlements where subscription_id = 'e7600000-0000-4000-8000-000000000001' and not outside_period_cap), 2, 'makeup cap suppresses third entitlement');
reset role;

select set_config('request.jwt.claims', '{"sub":"e7000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select lives_ok($$select public.record_attendance('e7800000-0000-4000-8000-000000000010', 'present', null, '2026-10-10 08:00+00', 30, null)$$, 'substitute records own session');
select is((select teacher_id from public.teacher_payout_items where session_id = 'e7800000-0000-4000-8000-000000000010'), 'e7200000-0000-4000-8000-000000000002'::uuid, 'substitute receives the payout item');
select is((select amount from public.teacher_payout_items where session_id = 'e7800000-0000-4000-8000-000000000010'), 150.00::numeric, 'substitute rate is snapshotted');
reset role;

select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select lives_ok($$select public.record_attendance('e7800000-0000-4000-8000-000000000011', 'present', null, '2026-10-11 08:00+00', 30, null)$$, 'completed makeup records');
reset role;
select is((select count(*)::integer from public.session_credit_ledger where session_id = 'e7800000-0000-4000-8000-000000000011'), 1, 'completed makeup consumes once');
select is((select kind from public.teacher_payout_items where session_id = 'e7800000-0000-4000-8000-000000000011'), 'makeup', 'completed makeup pays once as makeup');
set local role authenticated;
select is((select count(*)::integer from public.attendance), 12, 'teacher reads only their twelve attendance rows');
reset role;

select set_config('request.jwt.claims', '{"sub":"e7000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select is((select count(*)::integer from public.attendance), 0, 'unrelated teacher reads no attendance');
reset role;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select is((select count(*)::integer from public.attendance), 13, 'student reads own attendance history');
reset role;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select is((select count(*)::integer from public.attendance), 13, 'parent reads child attendance history');
reset role;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select throws_ok($$select * from public.attendance$$, '42501', null, 'anonymous cannot read attendance');

select * from finish();
rollback;
