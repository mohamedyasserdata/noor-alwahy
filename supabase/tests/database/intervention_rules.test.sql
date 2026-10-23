begin;

select plan(48);

select has_table('public', 'intervention_rules', 'intervention rules table exists');
select has_table('public', 'intervention_cases', 'intervention cases table exists');
select has_column('public', 'intervention_rules', 'thresholds', 'rules store validated thresholds');
select has_column('public', 'intervention_cases', 'evidence', 'cases retain explainable evidence');
select is(
  (select relrowsecurity from pg_class where oid = 'public.intervention_rules'::regclass),
  true,
  'intervention rules have RLS'
);
select is(
  (select relrowsecurity from pg_class where oid = 'public.intervention_cases'::regclass),
  true,
  'intervention cases have RLS'
);
select ok(
  to_regclass('public.intervention_cases_one_active_idx') is not null,
  'only one active case can exist for a dedupe key'
);
select ok(
  to_regprocedure('public.save_intervention_rule(text,smallint,jsonb,interval,interval,boolean,uuid)') is not null,
  'guarded rule management RPC exists'
);
select ok(
  to_regprocedure('public.evaluate_intervention_rules(timestamp with time zone)') is not null,
  'scheduled evaluator RPC exists'
);
select ok(
  to_regprocedure('public.transition_intervention_case(uuid,text,text)') is not null,
  'guarded case transition RPC exists'
);
select is(
  has_function_privilege('public', 'public.evaluate_intervention_rules(timestamp with time zone)', 'EXECUTE'),
  false,
  'PUBLIC cannot execute the evaluator'
);
select is(
  has_function_privilege('anon', 'public.evaluate_intervention_rules(timestamp with time zone)', 'EXECUTE'),
  false,
  'anonymous callers cannot execute the evaluator'
);
select is(
  has_function_privilege('service_role', 'public.evaluate_intervention_rules(timestamp with time zone)', 'EXECUTE'),
  true,
  'service role can execute the scheduled evaluator'
);
select is(
  (select count(*)::integer from cron.job where jobname = 'evaluate-interventions-hourly'),
  1,
  'the intervention evaluator is scheduled exactly once'
);

select throws_ok(
  $$insert into public.intervention_rules(rule_type, priority, thresholds, window_interval, cooldown_interval, updated_by)
    values ('unknown', 3, '{}'::jsonb, interval '30 days', interval '2 days', '10000000-0000-4000-8000-000000000001')$$,
  '23514',
  'intervention_rule_type_invalid',
  'unknown rule types are rejected'
);
select throws_ok(
  $$insert into public.intervention_rules(rule_type, priority, thresholds, window_interval, cooldown_interval, updated_by)
    values ('student_absence', 3, '{"min_absences":"3"}'::jsonb, interval '30 days', interval '2 days', '10000000-0000-4000-8000-000000000001')$$,
  '23514',
  'intervention_rule_thresholds_invalid',
  'threshold values must use the registry type'
);
select throws_ok(
  $$insert into public.intervention_rules(rule_type, priority, thresholds, window_interval, cooldown_interval, updated_by)
    values ('student_absence', 3, '{"min_absences":3,"unexpected":1}'::jsonb, interval '30 days', interval '2 days', '10000000-0000-4000-8000-000000000001')$$,
  '23514',
  'intervention_rule_thresholds_invalid',
  'unknown threshold keys are rejected'
);
select throws_ok(
  $$insert into public.intervention_rules(rule_type, priority, thresholds, window_interval, cooldown_interval, updated_by)
    values ('student_absence', 3, '{"min_absences":3}'::jsonb, interval '30 minutes', interval '2 days', '10000000-0000-4000-8000-000000000001')$$,
  '23514',
  'intervention_rule_window_invalid',
  'unsafe evaluation windows are rejected'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',
  true
);
set local role authenticated;
select ok(
  public.save_intervention_rule(
    'student_absence', 3::smallint, '{"min_absences":3}'::jsonb,
    interval '30 days', interval '2 days', true, null
  ) is not null,
  'an AAL2 administrator creates a registered rule'
);
select is(
  (select action_code from public.intervention_rules where rule_type = 'student_absence'),
  'contact_guardian',
  'the registry fixes the safe action for an absence rule'
);
select is(
  (select count(*)::integer from public.intervention_rules),
  1,
  'an AAL2 administrator can read managed rules'
);
reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',
  true
);
set local role authenticated;
select throws_ok(
  $$select public.save_intervention_rule('student_absence', 3::smallint, '{"min_absences":2}'::jsonb, interval '30 days', interval '2 days', true, null)$$,
  '42501',
  'admin_mfa_required',
  'an AAL1 administrator cannot manage rules'
);
reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}',
  true
);
set local role authenticated;
select is(
  (select count(*)::integer from public.intervention_rules),
  0,
  'a teacher cannot read intervention rules'
);
select throws_ok(
  $$select public.transition_intervention_case('aa300000-0000-4000-8000-000000000001', 'acknowledged', null)$$,
  '42501',
  'admin_mfa_required',
  'a teacher cannot transition intervention cases'
);
reset role;

insert into public.teachers(
  id, profile_id, gender, status, identity_verified_at, code_of_conduct_accepted_at
)
values (
  'aa100000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000002',
  'male',
  'active',
  now(),
  now()
);
insert into public.students(id, full_name, gender, timezone)
values ('aa200000-0000-4000-8000-000000000001', 'Intervention Student', 'male', 'Africa/Cairo');
insert into public.sessions(id, student_id, teacher_id, scheduled_at, duration_min)
values
  ('aa400000-0000-4000-8000-000000000001', 'aa200000-0000-4000-8000-000000000001', 'aa100000-0000-4000-8000-000000000001', '2030-01-25 08:00+00', 30),
  ('aa400000-0000-4000-8000-000000000002', 'aa200000-0000-4000-8000-000000000001', 'aa100000-0000-4000-8000-000000000001', '2030-01-26 08:00+00', 30),
  ('aa400000-0000-4000-8000-000000000003', 'aa200000-0000-4000-8000-000000000001', 'aa100000-0000-4000-8000-000000000001', '2030-01-27 08:00+00', 30);
insert into public.attendance(session_id, status, recorded_by)
values
  ('aa400000-0000-4000-8000-000000000001', 'student_absent', '10000000-0000-4000-8000-000000000001'),
  ('aa400000-0000-4000-8000-000000000002', 'student_absent', '10000000-0000-4000-8000-000000000001'),
  ('aa400000-0000-4000-8000-000000000003', 'student_absent', '10000000-0000-4000-8000-000000000001');

set local role service_role;
select is(
  public.evaluate_intervention_rules('2030-01-31 12:00+00'),
  1,
  'the evaluator detects the threshold boundary'
);
reset role;
select is(
  (select count(*)::integer from public.intervention_cases where status = 'open'),
  1,
  'one active absence case is created'
);
select ok(
  (
    select reason_code = 'absence_threshold_reached'
      and recommended_action = 'contact_guardian'
      and (evidence ->> 'absences')::integer = 3
    from public.intervention_cases
  ),
  'the case explains its reason, evidence, and safe action'
);

set local role service_role;
select is(
  public.evaluate_intervention_rules('2030-01-31 12:00+00'),
  1,
  'an identical evaluator retry remains idempotent'
);
reset role;
select is((select count(*)::integer from public.intervention_cases), 1, 'a retry creates no duplicate case');
select is((select detection_count from public.intervention_cases), 1, 'the same evaluation instant is not counted twice');

set local role service_role;
select is(
  public.evaluate_intervention_rules('2030-01-31 13:00+00'),
  1,
  'a later detection updates the active case'
);
reset role;
select is((select detection_count from public.intervention_cases), 2, 'a new detection instant increments the count');

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',
  true
);
set local role authenticated;
select lives_ok(
  $$select public.transition_intervention_case(
    (select id from public.intervention_cases limit 1), 'acknowledged', null
  )$$,
  'an AAL2 administrator acknowledges a case'
);
select is((select status from public.intervention_cases), 'acknowledged', 'the case enters acknowledged state');
select is(
  (select acknowledged_by from public.intervention_cases),
  '10000000-0000-4000-8000-000000000001'::uuid,
  'the acknowledgement actor is retained'
);
select throws_ok(
  $$select public.transition_intervention_case(
    (select id from public.intervention_cases limit 1), 'acknowledged', null
  )$$,
  'P0001',
  'intervention_case_transition_invalid',
  'an invalid repeated transition is rejected'
);
reset role;

select throws_ok(
  $$insert into public.intervention_cases(
      rule_id, subject_type, subject_id, dedupe_key, priority,
      reason_code, evidence, recommended_action, first_detected_at, last_detected_at
    )
    select rule_id, subject_type, subject_id, dedupe_key, priority,
      reason_code, evidence, recommended_action, first_detected_at, last_detected_at
    from public.intervention_cases limit 1$$,
  '23505',
  null,
  'the partial unique index blocks a racing active duplicate'
);

delete from public.attendance
where session_id in (
  'aa400000-0000-4000-8000-000000000001',
  'aa400000-0000-4000-8000-000000000002',
  'aa400000-0000-4000-8000-000000000003'
);
set local role service_role;
select is(public.evaluate_intervention_rules('2030-01-31 14:00+00'), 0, 'a cleared condition has no candidates');
reset role;
select is((select status from public.intervention_cases), 'resolved', 'a cleared condition auto-resolves the case');
select ok(
  exists(
    select 1 from public.audit_logs
    where table_name = 'intervention_cases' and action = 'UPDATE'
  ),
  'case transitions are audited'
);
select ok(
  exists(
    select 1 from public.job_runs
    where job_name = 'evaluate_intervention_rules' and result = 'succeeded'
  ),
  'evaluator runs are recorded'
);

insert into public.attendance(session_id, status, recorded_by)
values
  ('aa400000-0000-4000-8000-000000000001', 'student_absent', '10000000-0000-4000-8000-000000000001'),
  ('aa400000-0000-4000-8000-000000000002', 'student_absent', '10000000-0000-4000-8000-000000000001'),
  ('aa400000-0000-4000-8000-000000000003', 'student_absent', '10000000-0000-4000-8000-000000000001');
set local role service_role;
select lives_ok(
  $$select public.evaluate_intervention_rules('2030-02-01 12:00+00')$$,
  'detection inside cooldown is processed safely'
);
reset role;
select is((select count(*)::integer from public.intervention_cases), 1, 'cooldown suppresses an early reopen');

set local role service_role;
select lives_ok(
  $$select public.evaluate_intervention_rules('2030-02-03 12:00+00')$$,
  'detection after cooldown reopens safely'
);
reset role;
select is((select count(*)::integer from public.intervention_cases), 2, 'reopen creates a new historical case');
select ok(
  (
    select reopened_from_case_id is not null
    from public.intervention_cases
    where status = 'open'
  ),
  'the reopened case links to its previous history'
);
select is(
  (select count(*)::integer from public.intervention_cases where status in ('open', 'acknowledged')),
  1,
  'exactly one active case remains after reopen'
);
select ok(
  exists(
    select 1 from public.audit_logs
    where table_name = 'intervention_rules' and action = 'INSERT'
  ),
  'rule changes are audited'
);

select * from finish();
rollback;
