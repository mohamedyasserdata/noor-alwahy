begin;

select plan(24);

select has_view('public', 'v_review_queue', 'review queue view exists');
select ok((select reloptions @> array['security_invoker=true'] from pg_class where oid = 'public.v_review_queue'::regclass), 'review queue view uses caller RLS');
select is(has_table_privilege('anon', 'public.v_review_queue', 'select'), false, 'anonymous callers cannot read the review queue');
select is(has_table_privilege('authenticated', 'public.v_review_queue', 'select'), true, 'authenticated callers can reach the review queue through RLS');

insert into public.tracks (id, code, name_ar, name_en)
values ('ec100000-0000-4000-8000-000000000001', 'review-queue-test', 'اختبار ورد المراجعة', 'Review queue test');

insert into public.teachers (id, profile_id, gender, status, identity_verified_at, code_of_conduct_accepted_at)
values ('ec200000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', 'male', 'active', now(), now());

insert into public.teacher_tracks (teacher_id, track_id)
values ('ec200000-0000-4000-8000-000000000001', 'ec100000-0000-4000-8000-000000000001');

insert into public.students (id, profile_id, full_name, gender, timezone)
values ('ec300000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000003', 'Review Queue Student', 'male', 'Africa/Cairo');

insert into public.guardians (id, profile_id)
values ('ec400000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000004');
insert into public.student_guardians (student_id, guardian_id, relation, is_primary)
values ('ec300000-0000-4000-8000-000000000001', 'ec400000-0000-4000-8000-000000000001', 'parent', true);

insert into public.teacher_assignments (id, student_id, teacher_id, track_id, assigned_by, reason)
values ('ec500000-0000-4000-8000-000000000001', 'ec300000-0000-4000-8000-000000000001', 'ec200000-0000-4000-8000-000000000001', 'ec100000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Review queue test');

insert into public.sessions (id, assignment_id, student_id, teacher_id, scheduled_at, duration_min, status)
select
  ('ec800000-0000-4000-8000-' || lpad(series::text, 12, '0'))::uuid,
  'ec500000-0000-4000-8000-000000000001',
  'ec300000-0000-4000-8000-000000000001',
  'ec200000-0000-4000-8000-000000000001',
  now() - series * interval '1 day',
  30,
  'held'
from generate_series(1, 4) as series;

insert into public.session_evaluations (id, session_id, session_type, from_ayah_id, to_ayah_id, scores, decision, is_locked, created_by)
values ('ec900000-0000-4000-8000-000000000001', 'ec800000-0000-4000-8000-000000000001', 'new_memo', 1, 7, '{"memorization":5}', 'passed', true, '10000000-0000-4000-8000-000000000002');
select is((select review_stage from public.memorization_progress where student_id = 'ec300000-0000-4000-8000-000000000001' and page = 1), 0::smallint, 'newly mastered pages start at review stage zero');
select is((select next_review_due from public.memorization_progress where student_id = 'ec300000-0000-4000-8000-000000000001' and page = 1), (select locked_at::date + 1 from public.session_evaluations where id = 'ec900000-0000-4000-8000-000000000001'), 'newly mastered pages are due after one day');

insert into public.session_evaluations (id, session_id, session_type, from_ayah_id, to_ayah_id, scores, decision, is_locked, created_by)
values ('ec900000-0000-4000-8000-000000000002', 'ec800000-0000-4000-8000-000000000002', 'near_review', 1, 7, '{"memorization":2}', 'repeat', true, '10000000-0000-4000-8000-000000000002');
select is((select review_stage from public.memorization_progress where student_id = 'ec300000-0000-4000-8000-000000000001' and page = 1), 0::smallint, 'a failed review resets the stage to zero');
select is((select next_review_due from public.memorization_progress where student_id = 'ec300000-0000-4000-8000-000000000001' and page = 1), (select locked_at::date + 1 from public.session_evaluations where id = 'ec900000-0000-4000-8000-000000000002'), 'a failed review is due again after one day');

insert into public.session_evaluations (id, session_id, session_type, from_ayah_id, to_ayah_id, scores, decision, is_locked, created_by)
values ('ec900000-0000-4000-8000-000000000003', 'ec800000-0000-4000-8000-000000000003', 'near_review', 1, 7, '{"memorization":4}', 'passed', true, '10000000-0000-4000-8000-000000000002');
select is((select review_stage from public.memorization_progress where student_id = 'ec300000-0000-4000-8000-000000000001' and page = 1), 1::smallint, 'a successful review advances the stage once');
select is((select next_review_due from public.memorization_progress where student_id = 'ec300000-0000-4000-8000-000000000001' and page = 1), (select locked_at::date + 3 from public.session_evaluations where id = 'ec900000-0000-4000-8000-000000000003'), 'stage one uses the three-day interval');

insert into public.session_evaluations (id, session_id, session_type, from_ayah_id, to_ayah_id, scores, decision, is_locked, created_by)
values ('ec900000-0000-4000-8000-000000000004', 'ec800000-0000-4000-8000-000000000004', 'far_review', 1, 7, '{"memorization":5}', 'passed', true, '10000000-0000-4000-8000-000000000002');
select is((select review_stage from public.memorization_progress where student_id = 'ec300000-0000-4000-8000-000000000001' and page = 1), 2::smallint, 'consecutive review success advances to stage two');
select is((select next_review_due from public.memorization_progress where student_id = 'ec300000-0000-4000-8000-000000000001' and page = 1), (select locked_at::date + 7 from public.session_evaluations where id = 'ec900000-0000-4000-8000-000000000004'), 'stage two uses the seven-day interval');

insert into public.memorization_progress (student_id, page, status, first_memorized_at, review_stage, next_review_due)
select
  'ec300000-0000-4000-8000-000000000001',
  page,
  'mastered',
  now() - interval '30 days',
  0,
  current_date - page
from generate_series(2, 13) as page;
insert into public.memorization_progress (student_id, page, status, first_memorized_at, review_stage, next_review_due)
values
  ('ec300000-0000-4000-8000-000000000001', 14, 'mastered', now(), 0, current_date + 1),
  ('ec300000-0000-4000-8000-000000000001', 15, 'in_progress', null, 0, current_date - 20);
update public.memorization_progress
set next_review_due = current_date - page
where student_id = 'ec300000-0000-4000-8000-000000000001'
  and page between 2 and 13;
update public.memorization_progress
set next_review_due = current_date + 1
where student_id = 'ec300000-0000-4000-8000-000000000001'
  and page = 14;

select is((select count(*)::integer from public.v_review_queue where student_id = 'ec300000-0000-4000-8000-000000000001'), 10, 'the daily queue is capped at the configured page limit');
select is((select page from public.v_review_queue where student_id = 'ec300000-0000-4000-8000-000000000001' and queue_position = 1), 13::smallint, 'the oldest due page is first');
select is((select count(*)::integer from public.v_review_queue where student_id = 'ec300000-0000-4000-8000-000000000001' and page = 2), 0, 'newer due pages beyond the daily limit are excluded');
select is((select count(*)::integer from public.v_review_queue where student_id = 'ec300000-0000-4000-8000-000000000001' and page = 14), 0, 'future pages are excluded');
select is((select count(*)::integer from public.v_review_queue where student_id = 'ec300000-0000-4000-8000-000000000001' and page = 15), 0, 'in-progress pages are excluded');
select is((select is_overdue from public.v_review_queue where student_id = 'ec300000-0000-4000-8000-000000000001' and page = 13), true, 'a page overdue by more than twice its interval is marked overdue');
select is((select interval_days from public.v_review_queue where student_id = 'ec300000-0000-4000-8000-000000000001' and page = 13), 1::smallint, 'stage zero exposes its one-day interval');

select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select is((select count(*)::integer from public.v_review_queue), 10, 'the assigned teacher reads the daily queue');
reset role;

select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select is((select count(*)::integer from public.v_review_queue), 10, 'the student reads their own daily queue');
reset role;

select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000005","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select is((select count(*)::integer from public.v_review_queue), 0, 'an unrelated student reads no queue rows');
reset role;

select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select is((select count(*)::integer from public.v_review_queue), 0, 'an AAL1 administrator reads no queue rows');
reset role;

select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
select is((select count(*)::integer from public.v_review_queue), 10, 'an AAL2 administrator reads the queue');
reset role;

select * from finish();

rollback;
