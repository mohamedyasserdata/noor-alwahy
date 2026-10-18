begin;

select plan(8);

select ok(to_regclass('public.audit_logs') is not null, 'audit_logs table exists');

select is(
  (
    select count(*)::integer
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'audit_logs'
      and column_name in (
        'id',
        'user_id',
        'action',
        'table_name',
        'record_id',
        'before',
        'after',
        'ip',
        'created_at',
        'updated_at'
      )
  ),
  10,
  'audit_logs contains the specified immutable event fields and timestamps'
);

select is(
  (
    select count(*)::integer
    from pg_catalog.pg_class as relation
    join pg_catalog.pg_namespace as namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relname = 'audit_logs'
      and relation.relrowsecurity
  ),
  1,
  'RLS is enabled on audit_logs'
);

select ok(to_regprocedure('public.audit_row()') is not null, 'audit_row trigger function exists');

select is(
  (
    select count(*)::integer
    from pg_catalog.pg_proc as function
    join pg_catalog.pg_namespace as namespace on namespace.oid = function.pronamespace
    where namespace.nspname = 'public'
      and function.proname = 'audit_row'
      and function.prosecdef
      and coalesce(array_to_string(function.proconfig, ','), '') = 'search_path=""'
  ),
  1,
  'audit_row is security definer with an empty search_path'
);

select is(
  (
    select count(*)::integer
    from pg_catalog.pg_trigger as trigger
    join pg_catalog.pg_class as relation on relation.oid = trigger.tgrelid
    join pg_catalog.pg_namespace as namespace on namespace.oid = relation.relnamespace
    where not trigger.tgisinternal
      and namespace.nspname = 'public'
      and relation.relname = 'profiles'
      and trigger.tgname = 'profiles_audit_role_or_status'
  ),
  1,
  'profiles role and activation changes are connected to audit_row'
);

select is(
  (
    select count(*)::integer
    from pg_catalog.pg_indexes
    where schemaname = 'public'
      and tablename = 'audit_logs'
      and indexdef like '%(table_name, record_id, created_at DESC)%'
  ),
  1,
  'audit_logs has the specified lookup index'
);

select is(
  (
    select count(*)::integer
    from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename = 'audit_logs'
      and policyname = 'audit_logs_admin_read'
      and cmd = 'SELECT'
  ),
  1,
  'audit_logs exposes only the administrator read policy'
);

select * from finish();

rollback;
