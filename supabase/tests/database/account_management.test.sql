begin;

select plan(18);

insert into auth.users (
  id,
  aud,
  role,
  email,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values (
  '44444444-4444-4444-8444-444444444444',
  'authenticated',
  'authenticated',
  'accounts.admin@example.test',
  '{"role":"admin"}',
  '{"full_name":"Accounts Admin"}',
  now(),
  now()
);

insert into auth.users (
  id,
  aud,
  role,
  email,
  invited_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values (
  '55555555-5555-4555-8555-555555555555',
  'authenticated',
  'authenticated',
  'invited.teacher@example.test',
  now(),
  '{}',
  '{"full_name":"Invited Teacher","role":"teacher","created_by":"44444444-4444-4444-8444-444444444444"}',
  now(),
  now()
);

select is(
  (select role::text from public.profiles where id = '55555555-5555-4555-8555-555555555555'),
  'teacher',
  'an Auth invitation provisions the trusted requested role'
);

select is(
  (select contact_email from public.profile_private where profile_id = '55555555-5555-4555-8555-555555555555'),
  'invited.teacher@example.test',
  'an invitation provisions the private contact record atomically'
);

select is(
  (select count(*)::integer from public.audit_logs where record_id = '55555555-5555-4555-8555-555555555555'),
  1,
  'admin provisioning creates exactly one audit event'
);

select is(
  (select user_id from public.audit_logs where record_id = '55555555-5555-4555-8555-555555555555'),
  '44444444-4444-4444-8444-444444444444'::uuid,
  'the provisioning audit records the acting administrator'
);

select is(
  (select concat_ws('|', action, table_name, after ->> 'role') from public.audit_logs where record_id = '55555555-5555-4555-8555-555555555555'),
  'INSERT|profiles|teacher',
  'the provisioning audit identifies the new profile and role'
);

insert into auth.users (
  id,
  email,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values (
  '77777777-7777-4777-8777-777777777777',
  'managed.student@example.test',
  now(),
  '{}',
  '{"full_name":"Managed Student","role":"student","created_by":"44444444-4444-4444-8444-444444444444"}',
  now(),
  now()
);

update auth.users
set raw_app_meta_data = '{"role":"student"}'
where id = '77777777-7777-4777-8777-777777777777';

select is(
  (select role::text from public.profiles where id = '77777777-7777-4777-8777-777777777777'),
  'student',
  'a confirmed admin-created account provisions the trusted requested role'
);

select is(
  (select user_id from public.audit_logs where record_id = '77777777-7777-4777-8777-777777777777'),
  '44444444-4444-4444-8444-444444444444'::uuid,
  'direct account creation records the acting administrator'
);

select lives_ok(
  $$
    insert into auth.users (
      id, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    ) values (
      '88888888-8888-4888-8888-888888888888',
      'forged.signup@example.test',
      '{}',
      '{"full_name":"Forged Signup","role":"student","created_by":"44444444-4444-4444-8444-444444444444"}',
      now(),
      now()
    )
  $$,
  'an unconfirmed signup may remain pending without a portal profile'
);

select is(
  (select count(*)::integer from public.profiles where id = '88888888-8888-4888-8888-888888888888'),
  0,
  'an unconfirmed signup cannot use user metadata to provision a role'
);

select throws_ok(
  $$
    insert into auth.users (
      id, invited_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    ) values (
      '66666666-6666-4666-8666-666666666666',
      now(),
      '{}',
      '{"full_name":"Forged Invite","role":"student","created_by":"55555555-5555-4555-8555-555555555555"}',
      now(),
      now()
    )
  $$,
  '42501',
  'provisioning_admin_required',
  'an invitation cannot attribute provisioning to a non-admin actor'
);

select is(
  has_function_privilege('authenticated', 'public.set_account_active(uuid,boolean)', 'execute'),
  true,
  'authenticated callers can invoke account activation through the guarded RPC'
);

select is(
  has_function_privilege('anon', 'public.set_account_active(uuid,boolean)', 'execute'),
  false,
  'anonymous callers cannot invoke account activation'
);

insert into auth.sessions (id, user_id, created_at, updated_at)
values (
  '99999999-9999-4999-8999-999999999999',
  '55555555-5555-4555-8555-555555555555',
  now(),
  now()
);

select set_config(
  'request.jwt.claims',
  '{"sub":"55555555-5555-4555-8555-555555555555","role":"authenticated"}',
  true
);
set local role authenticated;

select throws_ok(
  $$select public.set_account_active('44444444-4444-4444-8444-444444444444', false)$$,
  '42501',
  'admin_required',
  'a non-admin cannot change account activation'
);

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"44444444-4444-4444-8444-444444444444","role":"authenticated"}',
  true
);
set local role authenticated;

select throws_ok(
  $$select public.set_account_active('44444444-4444-4444-8444-444444444444', false)$$,
  '23514',
  'admin_cannot_disable_self',
  'an administrator cannot disable their own account'
);

select lives_ok(
  $$select public.set_account_active('55555555-5555-4555-8555-555555555555', false)$$,
  'an administrator can disable another account'
);

select is(
  (select is_active from public.profiles where id = '55555555-5555-4555-8555-555555555555'),
  false,
  'disabling updates the profile instead of deleting it'
);

reset role;

select is(
  (select count(*)::integer from auth.sessions where user_id = '55555555-5555-4555-8555-555555555555'),
  0,
  'disabling immediately revokes every active Auth session for the account'
);

select is(
  (
    select count(*)::integer
    from public.audit_logs
    where record_id = '55555555-5555-4555-8555-555555555555'
      and action = 'UPDATE'
      and before ->> 'is_active' = 'true'
      and after ->> 'is_active' = 'false'
  ),
  1,
  'disabling creates an immutable before and after audit event'
);

select * from finish();

rollback;
