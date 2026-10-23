begin;
select no_plan();
select has_table('public', 'applications', 'applications table exists');
select has_function('public', 'submit_application', array['jsonb','text','text','text'], 'service-only submission RPC exists');
select has_function('public', 'lookup_application_status', array['text','text'], 'constant-shape status lookup RPC exists');
select is((select relrowsecurity from pg_class where oid = 'public.applications'::regclass), true, 'application RLS is enabled');
select is(has_table_privilege('anon', 'public.applications', 'select'), false, 'anonymous user cannot enumerate applications');
select is(has_table_privilege('anon', 'public.applications', 'insert'), false, 'anonymous user cannot directly insert applications');
select is(has_function_privilege('anon', 'public.submit_application(jsonb,text,text,text)', 'execute'), false, 'anonymous user cannot bypass the route handler');
select is(has_function_privilege('anon', 'public.lookup_application_status(text,text)', 'execute'), false, 'anonymous user cannot call the status lookup directly');
select is(has_function_privilege('service_role', 'public.lookup_application_status(text,text)', 'execute'), true, 'service route may call the limited status lookup');

set local role service_role;
select matches(
  public.submit_application(
    '{"student_name":"متقدم اختبار","student_gender":"male","student_age":12,"guardian_name":"ولي اختبار","contact_email":"apply@example.test","contact_phone":"","country_code":"EG","timezone":"Africa/Cairo","track_id":"","package_id":"","self_level":"beginner","preferred_times":["Sunday 18:00"],"preferred_teacher_gender":"male","notes":"","consent_version":"2026-10-21","source":"website"}'::jsonb,
    repeat('a',64), repeat('b',64), repeat('c',64)
  ),
  '^NW-A-[A-F0-9]{20}$',
  'submission creates a non-sequential eighty-bit order number'
);
reset role;

set local role anon;
select throws_ok(
  $$select count(*) from public.applications$$,
  '42501',
  'permission denied for table applications',
  'anonymous caller cannot enumerate private applications'
);
reset role;

select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
select is((select count(*)::integer from public.applications), 1, 'AAL2 administrator reads applications');
reset role;

select * from finish();
rollback;
