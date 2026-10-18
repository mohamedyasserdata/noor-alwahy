begin;

select plan(5);

insert into auth.users (
  id, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  (
    'a1000000-0000-4000-8000-000000000001',
    'mfa.admin@example.test',
    '{"role":"admin"}',
    '{"full_name":"MFA Admin"}',
    now(),
    now()
  ),
  (
    'a1000000-0000-4000-8000-000000000002',
    'mfa.student@example.test',
    '{"role":"student"}',
    '{"full_name":"MFA Student"}',
    now(),
    now()
  );

select set_config(
  'request.jwt.claims',
  '{"sub":"a1000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',
  true
);
set local role authenticated;

select is((select public.is_admin()), false, 'an AAL1 administrator is not authorized as admin');
select is(
  (select count(*)::integer from public.profiles),
  1,
  'an AAL1 administrator can read only their own profile'
);

update public.profiles
set full_name = 'Blocked AAL1 update'
where id = 'a1000000-0000-4000-8000-000000000002';

reset role;
select is(
  (select full_name from public.profiles where id = 'a1000000-0000-4000-8000-000000000002'),
  'MFA Student',
  'an AAL1 administrator cannot mutate another profile'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"a1000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',
  true
);
set local role authenticated;

select is((select public.is_admin()), true, 'an AAL2 administrator is authorized as admin');
select is(
  (
    select count(*)::integer
    from public.profiles
    where id in (
      'a1000000-0000-4000-8000-000000000001',
      'a1000000-0000-4000-8000-000000000002'
    )
  ),
  2,
  'an AAL2 administrator can read managed profiles'
);

select * from finish();

rollback;
