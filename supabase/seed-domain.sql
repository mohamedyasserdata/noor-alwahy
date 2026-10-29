-- Portal fixtures must include their domain records as well as auth identities.
-- This file is loaded for local development and browser journeys, but excluded
-- from pgTAP setup because those tests create isolated domain records.
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
