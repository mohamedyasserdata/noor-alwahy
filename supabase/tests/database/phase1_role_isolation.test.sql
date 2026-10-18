begin;

select plan(78);

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
    '81000000-0000-4000-8000-000000000001',
    'authenticated',
    'authenticated',
    'phase1.admin@example.test',
    '{"role":"admin"}',
    '{"full_name":"Phase 1 Admin"}',
    now(),
    now()
  ),
  (
    '81000000-0000-4000-8000-000000000002',
    'authenticated',
    'authenticated',
    'phase1.teacher@example.test',
    '{"role":"teacher"}',
    '{"full_name":"Phase 1 Teacher"}',
    now(),
    now()
  ),
  (
    '81000000-0000-4000-8000-000000000003',
    'authenticated',
    'authenticated',
    'phase1.student@example.test',
    '{"role":"student"}',
    '{"full_name":"Phase 1 Student"}',
    now(),
    now()
  ),
  (
    '81000000-0000-4000-8000-000000000004',
    'authenticated',
    'authenticated',
    'phase1.parent@example.test',
    '{"role":"parent"}',
    '{"full_name":"Phase 1 Parent"}',
    now(),
    now()
  ),
  (
    '81000000-0000-4000-8000-000000000005',
    'authenticated',
    'authenticated',
    'phase1.inactive@example.test',
    '{"role":"teacher"}',
    '{"full_name":"Phase 1 Inactive"}',
    now(),
    now()
  );

update public.profiles
set is_active = false
where id = '81000000-0000-4000-8000-000000000005';

insert into public.contact_links (id, type, label_ar, label_en, url, sort_order, is_visible)
values
  (
    '82000000-0000-4000-8000-000000000001',
    'email',
    'تواصل',
    'Contact',
    'mailto:phase1@example.test',
    1,
    true
  ),
  (
    '82000000-0000-4000-8000-000000000002',
    'phone',
    'داخلي',
    'Internal',
    'tel:+201000000099',
    2,
    false
  );

insert into public.app_settings (key, value)
values ('phase1.secret', '{"secret":"not public"}');

-- Exact SQL privilege surface for every Phase 1 table and operation. RLS is
-- tested below; this guard catches a future broad GRANT before a policy runs.
select is(
  (
    with expected as (
      select
        role_name,
        table_name,
        privilege,
        case
          when role_name = 'anon' and table_name = 'contact_links' and privilege = 'SELECT' then true
          when role_name = 'authenticated' and table_name in ('profiles', 'profile_private', 'contact_links') then true
          when role_name = 'authenticated' and table_name = 'audit_logs' and privilege = 'SELECT' then true
          when role_name = 'authenticated' and table_name = 'app_settings' and privilege in ('INSERT', 'UPDATE', 'DELETE') then true
          else false
        end as allowed
      from unnest(array['anon', 'authenticated']) as role_name
      cross join unnest(array['profiles', 'profile_private', 'audit_logs', 'contact_links', 'app_settings']) as table_name
      cross join unnest(array['SELECT', 'INSERT', 'UPDATE', 'DELETE']) as privilege
    )
    select count(*)::integer
    from expected
    where has_table_privilege(
      role_name,
      format('public.%I', table_name),
      privilege
    ) is distinct from allowed
  ),
  0,
  'Phase 1 table grants match the least-privilege operation matrix'
);

select is(
  (
    with expected as (
      select
        role_name,
        column_name,
        column_name in ('key', 'value') as allowed
      from unnest(array['anon', 'authenticated']) as role_name
      cross join unnest(array['key', 'value', 'updated_by', 'created_at', 'updated_at']) as column_name
    )
    select count(*)::integer
    from expected
    where has_column_privilege(
      role_name,
      'public.app_settings',
      column_name,
      'SELECT'
    ) is distinct from allowed
  ),
  0,
  'public settings expose only key and value columns'
);

-- R-20: the explicit exception list is empty in Phase 1. Add a fully qualified
-- relation or column only after documenting a non-messaging use case.
select is(
  (
    select count(*)::integer
    from pg_catalog.pg_class as relation
    join pg_catalog.pg_namespace as namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relkind in ('r', 'p', 'v', 'm', 'f')
      and relation.relname ~* '(message|chat|conversation|thread|reply)'
      and format('%I.%I', namespace.nspname, relation.relname) <> all(array[]::text[])
  ),
  0,
  'R-20: Phase 1 has no messaging relation'
);

select is(
  (
    select count(*)::integer
    from information_schema.columns as column_info
    where column_info.table_schema = 'public'
      and column_info.column_name ~* '(message|chat|conversation|thread|reply)'
      and format(
        '%I.%I.%I',
        column_info.table_schema,
        column_info.table_name,
        column_info.column_name
      ) <> all(array[]::text[])
  ),
  0,
  'R-20: Phase 1 has no messaging column'
);

-- R-22: every application SECURITY DEFINER function must pin its resolution
-- context and must not be directly callable by anonymous clients.
select is(
  (
    select count(*)::integer
    from pg_catalog.pg_proc as function
    join pg_catalog.pg_namespace as namespace on namespace.oid = function.pronamespace
    where namespace.nspname = 'public'
      and function.prosecdef
      and not ('search_path=""' = any(coalesce(function.proconfig, array[]::text[])))
  ),
  0,
  'R-22: every public SECURITY DEFINER function pins an empty search_path'
);

select is(
  (
    select count(*)::integer
    from pg_catalog.pg_proc as function
    join pg_catalog.pg_namespace as namespace on namespace.oid = function.pronamespace
    where namespace.nspname = 'public'
      and function.prosecdef
      and has_function_privilege('anon', function.oid, 'EXECUTE')
  ),
  0,
  'R-22: anonymous callers cannot execute any public SECURITY DEFINER function'
);

select is(
  (
    select count(*)::integer
    from pg_catalog.pg_proc as function
    join pg_catalog.pg_namespace as namespace on namespace.oid = function.pronamespace
    where namespace.nspname = 'public'
      and function.prosecdef
      and function.prorettype = 'pg_catalog.trigger'::regtype
      and has_function_privilege('authenticated', function.oid, 'EXECUTE')
  ),
  0,
  'R-22: authenticated callers cannot invoke SECURITY DEFINER trigger functions directly'
);

select is(
  (
    select coalesce(array_agg(function.proname order by function.proname), array[]::name[])
    from pg_catalog.pg_proc as function
    join pg_catalog.pg_namespace as namespace on namespace.oid = function.pronamespace
    where namespace.nspname = 'public'
      and function.prosecdef
      and function.prorettype <> 'pg_catalog.trigger'::regtype
      and has_function_privilege('authenticated', function.oid, 'EXECUTE')
  ),
  array['auth_role', 'get_student_private_notes', 'is_admin', 'set_account_active']::name[],
  'R-22: authenticated callers reach only the guarded SECURITY DEFINER API'
);

set local role anon;

select is(
  (
    select count(*)::integer
    from public.contact_links
    where id in (
      '82000000-0000-4000-8000-000000000001',
      '82000000-0000-4000-8000-000000000002'
    )
  ),
  1,
  'anonymous callers see only visible contact links'
);
select is((select count(*)::integer from public.app_settings), 2, 'anonymous callers see only public settings');
select is((select count(*)::integer from public.app_settings where key = 'phase1.secret'), 0, 'anonymous callers cannot see internal settings');
select throws_ok($$select count(*) from public.profiles$$, '42501', null, 'anonymous callers cannot read profiles');
select throws_ok($$select count(*) from public.profile_private$$, '42501', null, 'anonymous callers cannot read private profiles');
select throws_ok($$select count(*) from public.audit_logs$$, '42501', null, 'anonymous callers cannot read audit logs');
select throws_ok(
  $$insert into public.contact_links (type, label_ar, url) values ('email', 'ممنوع', 'mailto:blocked@example.test')$$,
  '42501',
  null,
  'anonymous callers cannot insert contact links'
);
select throws_ok(
  $$update public.app_settings set value = '{"blocked":true}' where key = 'support_hours'$$,
  '42501',
  null,
  'anonymous callers cannot update app settings'
);
select throws_ok(
  $$select public.update_public_app_settings('{}', '{}')$$,
  '42501',
  null,
  'anonymous callers cannot execute the public-settings RPC'
);

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"81000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2","app_metadata":{"role":"admin"},"user_metadata":{"role":"admin"}}',
  true
);
set local role authenticated;

select is((select public.auth_role())::text, 'teacher', 'the teacher role comes from the database, not forged JWT metadata');
select is((select public.is_admin()), false, 'an AAL2 claim cannot elevate a teacher to administrator');
select is((select count(*)::integer from public.profiles), 1, 'a teacher reads only their own profile');
select is((select count(*)::integer from public.profile_private), 1, 'a teacher reads only their own private profile');
select is((select count(*)::integer from public.audit_logs), 0, 'a teacher cannot read audit events');
select is(
  (
    select count(*)::integer
    from public.contact_links
    where id in (
      '82000000-0000-4000-8000-000000000001',
      '82000000-0000-4000-8000-000000000002'
    )
  ),
  1,
  'a teacher reads only visible contact links'
);
select is(
  concat_ws(
    '|',
    (select count(*)::integer from public.app_settings),
    (select count(*)::integer from public.app_settings where key = 'phase1.secret')
  ),
  '2|0',
  'a teacher reads public settings but not internal settings'
);

update public.profile_private
set phone = '+201111111102'
where profile_id = '81000000-0000-4000-8000-000000000002';
select is((select phone from public.profile_private), '+201111111102', 'a teacher can update their own private contact data');

select is_empty(
  $$
    update public.profile_private
    set phone = '+209999999999'
    where profile_id = '81000000-0000-4000-8000-000000000003'
    returning profile_id
  $$,
  'a teacher cannot update another user private profile'
);

select throws_ok(
  $$insert into public.profiles (id, role, full_name) values ('81000000-0000-4000-8000-000000000099', 'admin', 'Forged Admin')$$,
  '42501',
  null,
  'a teacher cannot insert a forged profile'
);
select throws_ok(
  $$insert into public.contact_links (type, label_ar, url) values ('email', 'ممنوع', 'mailto:blocked@example.test')$$,
  '42501',
  null,
  'a teacher cannot insert contact links'
);
select throws_ok(
  $$insert into public.app_settings (key, value) values ('phase1.teacher_forgery', '{"enabled":true}')$$,
  '42501',
  null,
  'a teacher cannot insert app settings'
);
select throws_ok(
  $$select public.set_account_active('81000000-0000-4000-8000-000000000003', false)$$,
  '42501',
  'admin_required',
  'a teacher cannot call the account-management RPC'
);

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"81000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2"}',
  true
);
set local role authenticated;

select is((select public.auth_role())::text, 'student', 'auth_role identifies the student');
select is((select public.is_admin()), false, 'AAL2 does not elevate a student');
select is(
  concat_ws(
    '|',
    (select count(*)::integer from public.profiles),
    (select count(*)::integer from public.profile_private)
  ),
  '1|1',
  'a student reads only their own identity rows'
);
select is((select count(*)::integer from public.audit_logs), 0, 'a student cannot read audit events');
select is(
  concat_ws(
    '|',
    (
      select count(*)::integer
      from public.contact_links
      where id in (
        '82000000-0000-4000-8000-000000000001',
        '82000000-0000-4000-8000-000000000002'
      )
    ),
    (select count(*)::integer from public.app_settings),
    (select count(*)::integer from public.app_settings where key = 'phase1.secret')
  ),
  '1|2|0',
  'a student receives only the public contact and settings rows'
);

update public.profile_private
set phone = '+201111111103'
where profile_id = '81000000-0000-4000-8000-000000000003';
select is((select phone from public.profile_private), '+201111111103', 'a student can update their own private contact data');
select is_empty(
  $$update public.profile_private set phone = '+209999999999' where profile_id = '81000000-0000-4000-8000-000000000004' returning profile_id$$,
  'a student cannot update another user private profile'
);
select is_empty(
  $$update public.profiles set full_name = 'Blocked Student Change' where id = '81000000-0000-4000-8000-000000000003' returning id$$,
  'a student cannot update their public profile'
);
select is_empty(
  $$update public.contact_links set sort_order = 99 where id = '82000000-0000-4000-8000-000000000001' returning id$$,
  'a student cannot update a visible contact link'
);
select is_empty(
  $$delete from public.app_settings where key = 'support_hours' returning key$$,
  'a student cannot delete a public setting'
);
select throws_ok(
  $$select public.set_account_active('81000000-0000-4000-8000-000000000004', false)$$,
  '42501',
  'admin_required',
  'a student cannot call the account-management RPC'
);

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"81000000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal2"}',
  true
);
set local role authenticated;

select is((select public.auth_role())::text, 'parent', 'auth_role identifies the parent');
select is((select public.is_admin()), false, 'AAL2 does not elevate a parent');
select is(
  concat_ws(
    '|',
    (select count(*)::integer from public.profiles),
    (select count(*)::integer from public.profile_private)
  ),
  '1|1',
  'a parent reads only their own identity rows'
);
select is((select count(*)::integer from public.audit_logs), 0, 'a parent cannot read audit events');
select is(
  concat_ws(
    '|',
    (
      select count(*)::integer
      from public.contact_links
      where id in (
        '82000000-0000-4000-8000-000000000001',
        '82000000-0000-4000-8000-000000000002'
      )
    ),
    (select count(*)::integer from public.app_settings),
    (select count(*)::integer from public.app_settings where key = 'phase1.secret')
  ),
  '1|2|0',
  'a parent receives only the public contact and settings rows'
);

update public.profile_private
set phone = '+201111111104'
where profile_id = '81000000-0000-4000-8000-000000000004';
select is((select phone from public.profile_private), '+201111111104', 'a parent can update their own private contact data');
select is_empty(
  $$update public.profile_private set phone = '+209999999999' where profile_id = '81000000-0000-4000-8000-000000000003' returning profile_id$$,
  'a parent cannot update another user private profile'
);
select is_empty(
  $$delete from public.contact_links where id = '82000000-0000-4000-8000-000000000001' returning id$$,
  'a parent cannot delete a visible contact link'
);
select is_empty(
  $$update public.app_settings set value = '{"blocked":true}' where key = 'support_hours' returning key$$,
  'a parent cannot update a public setting'
);
select throws_ok(
  $$select public.set_account_active('81000000-0000-4000-8000-000000000003', false)$$,
  '42501',
  'admin_required',
  'a parent cannot call the account-management RPC'
);

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"81000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',
  true
);
set local role authenticated;

select is((select public.is_admin()), false, 'an AAL1 administrator does not receive administrator authority');
select is(
  concat_ws(
    '|',
    (select count(*)::integer from public.profiles),
    (select count(*)::integer from public.profile_private)
  ),
  '1|1',
  'an AAL1 administrator reads only their own identity rows'
);
select is((select count(*)::integer from public.audit_logs), 0, 'an AAL1 administrator cannot read audit events');
select is(
  concat_ws(
    '|',
    (
      select count(*)::integer
      from public.contact_links
      where id in (
        '82000000-0000-4000-8000-000000000001',
        '82000000-0000-4000-8000-000000000002'
      )
    ),
    (select count(*)::integer from public.app_settings),
    (select count(*)::integer from public.app_settings where key = 'phase1.secret')
  ),
  '1|2|0',
  'an AAL1 administrator receives only public shared data'
);
select is_empty(
  $$update public.profiles set display_name = 'Blocked AAL1' where id = '81000000-0000-4000-8000-000000000002' returning id$$,
  'an AAL1 administrator cannot update another profile'
);
select is_empty(
  $$update public.profile_private set phone = '+209999999999' where profile_id = '81000000-0000-4000-8000-000000000002' returning profile_id$$,
  'an AAL1 administrator cannot update another private profile'
);
select is_empty(
  $$update public.contact_links set sort_order = 99 where id = '82000000-0000-4000-8000-000000000001' returning id$$,
  'an AAL1 administrator cannot update contact links'
);
select is_empty(
  $$update public.app_settings set value = '{"blocked":true}' where key = 'support_hours' returning key$$,
  'an AAL1 administrator cannot update app settings'
);
select throws_ok(
  $$insert into public.contact_links (type, label_ar, url) values ('email', 'ممنوع', 'mailto:blocked@example.test')$$,
  '42501',
  null,
  'an AAL1 administrator cannot insert contact links'
);
select throws_ok(
  $$select public.set_account_active('81000000-0000-4000-8000-000000000002', false)$$,
  '42501',
  'admin_required',
  'an AAL1 administrator cannot call the account-management RPC'
);

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"81000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',
  true
);
set local role authenticated;

select is((select public.is_admin()), true, 'an AAL2 administrator receives administrator authority');
select is(
  concat_ws(
    '|',
    (
      select count(*)::integer
      from public.profiles
      where id::text like '81000000-%'
    ),
    (
      select count(*)::integer
      from public.profile_private
      where profile_id::text like '81000000-%'
    )
  ),
  '5|5',
  'an AAL2 administrator reads every identity fixture'
);
select ok(
  (
    select count(*)
    from public.audit_logs
    where record_id in (
      '81000000-0000-4000-8000-000000000005',
      '82000000-0000-4000-8000-000000000001',
      '82000000-0000-4000-8000-000000000002',
      'phase1.secret'
    )
  ) >= 4,
  'an AAL2 administrator reads Phase 1 audit events'
);
select is(
  concat_ws(
    '|',
    (
      select count(*)::integer
      from public.contact_links
      where id in (
        '82000000-0000-4000-8000-000000000001',
        '82000000-0000-4000-8000-000000000002'
      )
    ),
    (select count(*)::integer from public.app_settings where key = 'phase1.secret')
  ),
  '2|1',
  'an AAL2 administrator reads hidden and internal shared data'
);
select results_eq(
  $$update public.profiles set display_name = 'Admin Updated Teacher' where id = '81000000-0000-4000-8000-000000000002' returning 1::integer$$,
  $$values (1::integer)$$,
  'an AAL2 administrator can update profiles'
);
select results_eq(
  $$update public.profile_private set address = 'Admin managed address' where profile_id = '81000000-0000-4000-8000-000000000002' returning 1::integer$$,
  $$values (1::integer)$$,
  'an AAL2 administrator can update private profiles'
);
select results_eq(
  $$update public.contact_links set sort_order = 10 where id = '82000000-0000-4000-8000-000000000001' returning 1::integer$$,
  $$values (1::integer)$$,
  'an AAL2 administrator can update contact links'
);
select results_eq(
  $$update public.app_settings set value = '{"secret":"rotated"}' where key = 'phase1.secret' returning 1::integer$$,
  $$values (1::integer)$$,
  'an AAL2 administrator can update app settings'
);
select lives_ok(
  $$select public.set_account_active('81000000-0000-4000-8000-000000000003', true)$$,
  'an AAL2 administrator can call the account-management RPC'
);
select throws_ok(
  $$update public.audit_logs set action = 'FORGED' where record_id = 'phase1.secret'$$,
  '42501',
  null,
  'audit events remain immutable even for an AAL2 administrator'
);

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"81000000-0000-4000-8000-000000000005","role":"authenticated","aal":"aal2"}',
  true
);
set local role authenticated;

select is((select public.auth_role())::text, null, 'auth_role returns null for an inactive account');
select is((select count(*)::integer from public.profiles), 0, 'an inactive account cannot read its profile with an old token');
select is((select count(*)::integer from public.profile_private), 0, 'an inactive account cannot read private contact data');
select is((select count(*)::integer from public.audit_logs), 0, 'an inactive account cannot read audit events');
select is_empty(
  $$update public.profiles set display_name = 'Inactive Change' where id = '81000000-0000-4000-8000-000000000005' returning id$$,
  'an inactive account cannot update its profile with an old token'
);
select is_empty(
  $$update public.profile_private set phone = '+209999999999' where profile_id = '81000000-0000-4000-8000-000000000005' returning profile_id$$,
  'an inactive account cannot update private data with an old token'
);
select throws_ok(
  $$select public.set_account_active('81000000-0000-4000-8000-000000000003', false)$$,
  '42501',
  'admin_required',
  'an inactive account cannot call the account-management RPC'
);

select * from finish();

rollback;
