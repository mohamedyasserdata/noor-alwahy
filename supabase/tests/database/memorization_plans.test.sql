begin;

select plan(34);

select has_table('public', 'memorization_plans', 'memorization plans table exists');
select has_view('public', 'v_memorization_plan_adherence', 'memorization plan adherence view exists');
select has_column('public', 'memorization_plans', 'weekly_target_pages', 'plans store a weekly page target');
select has_column('public', 'memorization_plans', 'monthly_target_pages', 'plans store a monthly page target');
select has_column('public', 'memorization_plans', 'starts_on', 'plans store their start date');
select has_column('public', 'memorization_plans', 'ends_on', 'plans can store an end date');
select is((select relrowsecurity from pg_class where oid = 'public.memorization_plans'::regclass), true, 'memorization plans have RLS');
select ok((select reloptions @> array['security_invoker=true'] from pg_class where oid = 'public.v_memorization_plan_adherence'::regclass), 'the adherence view uses caller RLS');
select is(has_table_privilege('anon', 'public.memorization_plans', 'select'), false, 'anonymous callers cannot read plans');
select is(has_table_privilege('authenticated', 'public.memorization_plans', 'select'), true, 'authenticated callers reach plan RLS');
select is(has_table_privilege('authenticated', 'public.memorization_plans', 'insert'), true, 'authorized authenticated callers can create plans');
select is(has_column_privilege('authenticated', 'public.memorization_plans', 'weekly_target_pages', 'update'), true, 'authorized authenticated callers can update plan targets');
select is(has_column_privilege('authenticated', 'public.memorization_plans', 'created_by', 'update'), false, 'callers cannot rewrite plan authorship');
select is(has_table_privilege('service_role', 'public.memorization_plans', 'insert'), false, 'service role cannot bypass plan writes');

insert into public.tracks (id, code, name_ar, name_en)
values ('ed100000-0000-4000-8000-000000000001', 'memorization-plan-test', 'اختبار خطة الحفظ', 'Memorization plan test');

insert into public.teachers (id, profile_id, gender, status, identity_verified_at, code_of_conduct_accepted_at)
values ('ed200000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', 'male', 'active', now(), now());

insert into public.teacher_tracks (teacher_id, track_id)
values ('ed200000-0000-4000-8000-000000000001', 'ed100000-0000-4000-8000-000000000001');

insert into public.students (id, profile_id, full_name, gender, timezone)
values
  ('ed300000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000003', 'Plan Student', 'male', 'Africa/Cairo'),
  ('ed300000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000005', 'Unassigned Plan Student', 'male', 'Africa/Cairo');

insert into public.guardians (id, profile_id)
values ('ed400000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000004');
insert into public.student_guardians (student_id, guardian_id, relation, is_primary)
values ('ed300000-0000-4000-8000-000000000001', 'ed400000-0000-4000-8000-000000000001', 'parent', true);

insert into public.teacher_assignments (id, student_id, teacher_id, track_id, assigned_by, reason)
values ('ed500000-0000-4000-8000-000000000001', 'ed300000-0000-4000-8000-000000000001', 'ed200000-0000-4000-8000-000000000001', 'ed100000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Memorization plan test');

select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
select lives_ok(
  $$insert into public.memorization_plans (student_id, weekly_target_pages, monthly_target_pages, starts_on, created_by, updated_by)
    values ('ed300000-0000-4000-8000-000000000001', 4, 16, current_date - 7, '10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001')$$,
  'an AAL2 administrator can create a plan'
);
select throws_ok(
  $$insert into public.memorization_plans (student_id, weekly_target_pages, monthly_target_pages, starts_on, created_by, updated_by)
    values ('ed300000-0000-4000-8000-000000000002', 0, 16, current_date, '10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001')$$,
  '23514', null, 'weekly targets must be positive'
);
select throws_ok(
  $$insert into public.memorization_plans (student_id, weekly_target_pages, monthly_target_pages, starts_on, ends_on, created_by, updated_by)
    values ('ed300000-0000-4000-8000-000000000002', 4, 16, current_date, current_date - 1, '10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001')$$,
  '23514', null, 'a plan cannot end before it starts'
);
select throws_ok(
  $$insert into public.memorization_plans (student_id, weekly_target_pages, monthly_target_pages, starts_on, created_by, updated_by)
    values ('ed300000-0000-4000-8000-000000000001', 5, 20, current_date, '10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001')$$,
  '23505', null, 'a student has only one plan'
);
reset role;

insert into public.memorization_progress (student_id, page, status, first_memorized_at)
values
  ('ed300000-0000-4000-8000-000000000001', 1, 'mastered', now()),
  ('ed300000-0000-4000-8000-000000000001', 2, 'mastered', now()),
  ('ed300000-0000-4000-8000-000000000001', 3, 'in_progress', now()),
  ('ed300000-0000-4000-8000-000000000001', 4, 'mastered', date_trunc('month', current_date) - interval '1 day');

select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select is((select count(*)::integer from public.memorization_plans), 1, 'the assigned teacher reads the student plan');
select lives_ok(
  $$update public.memorization_plans
    set weekly_target_pages = 5, updated_by = '10000000-0000-4000-8000-000000000002'
    where student_id = 'ed300000-0000-4000-8000-000000000001'$$,
  'the assigned teacher can update the student plan'
);
select is((select weekly_target_pages from public.memorization_plans), 5::smallint, 'the teacher update is stored');
select throws_ok(
  $$insert into public.memorization_plans (student_id, weekly_target_pages, monthly_target_pages, starts_on, created_by, updated_by)
    values ('ed300000-0000-4000-8000-000000000002', 4, 16, current_date, '10000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002')$$,
  '42501', null, 'a teacher cannot create a plan for an unassigned student'
);
reset role;

select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select is((select count(*)::integer from public.memorization_plans), 1, 'the student reads their own plan');
select lives_ok(
  $$update public.memorization_plans set weekly_target_pages = 6, updated_by = '10000000-0000-4000-8000-000000000003'$$,
  'an unauthorized update reveals no writable plan rows'
);
select is((select weekly_target_pages from public.memorization_plans), 5::smallint, 'a student cannot change their plan');
select is((select weekly_achieved_pages from public.v_memorization_plan_adherence), 2, 'weekly adherence counts mastered pages first memorized this week');
select is((select monthly_achieved_pages from public.v_memorization_plan_adherence), 2, 'monthly adherence counts mastered pages first memorized this month');
select is((select weekly_adherence_percent from public.v_memorization_plan_adherence), 40::numeric, 'weekly adherence is measured against the current target');
select is((select monthly_adherence_percent from public.v_memorization_plan_adherence), 12.5::numeric, 'monthly adherence is measured against the current target');
reset role;

select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select is((select count(*)::integer from public.v_memorization_plan_adherence), 1, 'the guardian reads the linked student adherence');
reset role;

select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000005","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select is((select count(*)::integer from public.memorization_plans), 0, 'an unrelated student reads no plans');
select is((select count(*)::integer from public.v_memorization_plan_adherence), 0, 'an unrelated student reads no adherence rows');
reset role;

select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select is((select count(*)::integer from public.memorization_plans), 0, 'an AAL1 administrator reads no plans');
reset role;

select ok((select count(*) > 0 from public.audit_logs where table_name = 'memorization_plans'), 'plan changes are audited');

select * from finish();

rollback;
