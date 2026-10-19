begin;

select plan(40);

select has_table('public', 'calendar_feed_tokens', 'calendar feed token table exists');
select is(
  (select relrowsecurity from pg_class where oid = 'public.calendar_feed_tokens'::regclass),
  true,
  'calendar feed tokens have RLS enabled'
);
select has_column('public', 'calendar_feed_tokens', 'token_hash', 'only a token hash is stored');
select col_type_is('public', 'calendar_feed_tokens', 'token_hash', 'text', 'token hash uses text storage');
select has_trigger('public', 'calendar_feed_tokens', 'calendar_feed_tokens_set_updated_at', 'token timestamps are maintained');
select has_trigger('public', 'calendar_feed_tokens', 'calendar_feed_tokens_audit', 'token changes are audited safely');
select is(has_table_privilege('anon', 'public.calendar_feed_tokens', 'select'), false, 'anonymous users cannot read token hashes');
select is(has_table_privilege('authenticated', 'public.calendar_feed_tokens', 'select'), false, 'authenticated users cannot read token hashes');
select is(has_table_privilege('service_role', 'public.calendar_feed_tokens', 'select'), true, 'service role can operate the token store');

select ok(to_regprocedure('public.rotate_calendar_feed_token(text)') is not null, 'token rotation RPC exists');
select is((select prosecdef from pg_proc where oid = 'public.rotate_calendar_feed_token(text)'::regprocedure), true, 'token rotation RPC is security definer');
select is((select array_to_string(proconfig, ',') from pg_proc where oid = 'public.rotate_calendar_feed_token(text)'::regprocedure), 'search_path=""', 'token rotation RPC pins an empty search path');
select is(has_function_privilege('public', 'public.rotate_calendar_feed_token(text)', 'execute'), false, 'PUBLIC cannot rotate tokens');
select is(has_function_privilege('anon', 'public.rotate_calendar_feed_token(text)', 'execute'), false, 'anonymous users cannot rotate tokens');
select is(has_function_privilege('authenticated', 'public.rotate_calendar_feed_token(text)', 'execute'), true, 'authenticated users can rotate their token');

select ok(to_regprocedure('public.revoke_calendar_feed_token()') is not null, 'token revocation RPC exists');
select is(has_function_privilege('authenticated', 'public.revoke_calendar_feed_token()', 'execute'), true, 'authenticated users can revoke their token');

select ok(to_regprocedure('public.get_calendar_feed(text)') is not null, 'public calendar feed RPC exists');
select is((select prosecdef from pg_proc where oid = 'public.get_calendar_feed(text)'::regprocedure), true, 'public calendar feed RPC is security definer');
select is((select array_to_string(proconfig, ',') from pg_proc where oid = 'public.get_calendar_feed(text)'::regprocedure), 'search_path=""', 'public feed RPC pins an empty search path');
select is(has_function_privilege('public', 'public.get_calendar_feed(text)', 'execute'), false, 'PUBLIC has no implicit feed execution');
select is(has_function_privilege('anon', 'public.get_calendar_feed(text)', 'execute'), true, 'anonymous subscription requests can resolve a valid token');
select is(has_function_privilege('authenticated', 'public.get_calendar_feed(text)', 'execute'), true, 'authenticated subscription requests can resolve a valid token');

select ok(to_regprocedure('public.get_my_calendar_feed()') is not null, 'authenticated calendar download RPC exists');
select is(has_function_privilege('anon', 'public.get_my_calendar_feed()', 'execute'), false, 'anonymous users cannot download an account calendar');
select is(has_function_privilege('authenticated', 'public.get_my_calendar_feed()', 'execute'), true, 'authenticated users can download their calendar');

insert into public.tracks (id, code, name_ar, name_en)
values ('e8100000-0000-4000-8000-000000000001', 'calendar-test', 'اختبار التقويم', 'Calendar test');

insert into public.teachers (id, profile_id, gender, status, identity_verified_at, code_of_conduct_accepted_at)
values ('e8200000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', 'male', 'active', now(), now());

insert into public.teacher_tracks (teacher_id, track_id)
values ('e8200000-0000-4000-8000-000000000001', 'e8100000-0000-4000-8000-000000000001');

insert into public.students (id, profile_id, full_name, gender, timezone)
values ('e8300000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000003', 'Calendar Student', 'male', 'Africa/Cairo');

insert into public.guardians (id, profile_id)
values ('e8400000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000004');

insert into public.student_guardians (student_id, guardian_id, is_primary)
values ('e8300000-0000-4000-8000-000000000001', 'e8400000-0000-4000-8000-000000000001', true);

insert into public.teacher_assignments (id, student_id, teacher_id, track_id, assigned_by, reason)
values ('e8500000-0000-4000-8000-000000000001', 'e8300000-0000-4000-8000-000000000001', 'e8200000-0000-4000-8000-000000000001', 'e8100000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Calendar export test');

insert into public.sessions (
  id, assignment_id, student_id, teacher_id, scheduled_at, duration_min,
  zoom_override_url, zoom_meeting_id, zoom_passcode
)
values (
  'e8600000-0000-4000-8000-000000000001',
  'e8500000-0000-4000-8000-000000000001',
  'e8300000-0000-4000-8000-000000000001',
  'e8200000-0000-4000-8000-000000000001',
  statement_timestamp() + interval '2 days',
  30,
  'https://academy.zoom.us/j/calendar-secret',
  'calendar-meeting-secret',
  'calendar-passcode-secret'
);

select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;

select throws_ok(
  $$select public.rotate_calendar_feed_token('raw-token-must-not-be-stored')$$,
  '22023',
  'invalid_calendar_token_hash',
  'rotation rejects anything except a lowercase SHA-256 hash'
);
select lives_ok(
  $$select public.rotate_calendar_feed_token('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')$$,
  'student can rotate their calendar token hash'
);

reset role;
select is(
  (select token_hash from public.calendar_feed_tokens where user_id = '10000000-0000-4000-8000-000000000003'),
  'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  'the database stores exactly the supplied SHA-256 hash'
);
select ok(
  (select bool_and(
    not coalesce(before, '{}'::jsonb) ? 'token_hash'
    and not coalesce(after, '{}'::jsonb) ? 'token_hash'
    and coalesce(before::text, '') not like '%aaaaaaaaaaaaaaaa%'
    and coalesce(after::text, '') not like '%aaaaaaaaaaaaaaaa%'
  ) from public.audit_logs where table_name = 'calendar_feed_tokens'),
  'token audit records contain neither the hash field nor its value'
);

select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select is(
  (select count(session_id)::integer from public.get_calendar_feed('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')),
  1,
  'a valid token returns only its visible upcoming event'
);
select is(
  (select owner_timezone || '|' || owner_locale || '|' || status from public.get_calendar_feed('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')),
  'Africa/Cairo|ar|scheduled',
  'feed data includes the owner timezone, locale, and safe event status'
);
select is(
  (select count(*)::integer from public.get_calendar_feed('bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb')),
  0,
  'an unknown token hash resolves no account metadata or events'
);

reset role;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select is((select count(session_id)::integer from public.get_my_calendar_feed()), 1, 'student sees their own session in an authenticated download');

reset role;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select is((select count(session_id)::integer from public.get_my_calendar_feed()), 1, 'teacher sees the assigned session in their calendar');

reset role;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select is((select count(session_id)::integer from public.get_my_calendar_feed()), 1, 'parent sees the linked child session in their calendar');

reset role;
insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values ('e8700000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'calendar.stranger@test.local', '{"role":"student"}', '{"full_name":"Calendar Stranger"}', now(), now());
select set_config('request.jwt.claims', '{"sub":"e8700000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select is((select count(session_id)::integer from public.get_my_calendar_feed()), 0, 'unrelated user receives no session data');

reset role;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select lives_ok($$select public.revoke_calendar_feed_token()$$, 'student can revoke their token');

reset role;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select is(
  (select count(*)::integer from public.get_calendar_feed('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')),
  0,
  'revoked token resolves no account metadata or events'
);

reset role;
select ok(
  (select bool_and(
    not coalesce(before, '{}'::jsonb) ? 'token_hash'
    and not coalesce(after, '{}'::jsonb) ? 'token_hash'
  ) from public.audit_logs where table_name = 'calendar_feed_tokens'),
  'revocation audit also omits the token hash'
);

select * from finish();
rollback;
