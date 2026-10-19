begin;

select plan(38);

select has_table('public', 'subscriptions', 'minimal subscriptions table exists');
select has_table('public', 'session_credit_ledger', 'session credit ledger exists');
select has_table('public', 'job_runs', 'job run ledger exists');
select is((select relrowsecurity from pg_class where oid = 'public.subscriptions'::regclass), true, 'subscriptions RLS is enabled');
select is((select relrowsecurity from pg_class where oid = 'public.session_credit_ledger'::regclass), true, 'credit ledger RLS is enabled');
select is((select relrowsecurity from pg_class where oid = 'public.job_runs'::regclass), true, 'job runs RLS is enabled');
select ok(to_regprocedure('public.generate_sessions(date,integer)') is not null, 'generate_sessions(date, integer) exists');
select is(has_function_privilege('public', 'public.generate_sessions(date,integer)', 'EXECUTE'), false, 'public cannot execute generator');
select is(has_function_privilege('anon', 'public.generate_sessions(date,integer)', 'EXECUTE'), false, 'anonymous cannot execute generator');
select is(has_function_privilege('authenticated', 'public.generate_sessions(date,integer)', 'EXECUTE'), false, 'authenticated clients cannot execute generator');
select is(has_function_privilege('service_role', 'public.generate_sessions(date,integer)', 'EXECUTE'), true, 'service role can execute generator');
select ok(exists(select 1 from pg_extension where extname = 'pg_cron'), 'pg_cron is installed');
select is((select count(*)::integer from cron.job where jobname = 'generate-sessions-daily'), 1, 'one named generation job exists');
select is((select schedule from cron.job where jobname = 'generate-sessions-daily'), '0 2 * * *', 'generation runs daily at 02:00 UTC');
select ok((select command like '%generate_sessions()%' from cron.job where jobname = 'generate-sessions-daily'), 'cron calls the no-argument generator');

insert into public.tracks (id, code, name_ar, name_en)
values ('b8100000-0000-4000-8000-000000000001', 'generation-test', 'توليد', 'Generation');

insert into public.teachers (id, profile_id, gender, status, identity_verified_at, code_of_conduct_accepted_at)
values ('b8200000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', 'male', 'active', now(), now());

insert into public.teacher_tracks (teacher_id, track_id)
values ('b8200000-0000-4000-8000-000000000001', 'b8100000-0000-4000-8000-000000000001');

insert into public.students (id, profile_id, full_name, gender, timezone)
values
  ('b8300000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000003', 'DST Student', 'male', 'Africa/Cairo'),
  ('b8300000-0000-4000-8000-000000000002', null, 'Paused Student', 'male', 'Africa/Cairo'),
  ('b8300000-0000-4000-8000-000000000003', null, 'Inactive Subscription Student', 'male', 'Africa/Cairo'),
  ('b8300000-0000-4000-8000-000000000004', null, 'No Credit Student', 'male', 'Africa/Cairo');

insert into public.guardians (id, profile_id)
values ('b8350000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000004');
insert into public.student_guardians (student_id, guardian_id, is_primary)
values ('b8300000-0000-4000-8000-000000000001', 'b8350000-0000-4000-8000-000000000001', true);

insert into public.teacher_assignments (id, student_id, teacher_id, track_id, status, start_date, assigned_by, reason)
values
  ('b8400000-0000-4000-8000-000000000001', 'b8300000-0000-4000-8000-000000000001', 'b8200000-0000-4000-8000-000000000001', 'b8100000-0000-4000-8000-000000000001', 'active', '2026-01-01', '10000000-0000-4000-8000-000000000001', 'DST generation'),
  ('b8400000-0000-4000-8000-000000000002', 'b8300000-0000-4000-8000-000000000002', 'b8200000-0000-4000-8000-000000000001', 'b8100000-0000-4000-8000-000000000001', 'active', '2026-01-01', '10000000-0000-4000-8000-000000000001', 'Paused generation'),
  ('b8400000-0000-4000-8000-000000000003', 'b8300000-0000-4000-8000-000000000003', 'b8200000-0000-4000-8000-000000000001', 'b8100000-0000-4000-8000-000000000001', 'active', '2026-01-01', '10000000-0000-4000-8000-000000000001', 'Inactive subscription'),
  ('b8400000-0000-4000-8000-000000000004', 'b8300000-0000-4000-8000-000000000004', 'b8200000-0000-4000-8000-000000000001', 'b8100000-0000-4000-8000-000000000001', 'active', '2026-01-01', '10000000-0000-4000-8000-000000000001', 'No credit');

insert into public.schedule_slots (id, assignment_id, weekday, local_start_time, duration_min, anchor_timezone)
values
  ('b8500000-0000-4000-8000-000000000001', 'b8400000-0000-4000-8000-000000000001', 5, '10:00', 30, 'Africa/Cairo'),
  ('b8500000-0000-4000-8000-000000000002', 'b8400000-0000-4000-8000-000000000002', 5, '11:00', 30, 'Africa/Cairo'),
  ('b8500000-0000-4000-8000-000000000003', 'b8400000-0000-4000-8000-000000000003', 5, '12:00', 30, 'Africa/Cairo'),
  ('b8500000-0000-4000-8000-000000000004', 'b8400000-0000-4000-8000-000000000004', 5, '13:00', 30, 'Africa/Cairo');

update public.teacher_assignments
set status = 'paused'
where id = 'b8400000-0000-4000-8000-000000000002';

insert into public.subscriptions (id, student_id, status, start_date, current_period_start, current_period_end, sessions_per_period)
values
  ('b8600000-0000-4000-8000-000000000001', 'b8300000-0000-4000-8000-000000000001', 'active', '2026-04-01', '2026-04-01', '2026-05-31', 8),
  ('b8600000-0000-4000-8000-000000000002', 'b8300000-0000-4000-8000-000000000002', 'active', '2026-04-01', '2026-04-01', '2026-05-31', 8),
  ('b8600000-0000-4000-8000-000000000003', 'b8300000-0000-4000-8000-000000000003', 'paused', '2026-04-01', '2026-04-01', '2026-05-31', 8),
  ('b8600000-0000-4000-8000-000000000004', 'b8300000-0000-4000-8000-000000000004', 'active', '2026-04-01', '2026-04-01', '2026-05-31', 8);

insert into public.session_credit_ledger (subscription_id, delta, reason, note)
values
  ('b8600000-0000-4000-8000-000000000001', 3, 'grant', 'generation fixture'),
  ('b8600000-0000-4000-8000-000000000002', 4, 'grant', 'paused fixture'),
  ('b8600000-0000-4000-8000-000000000003', 4, 'grant', 'inactive fixture');

select is(public.generate_sessions('2026-04-17', 28), 3, 'generator creates only the three credited occurrences');
select is((select count(*)::integer from public.sessions where assignment_id = 'b8400000-0000-4000-8000-000000000001'), 3, 'credit balance caps generated sessions');
select is((select scheduled_at from public.sessions where slot_id = 'b8500000-0000-4000-8000-000000000001' order by scheduled_at limit 1), '2026-04-17 08:00:00+00'::timestamptz, 'Cairo winter offset is applied before DST');
select is((select scheduled_at from public.sessions where slot_id = 'b8500000-0000-4000-8000-000000000001' order by scheduled_at offset 1 limit 1), '2026-04-24 07:00:00+00'::timestamptz, 'Cairo summer offset is applied on the DST boundary');
select is((select scheduled_at from public.sessions where slot_id = 'b8500000-0000-4000-8000-000000000001' order by scheduled_at offset 2 limit 1), '2026-05-01 07:00:00+00'::timestamptz, 'Cairo summer offset remains in effect');
select ok((select bool_and((scheduled_at at time zone 'Africa/Cairo')::time = '10:00'::time) from public.sessions where assignment_id = 'b8400000-0000-4000-8000-000000000001'), 'anchor wall-clock remains 10:00 across DST');
select is((select count(*)::integer from public.sessions where assignment_id = 'b8400000-0000-4000-8000-000000000002'), 0, 'paused assignments generate nothing');
select is((select count(*)::integer from public.sessions where assignment_id = 'b8400000-0000-4000-8000-000000000003'), 0, 'inactive subscriptions generate nothing');
select is((select count(*)::integer from public.sessions where assignment_id = 'b8400000-0000-4000-8000-000000000004'), 0, 'zero credit generates nothing');
select is(public.generate_sessions('2026-04-17', 28), 0, 'rerunning the same window is idempotent');
select is((select count(*)::integer from public.sessions where assignment_id = 'b8400000-0000-4000-8000-000000000001'), 3, 'idempotent rerun creates no duplicates');

insert into public.session_credit_ledger (subscription_id, delta, reason, note)
values ('b8600000-0000-4000-8000-000000000001', 1, 'adjust', 'one added credit');
select is(public.generate_sessions('2026-04-17', 28), 1, 'one added credit generates exactly one additional occurrence');
select is((select count(*)::integer from public.sessions where assignment_id = 'b8400000-0000-4000-8000-000000000001'), 4, 'all four weekly occurrences exist after adding credit');
select ok((select count(*) >= 3 and bool_and(result = 'succeeded') from public.job_runs where job_name = 'generate_sessions'), 'each successful generator invocation is recorded');
select throws_ok($$select public.generate_sessions('2026-04-17', 0)$$, '22023', 'invalid_generation_window', 'invalid generation horizon is rejected');
select throws_ok($$update public.session_credit_ledger set delta = 99 where subscription_id = 'b8600000-0000-4000-8000-000000000001'$$, 'P0001', 'credit_ledger_immutable', 'credit ledger rows are immutable');

select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
select is((select count(*)::integer from public.subscriptions), 4, 'AAL2 administrator reads all subscriptions');

reset role;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select is((select count(*)::integer from public.subscriptions), 1, 'student reads only their subscription');
select is((select sessions_remaining from public.subscription_balance), 4, 'student balance view exposes only their balance');
select throws_ok($$insert into public.session_credit_ledger (subscription_id, delta, reason) values ('b8600000-0000-4000-8000-000000000001', 50, 'adjust')$$, '42501', null, 'student cannot grant credits');

reset role;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select is((select count(*)::integer from public.subscriptions), 0, 'teacher cannot read student subscriptions');

reset role;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select is((select count(*)::integer from public.subscriptions), 1, 'parent reads only their child subscription');

reset role;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select throws_ok($$select id from public.subscriptions$$, '42501', null, 'anonymous cannot read subscriptions');

select * from finish();
rollback;
