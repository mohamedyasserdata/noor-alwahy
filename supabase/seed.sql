-- Local-only authentication fixtures used by Playwright. Product data remains empty.
insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  recovery_token,
  email_change_token_new,
  email_change
)
select
  '00000000-0000-0000-0000-000000000000'::uuid,
  fixture.id,
  'authenticated',
  'authenticated',
  fixture.email,
  extensions.crypt('AcademyTest1!', extensions.gen_salt('bf')),
  now(),
  jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email'), 'role', fixture.role),
  jsonb_build_object('full_name', fixture.full_name),
  now(),
  now(),
  '',
  '',
  '',
  ''
from (
  values
    ('10000000-0000-4000-8000-000000000001'::uuid, 'admin.test@noor.local', 'admin', 'مدير الاختبار'),
    ('10000000-0000-4000-8000-000000000002'::uuid, 'teacher.test@noor.local', 'teacher', 'مدرس الاختبار'),
    ('10000000-0000-4000-8000-000000000003'::uuid, 'student.test@noor.local', 'student', 'طالب الاختبار'),
    ('10000000-0000-4000-8000-000000000004'::uuid, 'parent.test@noor.local', 'parent', 'ولي اختبار'),
    ('10000000-0000-4000-8000-000000000005'::uuid, 'recovery.test@noor.local', 'student', 'استعادة الاختبار')
) as fixture(id, email, role, full_name);

insert into auth.identities (
  id,
  provider_id,
  user_id,
  identity_data,
  provider,
  last_sign_in_at,
  created_at,
  updated_at
)
select
  fixture.id,
  fixture.email,
  fixture.id,
  jsonb_build_object(
    'sub', fixture.id::text,
    'email', fixture.email,
    'email_verified', true,
    'phone_verified', false
  ),
  'email',
  now(),
  now(),
  now()
from (
  values
    ('10000000-0000-4000-8000-000000000001'::uuid, 'admin.test@noor.local'),
    ('10000000-0000-4000-8000-000000000002'::uuid, 'teacher.test@noor.local'),
    ('10000000-0000-4000-8000-000000000003'::uuid, 'student.test@noor.local'),
    ('10000000-0000-4000-8000-000000000004'::uuid, 'parent.test@noor.local'),
    ('10000000-0000-4000-8000-000000000005'::uuid, 'recovery.test@noor.local')
) as fixture(id, email);

-- Portal fixtures must include their domain records as well as auth identities.
-- Keeping these rows in the seed makes a fresh local database sufficient for
-- every role-based browser journey, without relying on leftovers from earlier runs.
insert into public.teachers (
  id,
  profile_id,
  gender,
  status,
  identity_verified_at,
  code_of_conduct_accepted_at
)
values (
  '20000000-0000-4000-8000-000000000002'::uuid,
  '10000000-0000-4000-8000-000000000002'::uuid,
  'male'::public.gender_t,
  'active',
  now(),
  now()
)
on conflict (profile_id) do update set
  status = excluded.status,
  identity_verified_at = excluded.identity_verified_at,
  code_of_conduct_accepted_at = excluded.code_of_conduct_accepted_at;

insert into public.students (id, profile_id, full_name, gender, timezone)
values
  (
    '20000000-0000-4000-8000-000000000003'::uuid,
    '10000000-0000-4000-8000-000000000003'::uuid,
    'طالب الاختبار',
    'male'::public.gender_t,
    'Africa/Cairo'
  ),
  (
    '20000000-0000-4000-8000-000000000005'::uuid,
    '10000000-0000-4000-8000-000000000005'::uuid,
    'استعادة الاختبار',
    'male'::public.gender_t,
    'Africa/Cairo'
  )
on conflict (profile_id) do update set
  full_name = excluded.full_name,
  gender = excluded.gender,
  timezone = excluded.timezone;

insert into public.guardians (id, profile_id)
values (
  '20000000-0000-4000-8000-000000000004'::uuid,
  '10000000-0000-4000-8000-000000000004'::uuid
)
on conflict (profile_id) do nothing;
