begin;

select plan(25);

insert into auth.users (
  id,
  aud,
  role,
  email,
  phone,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values
  (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'authenticated',
    'authenticated',
    'admin.p1t01@example.test',
    '+201000000001',
    '{"role":"admin"}',
    '{"full_name":"P1 Admin","display_name":"Admin"}',
    now(),
    now()
  ),
  (
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    'authenticated',
    'authenticated',
    'teacher.p1t01@example.test',
    '+201000000002',
    '{"role":"teacher"}',
    '{"full_name":"P1 Teacher","display_name":"Teacher","role":"admin"}',
    now(),
    now()
  ),
  (
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    'authenticated',
    'authenticated',
    'student.p1t01@example.test',
    '+201000000003',
    '{"role":"student"}',
    '{"full_name":"P1 Student","display_name":"Student"}',
    now(),
    now()
  ),
  (
    'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    'authenticated',
    'authenticated',
    'inactive.p1t01@example.test',
    '+201000000004',
    '{"role":"parent"}',
    '{"full_name":"P1 Inactive Parent","display_name":"Parent"}',
    now(),
    now()
  );

update public.profiles
set is_active = false
where id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

select is(
  (select count(*)::integer from public.profiles),
  4,
  'auth.users inserts provision one profile per user'
);

select is(
  (select count(*)::integer from public.profile_private),
  4,
  'auth.users inserts provision one private profile per user'
);

select is(
  (
    select concat_ws('|', phone, contact_email)
    from public.profile_private
    where profile_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
  ),
  '+201000000002|teacher.p1t01@example.test',
  'provisioning copies contact data into the private table'
);

select is(
  (
    select concat_ws('|', role::text, timezone, preferred_locale, is_active::text)
    from public.profiles
    where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
  ),
  'teacher|Africa/Cairo|ar|true',
  'provisioning trusts app metadata for role and applies profile defaults'
);

select throws_ok(
  $$
    insert into auth.users (id, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
    values (
      'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      '{"role":"owner"}',
      '{"full_name":"Invalid Role"}',
      now(),
      now()
    )
  $$,
  '22023',
  'profile_role_required',
  'provisioning rejects an absent or invalid trusted role'
);

select throws_ok(
  $$
    insert into auth.users (id, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
    values (
      'ffffffff-ffff-4fff-8fff-ffffffffffff',
      '{"role":"student"}',
      '{}',
      now(),
      now()
    )
  $$,
  '22023',
  'profile_full_name_required',
  'provisioning rejects a missing full name'
);

select is(
  (
    select count(*)::integer
    from (
      values
        (has_table_privilege('anon', 'public.profiles', 'select')),
        (has_table_privilege('anon', 'public.profile_private', 'select'))
    ) as privilege (allowed)
    where allowed
  ),
  0,
  'anonymous callers have no select grant on identity tables'
);

select is(
  (
    select count(*)::integer
    from (
      values
        (has_function_privilege('anon', 'public.auth_role()', 'execute')),
        (has_function_privilege('anon', 'public.is_admin()', 'execute')),
        (has_function_privilege('anon', 'public.handle_new_user()', 'execute'))
    ) as privilege (allowed)
    where allowed
  ),
  0,
  'anonymous callers cannot execute identity security-definer functions'
);

select is(
  (
    select count(*)::integer
    from (
      values
        (has_table_privilege('authenticated', 'public.profiles', 'select')),
        (has_table_privilege('authenticated', 'public.profile_private', 'select'))
    ) as privilege (allowed)
    where allowed
  ),
  2,
  'authenticated callers have grants that are narrowed by RLS'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","role":"authenticated"}',
  true
);
set local role authenticated;

select is((select public.auth_role())::text, 'teacher', 'auth_role returns the active caller role');
select is((select public.is_admin()), false, 'is_admin rejects a non-admin caller');
select is((select count(*)::integer from public.profiles), 1, 'a teacher reads only their own profile');
select is((select count(*)::integer from public.profile_private), 1, 'a teacher reads only their own private profile');

update public.profiles
set full_name = 'Escalated Teacher'
where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

select is(
  (select full_name from public.profiles),
  'P1 Teacher',
  'a non-admin cannot update even their own public profile'
);

update public.profile_private
set phone = '+201111111111'
where profile_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

select is(
  (select phone from public.profile_private),
  '+201111111111',
  'a teacher can update their own private contact data'
);

update public.profile_private
set phone = '+209999999999'
where profile_id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

reset role;

select is(
  (
    select phone
    from public.profile_private
    where profile_id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
  ),
  '+201000000003',
  'a teacher cannot update another user private profile'
);

set local role authenticated;

delete from public.profile_private
where profile_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

select is(
  (select count(*)::integer from public.profile_private),
  1,
  'a non-admin cannot delete their private profile'
);

select ok(
  (
    select updated_at > created_at
    from public.profile_private
    where profile_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
  ),
  'set_updated_at advances the timestamp after an allowed update'
);

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"dddddddd-dddd-4ddd-8ddd-dddddddddddd","role":"authenticated"}',
  true
);
set local role authenticated;

select is((select public.auth_role())::text, null, 'auth_role returns null for an inactive profile');
select is((select count(*)::integer from public.profile_private), 0, 'an inactive caller cannot read private profile data');

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}',
  true
);
set local role authenticated;

select is((select public.is_admin()), true, 'is_admin accepts an active administrator');
select is((select count(*)::integer from public.profiles), 4, 'an administrator reads every profile');
select is((select count(*)::integer from public.profile_private), 4, 'an administrator reads every private profile');

update public.profiles
set display_name = 'Updated Student'
where id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

select is(
  (
    select display_name
    from public.profiles
    where id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
  ),
  'Updated Student',
  'an administrator can update another user profile'
);

select ok(
  (
    select updated_at > created_at
    from public.profiles
    where id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
  ),
  'profiles updates advance updated_at'
);

select * from finish();

rollback;
