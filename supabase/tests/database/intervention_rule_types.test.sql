begin;

select plan(15);

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',
  true
);
set local role authenticated;
select lives_ok(
  $rules$
    select public.save_intervention_rule('student_struggle', 4::smallint, '{"max_average":40,"min_evaluations":1}'::jsonb, interval '30 days', interval '2 days', true, null);
    select public.save_intervention_rule('student_absence', 3::smallint, '{"min_absences":1}'::jsonb, interval '30 days', interval '2 days', true, null);
    select public.save_intervention_rule('teacher_late', 3::smallint, '{"min_late_minutes":10,"min_occurrences":1}'::jsonb, interval '30 days', interval '2 days', true, null);
    select public.save_intervention_rule('renewal_due', 2::smallint, '{"days_before":3}'::jsonb, interval '30 days', interval '2 days', true, null);
    select public.save_intervention_rule('payment_overdue', 5::smallint, '{"days_overdue":5}'::jsonb, interval '30 days', interval '2 days', true, null);
    select public.save_intervention_rule('report_pending', 2::smallint, '{"days_pending":4}'::jsonb, interval '30 days', interval '2 days', true, null);
    select public.save_intervention_rule('credit_exhausted', 4::smallint, '{"max_remaining":0}'::jsonb, interval '30 days', interval '2 days', true, null);
  $rules$,
  'an AAL2 administrator configures every registered rule type'
);
reset role;

select is(
  (select count(*)::integer from public.intervention_rules),
  7,
  'the registry accepts all seven rule types exactly once'
);

insert into public.teachers(
  id, profile_id, gender, status, identity_verified_at, code_of_conduct_accepted_at
)
values (
  'ab100000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000002',
  'male',
  'active',
  clock_timestamp(),
  clock_timestamp()
);
insert into public.students(id, full_name, gender, timezone)
values ('ab200000-0000-4000-8000-000000000001', 'Registry Boundary Student', 'male', 'Africa/Cairo');
insert into public.sessions(id, student_id, teacher_id, scheduled_at, duration_min)
values (
  'ab300000-0000-4000-8000-000000000001',
  'ab200000-0000-4000-8000-000000000001',
  'ab100000-0000-4000-8000-000000000001',
  clock_timestamp() - interval '1 day',
  30
);
insert into public.attendance(session_id, status, teacher_joined_at, recorded_by)
select
  'ab300000-0000-4000-8000-000000000001',
  'student_absent',
  scheduled_at + interval '10 minutes',
  '10000000-0000-4000-8000-000000000001'
from public.sessions
where id = 'ab300000-0000-4000-8000-000000000001';
insert into public.session_evaluations(
  id, session_id, session_type, scores, is_locked, created_by
)
values (
  'ab400000-0000-4000-8000-000000000001',
  'ab300000-0000-4000-8000-000000000001',
  'recitation',
  '{"tajweed_applied":2,"makharij":2,"waqf_ibtida":2,"fluency":2,"commitment":2}',
  true,
  '10000000-0000-4000-8000-000000000002'
);
insert into public.subscriptions(
  id, student_id, status, start_date, current_period_start, current_period_end,
  renew_date, sessions_per_period
)
values (
  'ab500000-0000-4000-8000-000000000001',
  'ab200000-0000-4000-8000-000000000001',
  'active',
  current_date - 27,
  current_date - 27,
  current_date + 2,
  current_date + 3,
  8
);
insert into public.invoices(
  id, subscription_id, student_id, currency, status, due_date, issued_at, created_by
)
values (
  'ab600000-0000-4000-8000-000000000001',
  'ab500000-0000-4000-8000-000000000001',
  'ab200000-0000-4000-8000-000000000001',
  'USD',
  'issued',
  current_date - 5,
  clock_timestamp() - interval '6 days',
  '10000000-0000-4000-8000-000000000001'
);
insert into public.reports(
  id, student_id, teacher_id, period_type, period_start, period_end, body, status,
  created_at, updated_at
)
values (
  'ab700000-0000-4000-8000-000000000001',
  'ab200000-0000-4000-8000-000000000001',
  'ab100000-0000-4000-8000-000000000001',
  'weekly',
  current_date - 10,
  current_date - 4,
  '{"metrics":{},"summary":"summary","strengths":"strengths","improve":"improve","plan":"plan","recommendation":"recommendation"}',
  'draft',
  clock_timestamp() - interval '4 days',
  clock_timestamp() - interval '4 days'
);

create temporary table intervention_test_clock(at timestamptz not null) on commit drop;
insert into intervention_test_clock values (clock_timestamp());

select is(
  public.evaluate_intervention_rules((select at from intervention_test_clock)),
  7,
  'all seven rules detect their exact inclusive threshold boundary'
);

select is(
  (select count(*)::integer from public.intervention_cases),
  7,
  'the evaluator creates one case for each registered source'
);
select results_eq(
  $$
    select rule.rule_type
    from public.intervention_cases as intervention_case
    join public.intervention_rules as rule on rule.id = intervention_case.rule_id
    order by rule.rule_type
  $$,
  $$values
    ('credit_exhausted'::text),
    ('payment_overdue'::text),
    ('renewal_due'::text),
    ('report_pending'::text),
    ('student_absence'::text),
    ('student_struggle'::text),
    ('teacher_late'::text)
  $$,
  'every registered rule type produces an explainable case'
);
select results_eq(
  $$
    select rule.rule_type, intervention_case.subject_type
    from public.intervention_cases as intervention_case
    join public.intervention_rules as rule on rule.id = intervention_case.rule_id
    order by rule.rule_type
  $$,
  $$values
    ('credit_exhausted'::text, 'subscription'::text),
    ('payment_overdue'::text, 'invoice'::text),
    ('renewal_due'::text, 'subscription'::text),
    ('report_pending'::text, 'report'::text),
    ('student_absence'::text, 'student'::text),
    ('student_struggle'::text, 'student'::text),
    ('teacher_late'::text, 'teacher'::text)
  $$,
  'each case points to the correct source entity'
);
select results_eq(
  $$
    select rule.rule_type, intervention_case.reason_code, intervention_case.recommended_action
    from public.intervention_cases as intervention_case
    join public.intervention_rules as rule on rule.id = intervention_case.rule_id
    order by rule.rule_type
  $$,
  $$values
    ('credit_exhausted'::text, 'session_credit_exhausted'::text, 'replenish_credit'::text),
    ('payment_overdue'::text, 'invoice_payment_overdue'::text, 'review_invoice'::text),
    ('renewal_due'::text, 'subscription_renewal_due'::text, 'contact_payer'::text),
    ('report_pending'::text, 'report_pending_too_long'::text, 'review_report'::text),
    ('student_absence'::text, 'absence_threshold_reached'::text, 'contact_guardian'::text),
    ('student_struggle'::text, 'evaluation_average_below_threshold'::text, 'review_student_progress'::text),
    ('teacher_late'::text, 'teacher_lateness_threshold_reached'::text, 'review_teacher_attendance'::text)
  $$,
  'reason and safe action mappings remain deterministic'
);
select ok(
  (
    select bool_and(
      jsonb_typeof(evidence) = 'object'
      and (
        select count(*)
        from jsonb_object_keys(intervention_cases.evidence)
      ) >= 2
    )
    from public.intervention_cases
  ),
  'every rule retains reviewable source evidence'
);
select is(
  (
    select (evidence ->> 'evaluation_average')::numeric
    from public.intervention_cases as intervention_case
    join public.intervention_rules as rule on rule.id = intervention_case.rule_id
    where rule.rule_type = 'student_struggle'
  ),
  40::numeric,
  'the struggle rule includes the exact average boundary'
);
select is(
  (
    select (evidence ->> 'maximum_late_minutes')::integer
    from public.intervention_cases as intervention_case
    join public.intervention_rules as rule on rule.id = intervention_case.rule_id
    where rule.rule_type = 'teacher_late'
  ),
  10,
  'the lateness rule includes the exact minute boundary'
);
select is(
  (
    select (evidence ->> 'days_overdue')::integer
    from public.intervention_cases as intervention_case
    join public.intervention_rules as rule on rule.id = intervention_case.rule_id
    where rule.rule_type = 'payment_overdue'
  ),
  5,
  'the payment rule includes the exact overdue-day boundary'
);

select is(
  public.evaluate_intervention_rules((select at from intervention_test_clock)),
  7,
  'retrying the same evaluation instant sees the same seven candidates'
);
select is(
  (select count(*)::integer from public.intervention_cases),
  7,
  'the complete evaluator retry creates no duplicate cases'
);
select ok(
  (select bool_and(detection_count = 1) from public.intervention_cases),
  'the same evaluation instant does not inflate detection counts'
);
select is(
  (
    select count(*)::integer
    from public.intervention_cases
    where status in ('open', 'acknowledged')
  ),
  7,
  'all seven active dedupe keys remain unique after the retry'
);

select * from finish();
rollback;
