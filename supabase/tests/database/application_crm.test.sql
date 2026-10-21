begin;
select no_plan();
select has_table('public', 'placement_tests', 'placement tests table exists');
select has_function('public', 'convert_application_to_student', array['uuid'], 'atomic conversion RPC exists');
select is((select relrowsecurity from pg_class where oid = 'public.placement_tests'::regclass), true, 'placement RLS is enabled');

set local role service_role;
select public.submit_application(
  '{"student_name":"طالب تحويل","student_gender":"male","student_age":14,"guardian_name":"ولي التحويل","contact_email":"convert@example.test","contact_phone":"","country_code":"EG","timezone":"Africa/Cairo","track_id":"","package_id":"","self_level":"intermediate","preferred_times":["Monday 18:00"],"preferred_teacher_gender":"male","notes":"ملاحظة طلب","consent_version":"2026-10-21","source":"website"}'::jsonb,
  repeat('d',64), repeat('e',64), repeat('f',64)
);
reset role;

select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
select lives_ok($$update public.applications set status = 'contacted' where contact_email = 'convert@example.test'$$, 'administrator moves new application to contacted');
select lives_ok($$update public.applications set status = 'accepted' where contact_email = 'convert@example.test'$$, 'administrator accepts contacted application');
select throws_ok($$update public.applications set status = 'new' where contact_email = 'convert@example.test'$$, 'P0001', 'invalid_application_transition', 'terminal accepted application cannot move backwards');
select lives_ok(
  $$insert into public.placement_tests(application_id,evaluator_id,recitation_score,tajweed_score,memorization_score,notes)
    select id,'10000000-0000-4000-8000-000000000001',70,75,65,'اختبار مستوى' from public.applications where contact_email='convert@example.test'$$,
  'administrator records placement result'
);
select is(
  public.convert_application_to_student((select id from public.applications where contact_email='convert@example.test')),
  public.convert_application_to_student((select id from public.applications where contact_email='convert@example.test')),
  'conversion is idempotent and returns the same student'
);
select is((select count(*)::integer from public.students where full_name='طالب تحويل'), 1, 'conversion creates exactly one student');
select ok((select converted_student_id is not null from public.applications where contact_email='convert@example.test'), 'application links to converted student');
reset role;

select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select is((select count(*)::integer from public.applications), 0, 'teacher cannot read application PII');
select is((select count(*)::integer from public.placement_tests), 0, 'teacher reads only own placement records');
reset role;

select * from finish();
rollback;
