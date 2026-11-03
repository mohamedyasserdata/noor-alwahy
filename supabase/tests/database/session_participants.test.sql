begin;

select plan(23);

select has_table('public', 'session_participants', 'session participants table exists');
select is(
  (select relrowsecurity from pg_class where oid = 'public.session_participants'::regclass),
  true,
  'session participants have RLS'
);
select has_column('public', 'sessions', 'format', 'sessions expose individual or group format');
select ok(
  to_regprocedure('public.manage_session_participant(uuid,uuid,uuid,text)') is not null,
  'guarded participant management RPC exists'
);
select is(
  has_function_privilege(
    'authenticated',
    'public.manage_session_participant(uuid,uuid,uuid,text)',
    'EXECUTE'
  ),
  true,
  'authenticated callers can reach the guarded RPC'
);
select is(
  has_function_privilege(
    'anon',
    'public.manage_session_participant(uuid,uuid,uuid,text)',
    'EXECUTE'
  ),
  false,
  'anonymous callers cannot manage participants'
);
select is(
  (select count(*)::integer from public.session_participants where is_primary),
  (select count(*)::integer from public.sessions),
  'every existing session has exactly one primary participant'
);

insert into auth.users (
  id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('da000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'participants.admin@test.local', '{"role":"admin"}', '{"full_name":"Participants Admin"}', now(), now()),
  ('da000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'participants.teacher@test.local', '{"role":"teacher"}', '{"full_name":"Participants Teacher"}', now(), now()),
  ('da000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'participants.primary@test.local', '{"role":"student"}', '{"full_name":"Primary Participant"}', now(), now()),
  ('da000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'participants.second@test.local', '{"role":"student"}', '{"full_name":"Second Participant"}', now(), now()),
  ('da000000-0000-4000-8000-000000000005', 'authenticated', 'authenticated', 'participants.stranger@test.local', '{"role":"student"}', '{"full_name":"Unrelated Student"}', now(), now());

insert into public.tracks (id, code, name_ar, name_en)
values ('da100000-0000-4000-8000-000000000001', 'group-participants', 'مشاركو المجموعة', 'Group participants');
insert into public.teachers (
  id, profile_id, gender, status, identity_verified_at, code_of_conduct_accepted_at
)
values (
  'da200000-0000-4000-8000-000000000001',
  'da000000-0000-4000-8000-000000000002',
  'male', 'active', now(), now()
);
insert into public.teacher_tracks (teacher_id, track_id)
values (
  'da200000-0000-4000-8000-000000000001',
  'da100000-0000-4000-8000-000000000001'
);
insert into public.students (id, profile_id, full_name, gender, timezone)
values
  ('da300000-0000-4000-8000-000000000001', 'da000000-0000-4000-8000-000000000003', 'Primary Participant', 'male', 'Africa/Cairo'),
  ('da300000-0000-4000-8000-000000000002', 'da000000-0000-4000-8000-000000000004', 'Second Participant', 'male', 'Africa/Cairo'),
  ('da300000-0000-4000-8000-000000000003', 'da000000-0000-4000-8000-000000000005', 'Unrelated Student', 'male', 'Africa/Cairo');
insert into public.teacher_assignments (
  id, student_id, teacher_id, track_id, assigned_by, reason
)
values
  ('da400000-0000-4000-8000-000000000001', 'da300000-0000-4000-8000-000000000001', 'da200000-0000-4000-8000-000000000001', 'da100000-0000-4000-8000-000000000001', 'da000000-0000-4000-8000-000000000001', 'Primary group assignment'),
  ('da400000-0000-4000-8000-000000000002', 'da300000-0000-4000-8000-000000000002', 'da200000-0000-4000-8000-000000000001', 'da100000-0000-4000-8000-000000000001', 'da000000-0000-4000-8000-000000000001', 'Second group assignment');
insert into public.sessions (
  id, assignment_id, student_id, teacher_id, scheduled_at, duration_min,
  zoom_override_url, zoom_published_at
)
values (
  'da500000-0000-4000-8000-000000000001',
  'da400000-0000-4000-8000-000000000001',
  'da300000-0000-4000-8000-000000000001',
  'da200000-0000-4000-8000-000000000001',
  statement_timestamp() + interval '5 minutes',
  30,
  'https://academy.zoom.us/j/group-participants',
  statement_timestamp()
);

select set_config(
  'request.jwt.claims',
  '{"sub":"da000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}',
  true
);
set local role authenticated;
select throws_ok(
  $$select public.manage_session_participant(
    'da500000-0000-4000-8000-000000000001',
    'da300000-0000-4000-8000-000000000002',
    'da400000-0000-4000-8000-000000000002',
    'add'
  )$$,
  '42501',
  'session_participant_admin_required',
  'teacher cannot change the scheduled participant list'
);

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"da000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',
  true
);
set local role authenticated;
select lives_ok(
  $$select public.manage_session_participant(
    'da500000-0000-4000-8000-000000000001',
    'da300000-0000-4000-8000-000000000002',
    'da400000-0000-4000-8000-000000000002',
    'add'
  )$$,
  'AAL2 administrator adds an assigned student to the session'
);
select is(
  (select format from public.sessions where id = 'da500000-0000-4000-8000-000000000001'),
  'group',
  'adding a second participant marks the session as group'
);
select is(
  (select count(*)::integer from public.session_participants where session_id = 'da500000-0000-4000-8000-000000000001'),
  2,
  'group session stores two distinct participants'
);
select ok(
  exists (
    select 1 from public.audit_logs
    where table_name = 'session_participants'
      and action = 'INSERT'
      and record_id is not null
  ),
  'participant addition is audited with a stable record id'
);

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"da000000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal1"}',
  true
);
set local role authenticated;
select is(
  (select count(*)::integer from public.sessions where id = 'da500000-0000-4000-8000-000000000001'),
  1,
  'second participant can read the shared session'
);
select is(
  (select count(*)::integer from public.get_session_join('da500000-0000-4000-8000-000000000001')),
  1,
  'second participant receives the published session link'
);

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"da000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}',
  true
);
set local role authenticated;
select is(
  (select count(*)::integer from public.sessions where id = 'da500000-0000-4000-8000-000000000001'),
  1,
  'primary participant keeps access to the session'
);

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"da000000-0000-4000-8000-000000000005","role":"authenticated","aal":"aal1"}',
  true
);
set local role authenticated;
select is(
  (select count(*)::integer from public.sessions where id = 'da500000-0000-4000-8000-000000000001'),
  0,
  'unrelated student cannot read the group session'
);
select is(
  (select count(*)::integer from public.get_session_join('da500000-0000-4000-8000-000000000001')),
  0,
  'unrelated student cannot receive the group session link'
);

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"da000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',
  true
);
set local role authenticated;
select throws_ok(
  $$select public.manage_session_participant(
    'da500000-0000-4000-8000-000000000001',
    'da300000-0000-4000-8000-000000000001',
    'da400000-0000-4000-8000-000000000001',
    'remove'
  )$$,
  'P0001',
  'primary_participant_cannot_be_removed',
  'primary participant cannot be removed from the session'
);
select lives_ok(
  $$select public.manage_session_participant(
    'da500000-0000-4000-8000-000000000001',
    'da300000-0000-4000-8000-000000000002',
    'da400000-0000-4000-8000-000000000002',
    'remove'
  )$$,
  'AAL2 administrator removes a secondary participant'
);
select is(
  (select format from public.sessions where id = 'da500000-0000-4000-8000-000000000001'),
  'individual',
  'removing the last secondary participant restores individual format'
);
select is(
  (select count(*)::integer from public.session_participants where session_id = 'da500000-0000-4000-8000-000000000001'),
  1,
  'only the primary participant remains'
);
select ok(
  exists (
    select 1 from public.audit_logs
    where table_name = 'session_participants'
      and action = 'DELETE'
      and record_id is not null
  ),
  'participant removal is audited with a stable record id'
);

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"da000000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal1"}',
  true
);
set local role authenticated;
select is(
  (select count(*)::integer from public.sessions where id = 'da500000-0000-4000-8000-000000000001'),
  0,
  'removed participant immediately loses session access'
);

select * from finish();
rollback;
