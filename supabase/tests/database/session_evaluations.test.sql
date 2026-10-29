begin;

select plan(42);

select has_table('public', 'session_evaluations', 'session evaluations table exists');
select has_column('public', 'session_evaluations', 'settings_snapshot', 'settings snapshot is persisted');
select has_column('public', 'session_evaluations', 'total_score', 'database-computed total is persisted');
select has_column('public', 'session_evaluations', 'rating', 'database-computed rating is persisted');
select has_column('public', 'session_evaluations', 'is_locked', 'evaluation lock is persisted');
select is((select relrowsecurity from pg_class where oid = 'public.session_evaluations'::regclass), true, 'evaluation RLS is enabled');
select is(has_table_privilege('anon', 'public.session_evaluations', 'select'), false, 'anonymous callers have no evaluation access');
select is(has_table_privilege('authenticated', 'public.session_evaluations', 'insert'), true, 'authenticated teachers reach guarded insert RLS');
select is(has_table_privilege('service_role', 'public.session_evaluations', 'insert'), false, 'service role cannot bypass evaluation writes');

insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('e9000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'evaluation.otherteacher@test.local', '{"role":"teacher"}', '{"full_name":"Other Teacher"}', now(), now()),
  ('e9000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'evaluation.otherstudent@test.local', '{"role":"student"}', '{"full_name":"Other Student"}', now(), now());

insert into public.tracks (id, code, name_ar, name_en)
values ('e9100000-0000-4000-8000-000000000001', 'evaluation-test', 'اختبار التقييم', 'Evaluation test');

insert into public.teachers (id, profile_id, gender, status, identity_verified_at, code_of_conduct_accepted_at)
values
  ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002', 'male', 'active', now(), now()),
  ('e9200000-0000-4000-8000-000000000002', 'e9000000-0000-4000-8000-000000000001', 'male', 'active', now(), now());

insert into public.students (id, profile_id, full_name, gender, timezone)
values
  ('20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000003', 'Evaluation Student', 'male', 'Africa/Cairo'),
  ('e9300000-0000-4000-8000-000000000002', 'e9000000-0000-4000-8000-000000000002', 'Other Student', 'male', 'Africa/Cairo');

insert into public.guardians (id, profile_id)
values ('20000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000004');

insert into public.teacher_tracks (teacher_id, track_id)
values
  ('20000000-0000-4000-8000-000000000002', 'e9100000-0000-4000-8000-000000000001'),
  ('e9200000-0000-4000-8000-000000000002', 'e9100000-0000-4000-8000-000000000001');

insert into public.student_guardians (student_id, guardian_id, relation, is_primary)
values ('20000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000004', 'parent', true);

insert into public.teacher_assignments (id, student_id, teacher_id, track_id, assigned_by, reason)
values
  ('e9500000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000002', 'e9100000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Evaluation test'),
  ('e9500000-0000-4000-8000-000000000002', 'e9300000-0000-4000-8000-000000000002', 'e9200000-0000-4000-8000-000000000002', 'e9100000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Other evaluation test');

insert into public.sessions (id, assignment_id, student_id, teacher_id, scheduled_at, duration_min, status)
select
  ('e9800000-0000-4000-8000-' || lpad(series::text, 12, '0'))::uuid,
  'e9500000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000003',
  '20000000-0000-4000-8000-000000000002',
  '2031-01-01 08:00+00'::timestamptz + series * interval '1 day',
  30,
  'held'
from generate_series(1, 12) as series;

insert into public.sessions (id, assignment_id, student_id, teacher_id, scheduled_at, duration_min, status)
values ('e9900000-0000-4000-8000-000000000001', 'e9500000-0000-4000-8000-000000000002', 'e9300000-0000-4000-8000-000000000002', 'e9200000-0000-4000-8000-000000000002', '2031-02-01 08:00+00', 30, 'held');

insert into public.session_evaluations (id, session_id, session_type, scores, created_by)
values
  ('ea000000-0000-4000-8000-000000000001', 'e9800000-0000-4000-8000-000000000001', 'recitation', '{"tajweed_applied":5,"makharij":5,"waqf_ibtida":5,"fluency":5,"commitment":5}', '10000000-0000-4000-8000-000000000002'),
  ('ea000000-0000-4000-8000-000000000002', 'e9800000-0000-4000-8000-000000000002', 'recitation', '{"tajweed_applied":4,"makharij":4,"waqf_ibtida":4,"fluency":4,"commitment":4}', '10000000-0000-4000-8000-000000000002'),
  ('ea000000-0000-4000-8000-000000000003', 'e9800000-0000-4000-8000-000000000003', 'recitation', '{"tajweed_applied":3,"makharij":3,"waqf_ibtida":3,"fluency":3,"commitment":3}', '10000000-0000-4000-8000-000000000002'),
  ('ea000000-0000-4000-8000-000000000004', 'e9800000-0000-4000-8000-000000000004', 'recitation', '{"tajweed_applied":2,"makharij":2,"waqf_ibtida":2,"fluency":2,"commitment":2}', '10000000-0000-4000-8000-000000000002'),
  ('ea000000-0000-4000-8000-000000000005', 'e9800000-0000-4000-8000-000000000005', 'recitation', '{"tajweed_applied":1,"makharij":1,"waqf_ibtida":1,"fluency":1,"commitment":1}', '10000000-0000-4000-8000-000000000002'),
  ('ea000000-0000-4000-8000-000000000006', 'e9800000-0000-4000-8000-000000000006', 'recitation', '{"tajweed_applied":5,"makharij":5,"waqf_ibtida":5,"fluency":5,"commitment":5}', '10000000-0000-4000-8000-000000000002'),
  ('ea000000-0000-4000-8000-000000000007', 'e9800000-0000-4000-8000-000000000007', 'recitation', '{"tajweed_applied":4,"makharij":4,"waqf_ibtida":4,"fluency":4,"commitment":4}', '10000000-0000-4000-8000-000000000002'),
  ('ea000000-0000-4000-8000-000000000008', 'e9800000-0000-4000-8000-000000000008', 'noorani', '{"commitment":5}', '10000000-0000-4000-8000-000000000002');

update public.session_evaluations set errors_major = 20 where id = 'ea000000-0000-4000-8000-000000000006';
update public.session_evaluations set errors_major = 3, errors_minor = 4, prompts_count = 2, forgot_count = 1 where id = 'ea000000-0000-4000-8000-000000000007';

select is((select total_score from public.session_evaluations where id = 'ea000000-0000-4000-8000-000000000001'), 100::numeric, 'all fives score 100');
select is((select rating from public.session_evaluations where id = 'ea000000-0000-4000-8000-000000000001'), 5::smallint, '100 maps to rating 5');
select is((select total_score from public.session_evaluations where id = 'ea000000-0000-4000-8000-000000000002'), 80::numeric, 'all fours score 80');
select is((select rating from public.session_evaluations where id = 'ea000000-0000-4000-8000-000000000002'), 4::smallint, '80 maps to rating 4');
select is((select total_score from public.session_evaluations where id = 'ea000000-0000-4000-8000-000000000003'), 60::numeric, 'all threes score 60');
select is((select rating from public.session_evaluations where id = 'ea000000-0000-4000-8000-000000000003'), 3::smallint, '60 maps to rating 3');
select is((select total_score from public.session_evaluations where id = 'ea000000-0000-4000-8000-000000000004'), 40::numeric, 'all twos score 40');
select is((select rating from public.session_evaluations where id = 'ea000000-0000-4000-8000-000000000004'), 2::smallint, '40 maps to rating 2');
select is((select total_score from public.session_evaluations where id = 'ea000000-0000-4000-8000-000000000005'), 20::numeric, 'all ones score 20');
select is((select rating from public.session_evaluations where id = 'ea000000-0000-4000-8000-000000000005'), 1::smallint, '20 maps to rating 1');
select is((select total_score from public.session_evaluations where id = 'ea000000-0000-4000-8000-000000000006'), 60::numeric, 'deductions reduce a perfect base score');
select is((select total_score from public.session_evaluations where id = 'ea000000-0000-4000-8000-000000000007'), 70::numeric, 'mixed deductions match the BR-09 reference row');
select is((select rating from public.session_evaluations where id = 'ea000000-0000-4000-8000-000000000007'), 4::smallint, '70 maps to rating 4 at the exact threshold');
select is((select total_score from public.session_evaluations where id = 'ea000000-0000-4000-8000-000000000008'), 100::numeric, 'a valid applicable subset is weighted on supplied criteria only');
select ok((select settings_snapshot ? 'weights' and settings_snapshot ? 'deductions' and settings_snapshot ? 'rating_thresholds' from public.session_evaluations where id = 'ea000000-0000-4000-8000-000000000001'), 'calculation inputs are snapshotted');

select throws_ok($$insert into public.session_evaluations (session_id, session_type, scores, created_by) values ('e9800000-0000-4000-8000-000000000009', 'noorani', '{"theory_understanding":5}', '10000000-0000-4000-8000-000000000002')$$, '23514', 'evaluation_criterion_not_applicable', 'inapplicable criteria are rejected');
select throws_ok($$insert into public.session_evaluations (session_id, session_type, scores, created_by) values ('e9800000-0000-4000-8000-000000000009', 'noorani', '{"commitment":6}', '10000000-0000-4000-8000-000000000002')$$, '23514', 'evaluation_score_out_of_range', 'scores above five are rejected');
select throws_ok($$insert into public.session_evaluations (session_id, session_type, scores, created_by) values ('e9800000-0000-4000-8000-000000000009', 'noorani', '{}', '10000000-0000-4000-8000-000000000002')$$, '23514', 'evaluation_scores_required', 'an empty score object is rejected');
select throws_ok($$insert into public.session_evaluations (session_id, session_type, from_ayah_id, scores, created_by) values ('e9800000-0000-4000-8000-000000000009', 'noorani', 1, '{"commitment":5}', '10000000-0000-4000-8000-000000000002')$$, '23514', 'evaluation_ayah_range_incomplete', 'half an ayah range is rejected');

insert into public.session_evaluations (id, session_id, session_type, scores, total_score, rating, is_locked, created_by)
values ('ea000000-0000-4000-8000-000000000009', 'e9800000-0000-4000-8000-000000000009', 'noorani', '{"commitment":5}', 1, 1, true, '10000000-0000-4000-8000-000000000002');
select is((select total_score from public.session_evaluations where id = 'ea000000-0000-4000-8000-000000000009'), 100::numeric, 'client-supplied totals are ignored');
select ok((select locked_at is not null from public.session_evaluations where id = 'ea000000-0000-4000-8000-000000000009'), 'locking records its timestamp');

select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select is((select count(*)::integer from public.session_evaluations), 9, 'the assigned teacher reads only their evaluations');
select is_empty($$update public.session_evaluations set family_note = 'blocked' where id = 'ea000000-0000-4000-8000-000000000009' returning id$$, 'the teacher cannot reach a locked evaluation for update');
select throws_ok($$insert into public.session_evaluations (session_id, session_type, scores, created_by) values ('e9900000-0000-4000-8000-000000000001', 'noorani', '{"commitment":5}', '10000000-0000-4000-8000-000000000002')$$, '42501', null, 'a teacher cannot evaluate another teachers session');
reset role;

select set_config('request.jwt.claims', '{"sub":"e9000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select is((select count(*)::integer from public.session_evaluations), 0, 'an unrelated teacher reads no evaluations');
reset role;

select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select is((select count(*)::integer from public.session_evaluations), 1, 'the student reads only their locked evaluations');
select is_empty($$delete from public.session_evaluations where id = 'ea000000-0000-4000-8000-000000000001' returning id$$, 'a student cannot reach evaluations for deletion');
reset role;

select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select is((select count(*)::integer from public.session_evaluations), 1, 'the guardian reads only their childs locked evaluations');
reset role;

select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select is((select count(*)::integer from public.session_evaluations), 0, 'an AAL1 administrator cannot read evaluations');
reset role;

select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
select lives_ok($$update public.session_evaluations set is_locked = false where id = 'ea000000-0000-4000-8000-000000000009'$$, 'an AAL2 administrator unlocks an evaluation');
reset role;
select is((select is_locked from public.session_evaluations where id = 'ea000000-0000-4000-8000-000000000009'), false, 'administrator unlock persists');
select is((select locked_at from public.session_evaluations where id = 'ea000000-0000-4000-8000-000000000009'), null, 'unlock clears the lock timestamp');
select ok((select count(*) >= 11 from public.audit_logs where table_name = 'session_evaluations'), 'evaluation inserts and changes are audited');

select * from finish();

rollback;
