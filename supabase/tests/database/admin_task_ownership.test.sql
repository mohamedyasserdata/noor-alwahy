begin;

select plan(19);

select has_column('public', 'intervention_cases', 'assigned_to', 'cases store the responsible administrator');
select has_column('public', 'intervention_cases', 'due_at', 'cases store the operational due date');
select has_table('public', 'admin_saved_views', 'administrator saved views table exists');
select is(
  (select relrowsecurity from pg_class where oid = 'public.admin_saved_views'::regclass),
  true,
  'saved views enforce RLS'
);
select ok(
  to_regclass('public.intervention_cases_owner_due_idx') is not null,
  'active task owner and due date index exists'
);
select ok(
  to_regprocedure('public.assign_intervention_case(uuid,uuid,timestamp with time zone)') is not null,
  'guarded task assignment RPC exists'
);
select is(
  has_function_privilege('public', 'public.assign_intervention_case(uuid,uuid,timestamp with time zone)', 'EXECUTE'),
  false,
  'PUBLIC cannot assign intervention work'
);
select is(
  has_function_privilege('anon', 'public.assign_intervention_case(uuid,uuid,timestamp with time zone)', 'EXECUTE'),
  false,
  'anonymous callers cannot assign intervention work'
);

insert into public.intervention_rules(
  id, rule_type, is_enabled, priority, thresholds, window_interval,
  cooldown_interval, action_code, updated_by
)
values (
  'ab300000-0000-4000-8000-000000000002',
  'student_absence',
  true,
  3,
  '{"min_absences":3}'::jsonb,
  interval '30 days',
  interval '2 days',
  'contact_guardian',
  '10000000-0000-4000-8000-000000000001'
)
on conflict (rule_type) do update
set priority = excluded.priority;

insert into public.intervention_cases(
  id, rule_id, subject_type, subject_id, dedupe_key, priority, reason_code,
  evidence, recommended_action, first_detected_at, last_detected_at
)
select
  'ab300000-0000-4000-8000-000000000001', id, 'student',
  '20000000-0000-4000-8000-000000000003', 'pg_test:admin_task_owner', 3,
  'student_absence', '{}'::jsonb, 'contact_guardian', now(), now()
from public.intervention_rules
where rule_type = 'student_absence'
order by created_at
limit 1;

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',
  true
);
set local role authenticated;
select throws_ok(
  $$select public.assign_intervention_case(
    'ab300000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    now() + interval '1 day'
  )$$,
  '42501',
  'admin_mfa_required',
  'AAL1 cannot assign intervention work'
);
reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',
  true
);
set local role authenticated;
select lives_ok(
  $$select public.assign_intervention_case(
    'ab300000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    now() + interval '1 day'
  )$$,
  'AAL2 administrator assigns the task safely'
);
select is(
  (select assigned_to from public.intervention_cases where id = 'ab300000-0000-4000-8000-000000000001'),
  '10000000-0000-4000-8000-000000000001'::uuid,
  'the responsible administrator is retained'
);
select ok(
  (select due_at > now() from public.intervention_cases where id = 'ab300000-0000-4000-8000-000000000001'),
  'the future due date is retained'
);
select throws_ok(
  $$select public.assign_intervention_case(
    'ab300000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    now() - interval '1 day'
  )$$,
  '22023',
  'intervention_assignment_invalid',
  'past due dates are rejected'
);

insert into public.admin_saved_views(profile_id, page_key, name, query_params)
values (
  '10000000-0000-4000-8000-000000000001',
  'students',
  'Awaiting assignment',
  '{"workflow":"awaiting_assignment"}'::jsonb
);
select is(
  (select count(*)::integer from public.admin_saved_views where page_key = 'students'),
  1,
  'an administrator can save a personal view'
);
select is(
  (select query_params ->> 'workflow' from public.admin_saved_views limit 1),
  'awaiting_assignment',
  'saved filters retain their URL state'
);
select throws_ok(
  $$insert into public.admin_saved_views(profile_id, page_key, name, query_params)
    values (
      '10000000-0000-4000-8000-000000000001',
      'students',
      'Invalid payload',
      '[]'::jsonb
    )$$,
  '23514',
  null,
  'saved filters require an object payload'
);
select lives_ok(
  $$delete from public.admin_saved_views where page_key = 'students'$$,
  'the owner can remove a saved view'
);
select is(
  (select count(*)::integer from public.admin_saved_views where page_key = 'students'),
  0,
  'the saved view is removed'
);
reset role;

select ok(
  exists(
    select 1 from public.audit_logs
    where table_name in ('intervention_cases', 'admin_saved_views')
      and action in ('INSERT', 'UPDATE', 'DELETE')
  ),
  'task ownership and saved view changes are audited'
);

select * from finish();
rollback;
