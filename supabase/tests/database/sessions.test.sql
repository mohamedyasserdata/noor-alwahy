begin;

select plan(35);

select has_table('public', 'sessions', 'sessions table exists');
select is(
  (select relrowsecurity from pg_class where oid = 'public.sessions'::regclass),
  true,
  'sessions RLS is enabled'
);
select has_trigger('public', 'sessions', 'sessions_set_ends_at', 'ends_at trigger exists');
select has_trigger('public', 'sessions', 'sessions_enforce_gender', 'session gender trigger exists');
select has_trigger('public', 'sessions', 'sessions_audit', 'session audit trigger exists');
select ok(
  exists (select 1 from pg_constraint where conrelid = 'public.sessions'::regclass and conname = 'no_teacher_overlap' and contype = 'x'),
  'teacher overlap exclusion exists'
);
select ok(
  exists (select 1 from pg_constraint where conrelid = 'public.sessions'::regclass and conname = 'no_student_overlap' and contype = 'x'),
  'student overlap exclusion exists'
);
select has_index('public', 'sessions', 'sessions_slot_scheduled_idx', 'slot idempotency index exists');

insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('a7000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'session.teacher2@test.local', '{"role":"teacher"}', '{"full_name":"Second Teacher"}', now(), now()),
  ('a7000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'session.teacher3@test.local', '{"role":"teacher"}', '{"full_name":"Female Teacher"}', now(), now());

insert into public.tracks (id, code, name_ar, name_en)
values ('a7100000-0000-4000-8000-000000000001', 'session-test', 'حصص', 'Sessions');

insert into public.teachers (id, profile_id, gender, status, identity_verified_at, code_of_conduct_accepted_at)
values
  ('a7200000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', 'male', 'active', now(), now()),
  ('a7200000-0000-4000-8000-000000000002', 'a7000000-0000-4000-8000-000000000001', 'male', 'active', now(), now()),
  ('a7200000-0000-4000-8000-000000000003', 'a7000000-0000-4000-8000-000000000002', 'female', 'active', now(), now());

insert into public.teacher_tracks (teacher_id, track_id)
values
  ('a7200000-0000-4000-8000-000000000001', 'a7100000-0000-4000-8000-000000000001'),
  ('a7200000-0000-4000-8000-000000000002', 'a7100000-0000-4000-8000-000000000001'),
  ('a7200000-0000-4000-8000-000000000003', 'a7100000-0000-4000-8000-000000000001');

insert into public.students (id, profile_id, full_name, gender, timezone)
values
  ('a7300000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000003', 'Session Student', 'male', 'Africa/Cairo'),
  ('a7300000-0000-4000-8000-000000000002', null, 'Second Student', 'male', 'Africa/Cairo'),
  ('a7300000-0000-4000-8000-000000000003', null, 'Female Student', 'female', 'Africa/Cairo');

insert into public.guardians (id, profile_id)
values ('a7400000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000004');
insert into public.student_guardians (student_id, guardian_id, is_primary)
values ('a7300000-0000-4000-8000-000000000001', 'a7400000-0000-4000-8000-000000000001', true);

insert into public.teacher_assignments (id, student_id, teacher_id, track_id, assigned_by, reason)
values
  ('a7500000-0000-4000-8000-000000000001', 'a7300000-0000-4000-8000-000000000001', 'a7200000-0000-4000-8000-000000000001', 'a7100000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Session test'),
  ('a7500000-0000-4000-8000-000000000002', 'a7300000-0000-4000-8000-000000000002', 'a7200000-0000-4000-8000-000000000001', 'a7100000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Second session test'),
  ('a7500000-0000-4000-8000-000000000003', 'a7300000-0000-4000-8000-000000000003', 'a7200000-0000-4000-8000-000000000003', 'a7100000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Female session test');

insert into public.schedule_slots (id, assignment_id, weekday, local_start_time, duration_min, anchor_timezone)
values ('a7600000-0000-4000-8000-000000000001', 'a7500000-0000-4000-8000-000000000001', 2, '10:00', 30, 'Africa/Cairo');

select lives_ok(
  $$insert into public.sessions (id, assignment_id, student_id, teacher_id, slot_id, scheduled_at, duration_min, zoom_override_url, zoom_meeting_id, zoom_passcode)
    values ('a7700000-0000-4000-8000-000000000001', 'a7500000-0000-4000-8000-000000000001', 'a7300000-0000-4000-8000-000000000001', 'a7200000-0000-4000-8000-000000000001', 'a7600000-0000-4000-8000-000000000001', '2030-01-01 10:00:00+00', 30, 'https://academy.zoom.us/j/secret', '123456', 'secret-pass')$$,
  'matching session is accepted'
);
select is((select ends_at from public.sessions where id = 'a7700000-0000-4000-8000-000000000001'), '2030-01-01 10:30:00+00'::timestamptz, 'ends_at is derived on insert');
select lives_ok($$update public.sessions set duration_min = 45 where id = 'a7700000-0000-4000-8000-000000000001'$$, 'duration can be updated');
select is((select ends_at from public.sessions where id = 'a7700000-0000-4000-8000-000000000001'), '2030-01-01 10:45:00+00'::timestamptz, 'ends_at is recomputed on update');
select throws_ok(
  $$insert into public.sessions (student_id, teacher_id, scheduled_at, duration_min) values ('a7300000-0000-4000-8000-000000000003', 'a7200000-0000-4000-8000-000000000001', '2030-01-01 14:00:00+00', 30)$$,
  'P0001', 'gender_mismatch', 'opposite-gender session is rejected'
);
select throws_ok(
  $$insert into public.sessions (student_id, teacher_id, scheduled_at, duration_min) values ('a7300000-0000-4000-8000-000000000002', 'a7200000-0000-4000-8000-000000000001', '2030-01-01 10:15:00+00', 30)$$,
  '23P01', null, 'overlapping teacher session is rejected'
);
select throws_ok(
  $$insert into public.sessions (student_id, teacher_id, scheduled_at, duration_min) values ('a7300000-0000-4000-8000-000000000001', 'a7200000-0000-4000-8000-000000000002', '2030-01-01 10:15:00+00', 30)$$,
  '23P01', null, 'overlapping student session is rejected'
);
select lives_ok(
  $$insert into public.sessions (id, assignment_id, student_id, teacher_id, scheduled_at, duration_min) values ('a7700000-0000-4000-8000-000000000003', 'a7500000-0000-4000-8000-000000000002', 'a7300000-0000-4000-8000-000000000002', 'a7200000-0000-4000-8000-000000000001', '2030-01-01 10:45:00+00', 30)$$,
  'adjacent session is accepted'
);
select lives_ok(
  $$insert into public.sessions (id, student_id, teacher_id, scheduled_at, duration_min, status) values ('a7700000-0000-4000-8000-000000000004', 'a7300000-0000-4000-8000-000000000002', 'a7200000-0000-4000-8000-000000000001', '2030-01-01 10:10:00+00', 30, 'cancelled')$$,
  'cancelled session does not block scheduling'
);
select throws_ok(
  $$insert into public.sessions (student_id, teacher_id, scheduled_at, duration_min, status) values ('a7300000-0000-4000-8000-000000000001', 'a7200000-0000-4000-8000-000000000002', '2030-01-01 10:20:00+00', 30, 'held')$$,
  '23P01', null, 'held session still blocks overlap'
);
select lives_ok(
  $$insert into public.sessions (id, student_id, teacher_id, scheduled_at, duration_min, status) values ('a7700000-0000-4000-8000-000000000005', 'a7300000-0000-4000-8000-000000000002', 'a7200000-0000-4000-8000-000000000001', '2030-01-01 10:20:00+00', 30, 'missed')$$,
  'missed session does not block scheduling'
);
select throws_ok(
  $$insert into public.sessions (assignment_id, student_id, teacher_id, slot_id, scheduled_at, duration_min) values ('a7500000-0000-4000-8000-000000000001', 'a7300000-0000-4000-8000-000000000001', 'a7200000-0000-4000-8000-000000000001', 'a7600000-0000-4000-8000-000000000001', '2030-01-01 10:00:00+00', 30)$$,
  '23505', null, 'same slot occurrence cannot be generated twice'
);
select throws_ok(
  $$insert into public.sessions (student_id, teacher_id, scheduled_at, duration_min) values ('a7300000-0000-4000-8000-000000000002', 'a7200000-0000-4000-8000-000000000002', '2030-01-01 16:00:00+00', 5)$$,
  '23514', null, 'invalid duration is rejected'
);
select lives_ok(
  $$insert into public.sessions (id, assignment_id, student_id, teacher_id, original_teacher_id, scheduled_at, duration_min) values ('a7700000-0000-4000-8000-000000000002', 'a7500000-0000-4000-8000-000000000001', 'a7300000-0000-4000-8000-000000000001', 'a7200000-0000-4000-8000-000000000002', 'a7200000-0000-4000-8000-000000000001', '2030-01-01 12:00:00+00', 30)$$,
  'same-gender substitute session is accepted'
);
select throws_ok(
  $$update public.teachers set gender = 'female' where id = 'a7200000-0000-4000-8000-000000000002'$$,
  'P0001', 'gender_change_blocked_active_session', 'substitute teacher gender cannot invalidate an active session'
);
update public.teacher_assignments
set status = 'ended', end_date = current_date
where id = 'a7500000-0000-4000-8000-000000000002';
select throws_ok(
  $$update public.students set gender = 'female' where id = 'a7300000-0000-4000-8000-000000000002'$$,
  'P0001', 'gender_change_blocked_active_session', 'student gender cannot invalidate an active session'
);
select ok(
  (select bool_and(not coalesce(before, '{}'::jsonb) ?| array['zoom_override_url','zoom_meeting_id','zoom_passcode'] and not coalesce(after, '{}'::jsonb) ?| array['zoom_override_url','zoom_meeting_id','zoom_passcode']) from public.audit_logs where table_name = 'sessions'),
  'session audit rows omit Zoom secrets'
);

select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
select ok((select count(*) >= 5 from public.sessions), 'admin reads all sessions');
select lives_ok(
  $$insert into public.sessions (student_id, teacher_id, scheduled_at, duration_min) values ('a7300000-0000-4000-8000-000000000003', 'a7200000-0000-4000-8000-000000000003', '2030-01-01 15:00:00+00', 30)$$,
  'admin creates a session through RLS'
);

reset role;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select is((select count(*)::integer from public.sessions), 4, 'teacher reads only their sessions');
select throws_ok(
  $$insert into public.sessions (student_id, teacher_id, scheduled_at, duration_min) values ('a7300000-0000-4000-8000-000000000001', 'a7200000-0000-4000-8000-000000000001', '2030-01-01 18:00:00+00', 30)$$,
  '42501', null, 'teacher cannot create sessions directly'
);

reset role;
select set_config('request.jwt.claims', '{"sub":"a7000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select is((select count(*)::integer from public.sessions), 1, 'substitute teacher reads only their session');

reset role;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select is((select count(*)::integer from public.sessions), 2, 'student reads only their sessions');
select throws_ok($$select zoom_override_url from public.sessions$$, '42501', null, 'student cannot read direct Zoom columns');

reset role;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select is((select count(*)::integer from public.sessions), 2, 'parent reads only child sessions');

reset role;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000005","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select is((select count(*)::integer from public.sessions), 0, 'unrelated user reads no sessions');

reset role;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select throws_ok($$select id from public.sessions$$, '42501', null, 'anonymous cannot read sessions');

select * from finish();
rollback;
