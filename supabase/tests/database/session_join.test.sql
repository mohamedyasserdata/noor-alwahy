begin;

select plan(27);

select ok(to_regprocedure('public.get_session_join(uuid)') is not null, 'get_session_join(uuid) exists');
select is((select prosecdef from pg_proc where oid = 'public.get_session_join(uuid)'::regprocedure), true, 'join RPC is security definer');
select is((select array_to_string(proconfig, ',') from pg_proc where oid = 'public.get_session_join(uuid)'::regprocedure), 'search_path=""', 'join RPC pins an empty search path');
select is(has_function_privilege('public', 'public.get_session_join(uuid)', 'EXECUTE'), false, 'public cannot execute join RPC');
select is(has_function_privilege('anon', 'public.get_session_join(uuid)', 'EXECUTE'), false, 'anonymous cannot execute join RPC');
select is(has_function_privilege('authenticated', 'public.get_session_join(uuid)', 'EXECUTE'), true, 'authenticated users can execute join RPC');

insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('c7000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'join.stranger.teacher@test.local', '{"role":"teacher"}', '{"full_name":"Stranger Teacher"}', now(), now()),
  ('c7000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'join.stranger.student@test.local', '{"role":"student"}', '{"full_name":"Stranger Student"}', now(), now());

insert into public.tracks (id, code, name_ar, name_en)
values ('c7100000-0000-4000-8000-000000000001', 'join-test', 'الانضمام', 'Join');
insert into public.teachers (id, profile_id, gender, status, identity_verified_at, code_of_conduct_accepted_at)
values
  ('c7200000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', 'male', 'active', now(), now()),
  ('c7200000-0000-4000-8000-000000000002', 'c7000000-0000-4000-8000-000000000001', 'male', 'active', now(), now());
insert into public.teacher_tracks (teacher_id, track_id)
values
  ('c7200000-0000-4000-8000-000000000001', 'c7100000-0000-4000-8000-000000000001'),
  ('c7200000-0000-4000-8000-000000000002', 'c7100000-0000-4000-8000-000000000001');
insert into public.students (id, profile_id, full_name, gender, timezone)
values ('c7300000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000003', 'Join Student', 'male', 'Africa/Cairo');
insert into public.guardians (id, profile_id)
values ('c7400000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000004');
insert into public.student_guardians (student_id, guardian_id, is_primary)
values ('c7300000-0000-4000-8000-000000000001', 'c7400000-0000-4000-8000-000000000001', true);
insert into public.teacher_assignments (id, student_id, teacher_id, track_id, assigned_by, reason)
values ('c7500000-0000-4000-8000-000000000001', 'c7300000-0000-4000-8000-000000000001', 'c7200000-0000-4000-8000-000000000001', 'c7100000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Join test');
insert into public.teacher_zoom_settings (teacher_id, join_url, meeting_id, passcode)
values ('c7200000-0000-4000-8000-000000000001', 'https://academy.zoom.us/j/default', 'default-id', 'default-secret');
insert into public.sessions (id, assignment_id, student_id, teacher_id, scheduled_at, duration_min)
values ('c7600000-0000-4000-8000-000000000001', 'c7500000-0000-4000-8000-000000000001', 'c7300000-0000-4000-8000-000000000001', 'c7200000-0000-4000-8000-000000000001', statement_timestamp() + interval '11 minutes', 30);

select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select is((select count(*)::integer from public.get_session_join('c7600000-0000-4000-8000-000000000001')), 0, 'student gets no row eleven minutes before start');

reset role;
update public.sessions set scheduled_at = statement_timestamp() + interval '9 minutes' where id = 'c7600000-0000-4000-8000-000000000001';
set local role authenticated;
select is((select count(*)::integer from public.get_session_join('c7600000-0000-4000-8000-000000000001')), 1, 'student gets one row nine minutes before start');
select is((select join_url from public.get_session_join('c7600000-0000-4000-8000-000000000001')), 'https://academy.zoom.us/j/default', 'teacher default URL is returned');
select is((select meeting_id from public.get_session_join('c7600000-0000-4000-8000-000000000001')), 'default-id', 'teacher default meeting id is returned');
select is((select passcode from public.get_session_join('c7600000-0000-4000-8000-000000000001')), 'default-secret', 'teacher default passcode is returned');

reset role;
update public.sessions set zoom_override_url = 'https://academy.zoom.us/j/override', zoom_passcode = 'override-secret' where id = 'c7600000-0000-4000-8000-000000000001';
set local role authenticated;
select is((select join_url from public.get_session_join('c7600000-0000-4000-8000-000000000001')), 'https://academy.zoom.us/j/override', 'session URL overrides teacher default');
select is((select meeting_id from public.get_session_join('c7600000-0000-4000-8000-000000000001')), 'default-id', 'missing override field falls back to teacher default');
select is((select passcode from public.get_session_join('c7600000-0000-4000-8000-000000000001')), 'override-secret', 'session passcode overrides teacher default');

reset role;
update public.sessions set scheduled_at = statement_timestamp() - interval '44 minutes' where id = 'c7600000-0000-4000-8000-000000000001';
set local role authenticated;
select is((select count(*)::integer from public.get_session_join('c7600000-0000-4000-8000-000000000001')), 1, 'join remains available fourteen minutes after end');

reset role;
update public.sessions set scheduled_at = statement_timestamp() - interval '46 minutes' where id = 'c7600000-0000-4000-8000-000000000001';
set local role authenticated;
select is((select count(*)::integer from public.get_session_join('c7600000-0000-4000-8000-000000000001')), 0, 'join is hidden sixteen minutes after end');

reset role;
update public.sessions set scheduled_at = statement_timestamp(), status = 'cancelled' where id = 'c7600000-0000-4000-8000-000000000001';
set local role authenticated;
select is((select count(*)::integer from public.get_session_join('c7600000-0000-4000-8000-000000000001')), 0, 'cancelled session never releases Zoom data');

reset role;
update public.sessions set status = 'held' where id = 'c7600000-0000-4000-8000-000000000001';
set local role authenticated;
select is((select count(*)::integer from public.get_session_join('c7600000-0000-4000-8000-000000000001')), 1, 'held session remains joinable within the window');

reset role;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select is((select count(*)::integer from public.get_session_join('c7600000-0000-4000-8000-000000000001')), 1, 'actual teacher can get the join row');

reset role;
select set_config('request.jwt.claims', '{"sub":"c7000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select is((select count(*)::integer from public.get_session_join('c7600000-0000-4000-8000-000000000001')), 0, 'unrelated teacher gets no row');

reset role;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select is((select count(*)::integer from public.get_session_join('c7600000-0000-4000-8000-000000000001')), 1, 'linked parent can get the join row');

reset role;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
select is((select count(*)::integer from public.get_session_join('c7600000-0000-4000-8000-000000000001')), 1, 'AAL2 administrator can get the join row');

reset role;
select set_config('request.jwt.claims', '{"sub":"c7000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select is((select count(*)::integer from public.get_session_join('c7600000-0000-4000-8000-000000000001')), 0, 'unrelated student gets no row');

reset role;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select throws_ok($$select * from public.get_session_join('c7600000-0000-4000-8000-000000000001')$$, '42501', null, 'anonymous caller cannot execute join RPC');

reset role;
select ok((select count(*) >= 12 from public.audit_logs where action = 'SESSION_JOIN_RELEASE' and table_name = 'sessions' and record_id = 'c7600000-0000-4000-8000-000000000001'), 'successful releases are audited');
select ok((select bool_and(not coalesce(after, '{}'::jsonb) ?| array['join_url','meeting_id','passcode','zoom_override_url','zoom_meeting_id','zoom_passcode']) from public.audit_logs where action = 'SESSION_JOIN_RELEASE'), 'join audit rows contain no Zoom secrets');

delete from public.teacher_zoom_settings where teacher_id = 'c7200000-0000-4000-8000-000000000001';
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select is((select count(*)::integer from public.get_session_join('c7600000-0000-4000-8000-000000000001')), 1, 'session override remains available without teacher defaults');

select * from finish();
rollback;
