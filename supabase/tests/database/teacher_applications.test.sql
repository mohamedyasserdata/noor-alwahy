begin;
select no_plan();

select has_table('public', 'teacher_applications', 'teacher applications table exists');
select has_function(
  'public',
  'submit_teacher_application',
  array['jsonb', 'text', 'text'],
  'service-only teacher submission RPC exists'
);
select has_function(
  'public',
  'finalize_teacher_application_invite',
  array['uuid', 'uuid'],
  'guarded teacher invitation finalizer exists'
);
select is(
  (select relrowsecurity from pg_class where oid = 'public.teacher_applications'::regclass),
  true,
  'teacher application RLS is enabled'
);
select is(
  has_table_privilege('anon', 'public.teacher_applications', 'select'),
  false,
  'anonymous callers cannot enumerate teacher applications'
);
select is(
  has_table_privilege('anon', 'public.teacher_applications', 'insert'),
  false,
  'anonymous callers cannot directly insert teacher applications'
);
select is(
  has_function_privilege(
    'anon',
    'public.submit_teacher_application(jsonb,text,text)',
    'execute'
  ),
  false,
  'anonymous callers cannot bypass validation and rate limits'
);
select is(
  has_function_privilege(
    'service_role',
    'public.submit_teacher_application(jsonb,text,text)',
    'execute'
  ),
  true,
  'the server route may submit a validated teacher application'
);
select is(
  (select public from storage.buckets where id = 'teacher-applications'),
  false,
  'teacher CV storage is private'
);

set local role service_role;
select matches(
  public.submit_teacher_application(
    '{"full_name":"Teacher Applicant","email":"teacher.applicant@example.test","phone":"+201001234567","gender":"female","specialization":"Tajweed","qualifications":"Certified Quran and Tajweed teacher","experience_years":5,"teaching_languages":["ar","en"],"availability":"Sunday and Tuesday evenings","cv_path":"uploads/11111111-1111-4111-8111-111111111111.pdf","cv_name":"teacher-cv.pdf","consent_version":"2026-10-26","source":"website"}'::jsonb,
    repeat('a', 64),
    repeat('b', 64)
  ),
  '^NW-T-[A-F0-9]{20}$',
  'submission creates a non-sequential teacher application number'
);
select throws_ok(
  $$
    select public.submit_teacher_application(
      '{"full_name":"Duplicate Applicant","email":"teacher.applicant@example.test","phone":"+201001234567","gender":"female","specialization":"Tajweed","qualifications":"Certified Quran and Tajweed teacher","experience_years":5,"teaching_languages":["ar"],"availability":"Sunday evenings","cv_path":"","cv_name":"","consent_version":"2026-10-26","source":"website"}'::jsonb,
      repeat('c', 64),
      repeat('b', 64)
    )
  $$,
  '23505',
  'teacher_application_exists',
  'an open application cannot be submitted twice for the same contact'
);
reset role;

set local role anon;
select throws_ok(
  $$select count(*) from public.teacher_applications$$,
  '42501',
  'permission denied for table teacher_applications',
  'anonymous callers cannot read private application data'
);
reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',
  true
);
set local role authenticated;
select is(
  (
    select count(*)::integer
    from public.teacher_applications
    where email = 'teacher.applicant@example.test'
  ),
  1,
  'an AAL2 administrator can review teacher applications'
);
update public.profiles
set role = 'teacher'
where id = '10000000-0000-4000-8000-000000000005'::uuid;
insert into public.teachers (profile_id, gender, status)
values ('10000000-0000-4000-8000-000000000005'::uuid, 'male', 'pending');
update public.teacher_applications
set status = 'reviewing'
where email = 'teacher.applicant@example.test';
update public.teacher_applications
set status = 'accepted'
where email = 'teacher.applicant@example.test';
select lives_ok(
  $$
    select public.finalize_teacher_application_invite(
      (
        select id from public.teacher_applications
        where email = 'teacher.applicant@example.test'
        limit 1
      ),
      '10000000-0000-4000-8000-000000000005'::uuid
    )
  $$,
  'an accepted application can create and link a pending teacher profile'
);
select is(
  (
    select status
    from public.teacher_applications
    where invited_user_id = '10000000-0000-4000-8000-000000000005'::uuid
  ),
  'invited',
  'finalizing an invitation advances the application exactly once'
);
reset role;

select * from finish();
rollback;
