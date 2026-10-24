begin;

select plan(21);

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
values
  (
    '11111111-1111-4111-8111-111111111111',
    'authenticated',
    'authenticated',
    'audit.admin@example.test',
    '{"role":"admin"}',
    '{"full_name":"Audit Admin"}',
    now(),
    now()
  ),
  (
    '22222222-2222-4222-8222-222222222222',
    'authenticated',
    'authenticated',
    'audit.teacher@example.test',
    '{"role":"teacher"}',
    '{"full_name":"Audit Teacher"}',
    now(),
    now()
  ),
  (
    '33333333-3333-4333-8333-333333333333',
    'authenticated',
    'authenticated',
    'audit.student@example.test',
    '{"role":"student"}',
    '{"full_name":"Audit Student"}',
    now(),
    now()
  );

select is(
  (
    select count(*)::integer
    from (
      values
        (has_table_privilege('anon', 'public.audit_logs', 'select')),
        (has_table_privilege('anon', 'public.audit_logs', 'insert')),
        (has_table_privilege('anon', 'public.audit_logs', 'update')),
        (has_table_privilege('anon', 'public.audit_logs', 'delete'))
    ) as privilege (allowed)
    where allowed
  ),
  0,
  'anonymous callers have no audit log table privileges'
);

select is(
  has_table_privilege('authenticated', 'public.audit_logs', 'select'),
  true,
  'authenticated callers receive select for RLS to narrow'
);

select is(
  has_table_privilege('authenticated', 'public.audit_logs', 'insert'),
  false,
  'authenticated callers cannot insert audit events directly'
);

select is(
  has_table_privilege('authenticated', 'public.audit_logs', 'update'),
  false,
  'authenticated callers cannot update audit events'
);

select is(
  has_table_privilege('authenticated', 'public.audit_logs', 'delete'),
  false,
  'authenticated callers cannot delete audit events'
);

select is(
  has_function_privilege('authenticated', 'public.audit_row()', 'execute'),
  false,
  'authenticated callers cannot execute the audit trigger function directly'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","aal":"aal2"}',
  true
);
set local role authenticated;

update public.profiles
set is_active = false
where id = '22222222-2222-4222-8222-222222222222';

select is(
  (
    select count(*)::integer
    from public.audit_logs
    where table_name = 'profiles'
      and record_id = '22222222-2222-4222-8222-222222222222'
  ),
  1,
  'an audited profile change creates one event'
);
select is(
  (
    select action
    from public.audit_logs
    where table_name = 'profiles'
      and record_id = '22222222-2222-4222-8222-222222222222'
  ),
  'UPDATE',
  'the event records the update action'
);
select is(
  (
    select table_name
    from public.audit_logs
    where table_name = 'profiles'
      and record_id = '22222222-2222-4222-8222-222222222222'
  ),
  'profiles',
  'the event records its source table'
);
select is(
  (
    select record_id
    from public.audit_logs
    where table_name = 'profiles'
      and record_id = '22222222-2222-4222-8222-222222222222'
  ),
  '22222222-2222-4222-8222-222222222222',
  'the event records the changed profile identifier'
);
select is(
  (
    select user_id
    from public.audit_logs
    where table_name = 'profiles'
      and record_id = '22222222-2222-4222-8222-222222222222'
  ),
  '11111111-1111-4111-8111-111111111111'::uuid,
  'the event records the authenticated administrator'
);
select is(
  (
    select before ->> 'is_active'
    from public.audit_logs
    where table_name = 'profiles'
      and record_id = '22222222-2222-4222-8222-222222222222'
  ),
  'true',
  'before stores the original activation state'
);
select is(
  (
    select after ->> 'is_active'
    from public.audit_logs
    where table_name = 'profiles'
      and record_id = '22222222-2222-4222-8222-222222222222'
  ),
  'false',
  'after stores the new activation state'
);
select is(
  (
    select concat_ws('|', before ->> 'role', after ->> 'role')
    from public.audit_logs
    where table_name = 'profiles'
      and record_id = '22222222-2222-4222-8222-222222222222'
  ),
  'teacher|teacher',
  'before and after preserve unchanged fields for review'
);

update public.profiles
set display_name = 'Not an audited field'
where id = '22222222-2222-4222-8222-222222222222';

select is(
  (
    select count(*)::integer
    from public.audit_logs
    where table_name = 'profiles'
      and record_id = '22222222-2222-4222-8222-222222222222'
  ),
  1,
  'a profile change outside role and activation does not create noise'
);

select ok(
  (
    select created_at is not null and updated_at is not null
    from public.audit_logs
    where table_name = 'profiles'
      and record_id = '22222222-2222-4222-8222-222222222222'
  ),
  'audit events carry the required timestamps'
);

select throws_ok(
  $$update public.audit_logs set action = 'TAMPERED' where id = 1$$,
  '42501',
  'permission denied for table audit_logs',
  'even an administrator cannot update an audit event'
);

select throws_ok(
  $$delete from public.audit_logs where id = 1$$,
  '42501',
  'permission denied for table audit_logs',
  'even an administrator cannot delete an audit event'
);

select throws_ok(
  $$insert into public.audit_logs (action) values ('FORGED')$$,
  '42501',
  'permission denied for table audit_logs',
  'even an administrator cannot forge an audit event'
);

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated"}',
  true
);
set local role authenticated;

select is((select public.is_admin()), false, 'a student is not treated as an administrator');
select is((select count(*)::integer from public.audit_logs), 0, 'a non-admin reads zero audit events');

select * from finish();

rollback;
