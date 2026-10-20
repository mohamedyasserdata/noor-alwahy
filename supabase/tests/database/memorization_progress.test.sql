begin;

select plan(39);

select has_table('public', 'memorization_progress', 'memorization progress table exists');
select has_column('public', 'memorization_progress', 'review_stage', 'review stage is available');
select has_column('public', 'memorization_progress', 'next_review_due', 'next review date is available');
select is((select relrowsecurity from pg_class where oid = 'public.memorization_progress'::regclass), true, 'progress has RLS');
select is(has_table_privilege('authenticated', 'public.memorization_progress', 'insert'), false, 'authenticated clients cannot insert progress directly');
select is(has_table_privilege('authenticated', 'public.memorization_progress', 'update'), false, 'authenticated clients cannot update progress directly');
select is(has_table_privilege('service_role', 'public.memorization_progress', 'insert'), false, 'service role cannot bypass progress writes');
select ok(exists(select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'memorization_progress'), 'progress changes publish through Realtime');
select has_view('public', 'v_surah_progress', 'surah progress view exists');
select has_view('public', 'v_juz_progress', 'juz progress view exists');
select is((select reloptions @> array['security_invoker=true'] from pg_class where oid = 'public.v_surah_progress'::regclass), true, 'surah view invokes caller RLS');
select is((select reloptions @> array['security_invoker=true'] from pg_class where oid = 'public.v_juz_progress'::regclass), true, 'juz view invokes caller RLS');

insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values ('eb000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'progress.otherteacher@test.local', '{"role":"teacher"}', '{"full_name":"Other Teacher"}', now(), now());

insert into public.tracks (id, code, name_ar, name_en)
values ('eb100000-0000-4000-8000-000000000001', 'progress-test', 'اختبار التقدم', 'Progress test');
insert into public.teachers (id, profile_id, gender, status, identity_verified_at, code_of_conduct_accepted_at)
values
  ('eb200000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', 'male', 'active', now(), now()),
  ('eb200000-0000-4000-8000-000000000002', 'eb000000-0000-4000-8000-000000000001', 'male', 'active', now(), now());
insert into public.teacher_tracks (teacher_id, track_id)
values
  ('eb200000-0000-4000-8000-000000000001', 'eb100000-0000-4000-8000-000000000001'),
  ('eb200000-0000-4000-8000-000000000002', 'eb100000-0000-4000-8000-000000000001');
insert into public.students (id, profile_id, full_name, gender, timezone)
values ('eb300000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000003', 'Progress Student', 'male', 'Africa/Cairo');
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
from generate_series(1, 6) as series;

insert into public.session_evaluations (
  id, session_id, session_type, from_ayah_id, to_ayah_id, scores, decision, is_locked, created_by
)
values
  ('eba00000-0000-4000-8000-000000000001', 'eb800000-0000-4000-8000-000000000001', 'new_memo', (select first_ayah_id from public.quran_pages where page = 1), (select last_ayah_id from public.quran_pages where page = 1), '{"commitment":3}', 'passed', true, '10000000-0000-4000-8000-000000000002'),
  ('eba00000-0000-4000-8000-000000000002', 'eb800000-0000-4000-8000-000000000002', 'new_memo', (select first_ayah_id from public.quran_pages where page = 2), (select first_ayah_id from public.quran_pages where page = 2), '{"commitment":5}', 'passed', true, '10000000-0000-4000-8000-000000000002'),
  ('eba00000-0000-4000-8000-000000000003', 'eb800000-0000-4000-8000-000000000003', 'new_memo', (select first_ayah_id from public.quran_pages where page = 3), (select last_ayah_id from public.quran_pages where page = 3), '{"commitment":5}', 'repeat', true, '10000000-0000-4000-8000-000000000002');

select is((select status from public.memorization_progress where student_id = 'eb300000-0000-4000-8000-000000000001' and page = 1), 'mastered'::public.progress_status, 'a complete passed new page is mastered');
select ok((select first_memorized_at is not null from public.memorization_progress where student_id = 'eb300000-0000-4000-8000-000000000001' and page = 1), 'first mastery time is recorded');
select is((select status from public.memorization_progress where student_id = 'eb300000-0000-4000-8000-000000000001' and page = 2), 'in_progress'::public.progress_status, 'a partial page stays in progress');
select is((select status from public.memorization_progress where student_id = 'eb300000-0000-4000-8000-000000000001' and page = 3), 'in_progress'::public.progress_status, 'a repeated page stays in progress');

insert into public.session_evaluations (id, session_id, session_type, from_ayah_id, to_ayah_id, scores, decision, is_locked, created_by)
values ('eba00000-0000-4000-8000-000000000004', 'eb800000-0000-4000-8000-000000000004', 'near_review', (select first_ayah_id from public.quran_pages where page = 1), (select last_ayah_id from public.quran_pages where page = 1), '{"commitment":2}', 'repeat', true, '10000000-0000-4000-8000-000000000002');
select is((select status from public.memorization_progress where student_id = 'eb300000-0000-4000-8000-000000000001' and page = 1), 'needs_review'::public.progress_status, 'a low review marks the page as needing review');
select ok((select last_reviewed_at is not null from public.memorization_progress where student_id = 'eb300000-0000-4000-8000-000000000001' and page = 1), 'review time is recorded');
select is((select avg_score from public.memorization_progress where student_id = 'eb300000-0000-4000-8000-000000000001' and page = 1), 40::numeric, 'the first review initializes its moving average');
select is((select review_count from public.memorization_progress where student_id = 'eb300000-0000-4000-8000-000000000001' and page = 1), 1, 'the first review increments the count');

insert into public.session_evaluations (id, session_id, session_type, from_ayah_id, to_ayah_id, scores, decision, is_locked, created_by)
values ('eba00000-0000-4000-8000-000000000005', 'eb800000-0000-4000-8000-000000000005', 'near_review', (select first_ayah_id from public.quran_pages where page = 1), (select last_ayah_id from public.quran_pages where page = 1), '{"commitment":4}', 'passed', true, '10000000-0000-4000-8000-000000000002');
select is((select status from public.memorization_progress where student_id = 'eb300000-0000-4000-8000-000000000001' and page = 1), 'mastered'::public.progress_status, 'a successful full review restores mastery');
select is((select avg_score from public.memorization_progress where student_id = 'eb300000-0000-4000-8000-000000000001' and page = 1), 60::numeric, 'review average is updated without floating drift');
select is((select review_count from public.memorization_progress where student_id = 'eb300000-0000-4000-8000-000000000001' and page = 1), 2, 'two reviews are counted');

update public.session_evaluations set is_locked = false where id = 'eba00000-0000-4000-8000-000000000005';
update public.session_evaluations set is_locked = true where id = 'eba00000-0000-4000-8000-000000000005';
select is((select review_count from public.memorization_progress where student_id = 'eb300000-0000-4000-8000-000000000001' and page = 1), 2, 'relocking the same evaluation is idempotent');
select is((select count(*)::integer from private.evaluation_progress_applications), 5, 'each applicable evaluation is applied once');
select ok(exists(select 1 from public.v_surah_progress where student_id = 'eb300000-0000-4000-8000-000000000001' and surah_id = 1 and pages_started >= 1), 'surah view derives page progress');
select ok(exists(select 1 from public.v_juz_progress where student_id = 'eb300000-0000-4000-8000-000000000001' and juz = 1 and pages_started = 3), 'juz view derives page progress');

insert into public.session_evaluations (id, session_id, session_type, scores, decision, is_locked, created_by)
values ('eba00000-0000-4000-8000-000000000006', 'eb800000-0000-4000-8000-000000000006', 'noorani', '{"commitment":5}', 'passed', true, '10000000-0000-4000-8000-000000000002');
select is((select count(*)::integer from public.memorization_progress where student_id = 'eb300000-0000-4000-8000-000000000001'), 3, 'a non-Quran-progress session does not change pages');
select is((select count(*)::integer from private.evaluation_progress_applications), 5, 'non-progress session types do not consume an application marker');

set local role anon;
select throws_ok($$select count(*) from public.memorization_progress$$, '42501', null, 'anonymous callers cannot read progress');
reset role;

select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select is((select count(*)::integer from public.memorization_progress), 3, 'the assigned teacher reads student progress');
select throws_ok($$insert into public.memorization_progress (student_id,page) values ('eb300000-0000-4000-8000-000000000001', 4)$$, '42501', null, 'the teacher cannot write progress directly');
select throws_ok($$update public.memorization_progress set status = 'mastered' where page = 2$$, '42501', null, 'the teacher cannot update progress directly');
reset role;

select set_config('request.jwt.claims', '{"sub":"eb000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select is((select count(*)::integer from public.memorization_progress), 0, 'an unrelated teacher reads no progress');
reset role;

select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select is((select count(*)::integer from public.memorization_progress), 3, 'the student reads their own progress');
reset role;

select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select is((select count(*)::integer from public.memorization_progress), 3, 'the guardian reads their child progress');
reset role;

select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select is((select count(*)::integer from public.memorization_progress), 0, 'an AAL1 administrator reads no progress');
reset role;

select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
select is((select count(*)::integer from public.memorization_progress), 3, 'an AAL2 administrator reads progress');
reset role;

select * from finish();

rollback;
