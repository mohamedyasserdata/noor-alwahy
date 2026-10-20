begin;

select plan(44);

select has_table('public', 'memorization_progress', 'memorization progress table exists');
select has_view('public', 'v_surah_progress', 'surah progress view exists');
select has_view('public', 'v_juz_progress', 'juz progress view exists');
select has_function('public', 'apply_evaluation_to_progress', array[]::text[], 'locked evaluations have a progress trigger function');
select is((select relrowsecurity from pg_class where oid = 'public.memorization_progress'::regclass), true, 'memorization progress has RLS');
select is(has_table_privilege('anon', 'public.memorization_progress', 'select'), false, 'anonymous callers cannot read progress');
select is(has_table_privilege('authenticated', 'public.memorization_progress', 'select'), true, 'authenticated callers reach progress RLS');
select is(has_table_privilege('authenticated', 'public.memorization_progress', 'insert'), false, 'authenticated callers cannot insert progress directly');
select is(has_table_privilege('authenticated', 'public.memorization_progress', 'update'), false, 'authenticated callers cannot update progress directly');
select is(has_table_privilege('authenticated', 'public.memorization_progress', 'delete'), false, 'authenticated callers cannot delete progress directly');
select is(has_table_privilege('service_role', 'public.memorization_progress', 'insert'), false, 'service role cannot bypass progress writes');
select ok(exists(select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'memorization_progress'), 'progress changes are published through Realtime');

insert into public.tracks (id, code, name_ar, name_en)
values ('eb100000-0000-4000-8000-000000000001', 'progress-test', 'اختبار التقدم', 'Progress test');

insert into public.teachers (id, profile_id, gender, status, identity_verified_at, code_of_conduct_accepted_at)
values ('eb200000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', 'male', 'active', now(), now());

insert into public.teacher_tracks (teacher_id, track_id)
values ('eb200000-0000-4000-8000-000000000001', 'eb100000-0000-4000-8000-000000000001');

insert into public.students (id, profile_id, full_name, gender, timezone)
values
  ('eb300000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000003', 'Progress Student', 'male', 'Africa/Cairo'),
  ('eb300000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000005', 'Other Progress Student', 'male', 'Africa/Cairo');

insert into public.guardians (id, profile_id)
values ('eb400000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000004');
insert into public.student_guardians (student_id, guardian_id, relation, is_primary)
values ('eb300000-0000-4000-8000-000000000001', 'eb400000-0000-4000-8000-000000000001', 'parent', true);

insert into public.teacher_assignments (id, student_id, teacher_id, track_id, assigned_by, reason)
values ('eb500000-0000-4000-8000-000000000001', 'eb300000-0000-4000-8000-000000000001', 'eb200000-0000-4000-8000-000000000001', 'eb100000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Progress test');

insert into public.sessions (id, assignment_id, student_id, teacher_id, scheduled_at, duration_min, status)
select
  ('eb800000-0000-4000-8000-' || lpad(series::text, 12, '0'))::uuid,
  'eb500000-0000-4000-8000-000000000001',
  'eb300000-0000-4000-8000-000000000001',
  'eb200000-0000-4000-8000-000000000001',
  '2032-01-01 08:00+00'::timestamptz + series * interval '1 day',
  30,
  'held'
from generate_series(1, 7) as series;

insert into public.session_evaluations (id, session_id, session_type, from_ayah_id, to_ayah_id, scores, decision, is_locked, created_by)
values ('eb900000-0000-4000-8000-000000000001', 'eb800000-0000-4000-8000-000000000001', 'new_memo', 1, 12, '{"memorization":5}', 'passed', true, '10000000-0000-4000-8000-000000000002');
select is((select count(*)::integer from public.memorization_progress where student_id = 'eb300000-0000-4000-8000-000000000001'), 2, 'a locked full-page memorization creates two progress rows');
select is((select count(*)::integer from public.memorization_progress where student_id = 'eb300000-0000-4000-8000-000000000001' and status = 'mastered'), 2, 'passed full pages with rating at least three are mastered');
select is((select count(*)::integer from public.memorization_progress where student_id = 'eb300000-0000-4000-8000-000000000001' and first_memorized_at is not null), 2, 'mastered pages record their first memorization time');
select is((select count(*)::integer from public.memorization_progress where student_id = 'eb300000-0000-4000-8000-000000000001' and review_count = 0), 2, 'new memorization does not count as review');
select is((select count(*)::integer from public.memorization_progress where student_id = 'eb300000-0000-4000-8000-000000000001' and avg_score is null), 2, 'new memorization does not change the review average');

insert into public.session_evaluations (id, session_id, session_type, from_ayah_id, to_ayah_id, scores, decision, is_locked, created_by)
values ('eb900000-0000-4000-8000-000000000002', 'eb800000-0000-4000-8000-000000000002', 'near_review', 1, 12, '{"memorization":2}', 'repeat', true, '10000000-0000-4000-8000-000000000002');
select is((select count(*)::integer from public.memorization_progress where student_id = 'eb300000-0000-4000-8000-000000000001' and status = 'needs_review'), 2, 'a low review marks covered pages as needing review');
select is((select count(*)::integer from public.memorization_progress where student_id = 'eb300000-0000-4000-8000-000000000001' and review_count = 1), 2, 'the first review increments the review count');
select is((select count(*)::integer from public.memorization_progress where student_id = 'eb300000-0000-4000-8000-000000000001' and avg_score = 40), 2, 'the first review stores its total score as the average');
select is((select count(*)::integer from public.memorization_progress where student_id = 'eb300000-0000-4000-8000-000000000001' and last_reviewed_at is not null), 2, 'reviewed pages record the review time');

insert into public.session_evaluations (id, session_id, session_type, from_ayah_id, to_ayah_id, scores, decision, is_locked, created_by)
values ('eb900000-0000-4000-8000-000000000003', 'eb800000-0000-4000-8000-000000000003', 'near_review', 1, 12, '{"memorization":4}', 'passed', true, '10000000-0000-4000-8000-000000000002');
select is((select count(*)::integer from public.memorization_progress where student_id = 'eb300000-0000-4000-8000-000000000001' and status = 'mastered'), 2, 'a successful review restores mastered status');
select is((select count(*)::integer from public.memorization_progress where student_id = 'eb300000-0000-4000-8000-000000000001' and review_count = 2), 2, 'a second review increments the count once');
select is((select count(*)::integer from public.memorization_progress where student_id = 'eb300000-0000-4000-8000-000000000001' and avg_score = 60), 2, 'the moving review average is correct');

insert into public.session_evaluations (id, session_id, session_type, from_ayah_id, to_ayah_id, scores, decision, is_locked, created_by)
values ('eb900000-0000-4000-8000-000000000004', 'eb800000-0000-4000-8000-000000000004', 'new_memo', 14, 23, '{"memorization":5}', 'passed', true, '10000000-0000-4000-8000-000000000002');
select ok(exists(select 1 from public.memorization_progress where student_id = 'eb300000-0000-4000-8000-000000000001' and page = 3), 'a partially covered page creates progress');
select is((select status from public.memorization_progress where student_id = 'eb300000-0000-4000-8000-000000000001' and page = 3), 'in_progress'::public.progress_status, 'partial coverage remains in progress');
select is((select first_memorized_at from public.memorization_progress where student_id = 'eb300000-0000-4000-8000-000000000001' and page = 3), null::timestamptz, 'a partial page is not marked memorized');

insert into public.session_evaluations (id, session_id, session_type, from_ayah_id, to_ayah_id, scores, decision, is_locked, created_by)
values
  ('eb900000-0000-4000-8000-000000000005', 'eb800000-0000-4000-8000-000000000005', 'new_memo', 24, 31, '{"memorization":5}', 'repeat', true, '10000000-0000-4000-8000-000000000002'),
  ('eb900000-0000-4000-8000-000000000006', 'eb800000-0000-4000-8000-000000000006', 'new_memo', 32, 36, '{"memorization":2}', 'passed', true, '10000000-0000-4000-8000-000000000002'),
  ('eb900000-0000-4000-8000-000000000007', 'eb800000-0000-4000-8000-000000000007', 'matn_theory', null, null, '{"theory_understanding":5}', 'passed', true, '10000000-0000-4000-8000-000000000002');
select is((select status from public.memorization_progress where student_id = 'eb300000-0000-4000-8000-000000000001' and page = 4), 'in_progress'::public.progress_status, 'repeat decision keeps a full new page in progress');
select is((select status from public.memorization_progress where student_id = 'eb300000-0000-4000-8000-000000000001' and page = 5), 'in_progress'::public.progress_status, 'a low rating keeps a passed new page in progress');
select is((select count(*)::integer from public.memorization_progress where student_id = 'eb300000-0000-4000-8000-000000000001'), 5, 'an evaluation without an ayah range changes no progress');
select ok(exists(select 1 from public.v_surah_progress where student_id = 'eb300000-0000-4000-8000-000000000001' and tracked_pages > 0), 'surah progress aggregates tracked pages');
select ok(exists(select 1 from public.v_juz_progress where student_id = 'eb300000-0000-4000-8000-000000000001' and tracked_pages = 5), 'juz progress aggregates tracked pages');

select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select is((select count(*)::integer from public.memorization_progress), 5, 'the assigned teacher reads student progress');
select throws_ok($$insert into public.memorization_progress (student_id, page) values ('eb300000-0000-4000-8000-000000000001', 6)$$, '42501', 'permission denied for table memorization_progress', 'a teacher cannot insert progress directly');
select throws_ok($$update public.memorization_progress set status = 'mastered' where student_id = 'eb300000-0000-4000-8000-000000000001'$$, '42501', 'permission denied for table memorization_progress', 'a teacher cannot update progress directly');
reset role;

select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select is((select count(*)::integer from public.memorization_progress), 5, 'the student reads their own progress');
reset role;

select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select is((select count(*)::integer from public.memorization_progress), 5, 'the guardian reads linked student progress');
reset role;

select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000005","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select is((select count(*)::integer from public.memorization_progress), 0, 'an unrelated student reads no progress');
reset role;

select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select is((select count(*)::integer from public.memorization_progress), 0, 'an AAL1 administrator reads no progress');
reset role;

select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
select is((select count(*)::integer from public.memorization_progress), 5, 'an AAL2 administrator reads progress');
update public.session_evaluations set is_locked = false where id = 'eb900000-0000-4000-8000-000000000003';
update public.session_evaluations set is_locked = true where id = 'eb900000-0000-4000-8000-000000000003';
reset role;
select is((select count(*)::integer from public.memorization_progress where student_id = 'eb300000-0000-4000-8000-000000000001' and review_count = 2), 2, 'relocking the same evaluation does not apply it twice');
select ok((select count(*) > 0 from public.audit_logs where table_name = 'memorization_progress'), 'progress changes are audited');
select ok((select reloptions @> array['security_invoker=true'] from pg_class where oid = 'public.v_surah_progress'::regclass), 'surah progress view uses caller RLS');
select ok((select reloptions @> array['security_invoker=true'] from pg_class where oid = 'public.v_juz_progress'::regclass), 'juz progress view uses caller RLS');

select * from finish();

rollback;
