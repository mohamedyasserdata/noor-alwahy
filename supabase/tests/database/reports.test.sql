begin;

select plan(38);

select has_table('public', 'reports', 'reports table exists');
select has_column('public', 'reports', 'body', 'report body is stored');
select has_column('public', 'reports', 'status', 'report status is stored');
select has_column('public', 'reports', 'approved_at', 'teacher approval timestamp is stored');
select has_column('public', 'reports', 'made_visible_at', 'visibility timestamp is stored');
select is((select relrowsecurity from pg_class where oid = 'public.reports'::regclass), true, 'report RLS is enabled');
select is(has_table_privilege('anon', 'public.reports', 'select'), false, 'anonymous callers cannot read reports');
select is(has_table_privilege('service_role', 'public.reports', 'insert'), false, 'service role cannot bypass report writes');

insert into public.tracks (id, code, name_ar, name_en)
values ('f0100000-0000-4000-8000-000000000001', 'reports-test', 'اختبار التقارير', 'Reports test');

insert into public.teachers (id, profile_id, gender, status, identity_verified_at, code_of_conduct_accepted_at)
values ('f0200000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', 'male', 'active', now(), now());

insert into public.teacher_tracks (teacher_id, track_id)
values ('f0200000-0000-4000-8000-000000000001', 'f0100000-0000-4000-8000-000000000001');

insert into public.students (id, profile_id, full_name, gender, timezone)
values
  ('f0300000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000003', 'Report Student', 'male', 'Africa/Cairo'),
  ('f0300000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000005', 'Other Report Student', 'male', 'Africa/Cairo');

insert into public.guardians (id, profile_id)
values ('f0400000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000004');
insert into public.student_guardians (student_id, guardian_id, relation, is_primary)
values ('f0300000-0000-4000-8000-000000000001', 'f0400000-0000-4000-8000-000000000001', 'parent', true);

insert into public.teacher_assignments (id, student_id, teacher_id, track_id, assigned_by, reason)
values ('f0500000-0000-4000-8000-000000000001', 'f0300000-0000-4000-8000-000000000001', 'f0200000-0000-4000-8000-000000000001', 'f0100000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Reports test');

insert into public.sessions (id, assignment_id, student_id, teacher_id, scheduled_at, duration_min, ends_at, status)
values
  ('f0600000-0000-4000-8000-000000000001', 'f0500000-0000-4000-8000-000000000001', 'f0300000-0000-4000-8000-000000000001', 'f0200000-0000-4000-8000-000000000001', '2026-10-05 10:00:00+00', 30, '2026-10-05 10:30:00+00', 'held'),
  ('f0600000-0000-4000-8000-000000000002', 'f0500000-0000-4000-8000-000000000001', 'f0300000-0000-4000-8000-000000000001', 'f0200000-0000-4000-8000-000000000001', '2026-10-07 10:00:00+00', 30, '2026-10-07 10:30:00+00', 'held');
insert into public.attendance (session_id, status, minutes, recorded_by)
values
  ('f0600000-0000-4000-8000-000000000001', 'present', 30, '10000000-0000-4000-8000-000000000002'),
  ('f0600000-0000-4000-8000-000000000002', 'student_absent', 0, '10000000-0000-4000-8000-000000000002');
insert into public.session_evaluations (session_id, session_type, scores, is_locked, created_by)
values
  ('f0600000-0000-4000-8000-000000000001', 'new_memo', '{"memorization":4,"tajweed_applied":4,"fluency":4,"commitment":4}', true, '10000000-0000-4000-8000-000000000002'),
  ('f0600000-0000-4000-8000-000000000002', 'new_memo', '{"memorization":2,"tajweed_applied":2,"fluency":2,"commitment":2}', true, '10000000-0000-4000-8000-000000000002');
insert into public.memorization_progress (student_id, page, status, first_memorized_at)
values
  ('f0300000-0000-4000-8000-000000000001', 10, 'mastered', '2026-10-06 09:00:00+00'),
  ('f0300000-0000-4000-8000-000000000001', 11, 'mastered', '2026-10-08 09:00:00+00');

select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select lives_ok(
  $$insert into public.reports (student_id, teacher_id, period_type, period_start, period_end, body)
    values ('f0300000-0000-4000-8000-000000000001', 'f0200000-0000-4000-8000-000000000001', 'weekly', '2026-10-05', '2026-10-11',
      '{"metrics":{"mastered_pages":999},"summary":"تقدم ثابت","strengths":"التزام جيد","improve":"المراجعة","plan":"صفحتان","recommendation":"الاستمرار"}')$$,
  'assigned teacher creates a draft report'
);
select is((select body #>> '{metrics,mastered_pages}' from public.reports), '2', 'mastered pages are computed by the database');
select is((select body #>> '{metrics,attendance,total}' from public.reports), '2', 'attendance total is computed by the database');
select is((select body #>> '{metrics,attendance,present}' from public.reports), '1', 'present attendance is computed by the database');
select is((select body #>> '{metrics,attendance,rate}' from public.reports), '50.00', 'attendance rate is computed exactly');
select is((select body #>> '{metrics,evaluation_average}' from public.reports), '60.00', 'evaluation average is computed exactly');
select is((select body #>> '{metrics,criteria_average,tajweed_applied}' from public.reports), '3.00', 'criterion averages are computed from locked evaluations');
select is((select status from public.reports), 'draft'::public.report_status, 'reports begin as drafts');
select throws_ok(
  $$insert into public.reports (student_id, teacher_id, period_type, period_start, period_end, body)
    values ('f0300000-0000-4000-8000-000000000002', 'f0200000-0000-4000-8000-000000000001', 'weekly', '2026-10-05', '2026-10-11',
      '{"summary":"x","strengths":"x","improve":"x","plan":"x","recommendation":"x"}')$$,
  '42501', null, 'teacher cannot report on an unassigned student'
);
select lives_ok($$update public.reports set status = 'approved'$$, 'teacher approves their draft');
select ok((select approved_at is not null from public.reports), 'approval records its timestamp');
select throws_ok($$update public.reports set body = jsonb_set(body, '{summary}', '"changed"')$$, 'P0001', 'report_content_locked', 'approved report content is immutable');
select throws_ok($$update public.reports set status = 'visible'$$, 'P0001', 'report_transition_forbidden', 'teacher cannot publish a report');
reset role;

select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select is((select count(*)::integer from public.reports), 0, 'student cannot read an approved report');
reset role;

select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select is((select count(*)::integer from public.reports), 0, 'guardian cannot read an approved report');
select is((select count(*)::integer from public.notifications where type = 'report_approved'), 1, 'guardian receives one approval notification');
select ok((select payload ? 'report_id' and payload ? 'student_id' from public.notifications where type = 'report_approved'), 'approval notification contains safe report references');
select is((select count(*)::integer from public.notifications where type = 'report_approved' and user_id <> '10000000-0000-4000-8000-000000000004'), 0, 'guardian cannot read another users notification');
reset role;

select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
select lives_ok($$update public.reports set status = 'admin_review'$$, 'administrator sends an approved report to review');
select lives_ok($$update public.reports set status = 'visible'$$, 'administrator publishes a reviewed report');
select ok((select made_visible_at is not null from public.reports), 'publishing records its timestamp');
reset role;

select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select is((select count(*)::integer from public.reports), 1, 'student reads their visible report');
select is_empty($$update public.reports set status = 'draft' returning id$$, 'student cannot update a visible report');
reset role;

select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select is((select count(*)::integer from public.reports), 1, 'guardian reads their childs visible report');
reset role;

select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000005","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select is((select count(*)::integer from public.reports), 0, 'unrelated student cannot read the report');
reset role;

select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
select lives_ok($$update public.reports set status = 'draft'$$, 'administrator can withdraw a visible report');
select is((select made_visible_at from public.reports), null, 'withdrawal clears visibility timestamp');
select throws_ok($$update public.reports set status = 'visible'$$, 'P0001', 'report_transition_forbidden', 'draft cannot skip approval');
reset role;

select ok((select count(*) >= 5 from public.audit_logs where table_name = 'reports'), 'report changes are audited');
select is((select count(*)::integer from public.reports), 1, 'unique period prevents accidental duplicate reports');

select * from finish();
rollback;
