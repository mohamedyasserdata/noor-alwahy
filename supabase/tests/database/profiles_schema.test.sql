begin;

select plan(14);

select is(
  (
    select count(*)::integer
    from pg_catalog.pg_extension
    where extname in ('btree_gist', 'pgcrypto', 'pg_trgm')
  ),
  3,
  'identity foundation installs the required PostgreSQL extensions'
);

select is(
  (
    select count(*)::integer
    from pg_catalog.pg_type as type
    join pg_catalog.pg_namespace as namespace on namespace.oid = type.typnamespace
    where namespace.nspname = 'public'
      and type.typtype = 'e'
      and type.typname in (
        'user_role',
        'gender_t',
        'student_status',
        'assignment_status',
        'session_status',
        'session_kind',
        'attendance_status',
        'session_type_t',
        'subscription_status',
        'invoice_status',
        'payment_status',
        'payment_kind',
        'payout_status',
        'progress_status',
        'application_status',
        'billing_period',
        'report_status'
      )
  ),
  17,
  'all specified domain enums exist in the public schema'
);

select is(
  (
    select array_agg(enum_value.enumlabel::text order by enum_value.enumsortorder)
    from pg_catalog.pg_enum as enum_value
    join pg_catalog.pg_type as type on type.oid = enum_value.enumtypid
    join pg_catalog.pg_namespace as namespace on namespace.oid = type.typnamespace
    where namespace.nspname = 'public'
      and type.typname = 'user_role'
  ),
  array['admin', 'teacher', 'student', 'parent'],
  'user_role contains only the four specified roles in canonical order'
);

select ok(to_regclass('public.profiles') is not null, 'profiles table exists');
select ok(to_regclass('public.profile_private') is not null, 'profile_private table exists');

select is(
  (
    select count(*)::integer
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name in (
        'id',
        'role',
        'full_name',
        'display_name',
        'avatar_url',
        'country_code',
        'timezone',
        'preferred_locale',
        'is_active',
        'created_at',
        'updated_at'
      )
  ),
  11,
  'profiles contains every specified identity column'
);

select is(
  (
    select count(*)::integer
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profile_private'
      and column_name in (
        'profile_id',
        'phone',
        'contact_email',
        'address',
        'created_at',
        'updated_at'
      )
  ),
  6,
  'profile_private contains private contact data and required timestamps'
);

select is(
  (
    select count(*)::integer
    from pg_catalog.pg_class as relation
    join pg_catalog.pg_namespace as namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relname in ('profiles', 'profile_private')
      and relation.relrowsecurity
  ),
  2,
  'RLS is enabled on both identity tables'
);

select ok(
  to_regprocedure('public.auth_role()') is not null,
  'auth_role helper exists'
);

select ok(
  to_regprocedure('public.is_admin()') is not null,
  'is_admin helper exists'
);

select ok(
  to_regprocedure('public.set_updated_at()') is not null,
  'set_updated_at trigger function exists'
);

select ok(
  to_regprocedure('public.handle_new_user()') is not null,
  'handle_new_user trigger function exists'
);

select is(
  (
    select count(*)::integer
    from pg_catalog.pg_trigger as trigger
    join pg_catalog.pg_class as relation on relation.oid = trigger.tgrelid
    join pg_catalog.pg_namespace as namespace on namespace.oid = relation.relnamespace
    where not trigger.tgisinternal
      and (
        (namespace.nspname = 'auth' and relation.relname = 'users' and trigger.tgname = 'on_auth_user_created')
        or
        (namespace.nspname = 'public' and relation.relname = 'profiles' and trigger.tgname = 'profiles_set_updated_at')
        or
        (namespace.nspname = 'public' and relation.relname = 'profile_private' and trigger.tgname = 'profile_private_set_updated_at')
      )
  ),
  3,
  'user provisioning and timestamp triggers are installed'
);

select is(
  (
    select count(*)::integer
    from pg_catalog.pg_proc as function
    join pg_catalog.pg_namespace as namespace on namespace.oid = function.pronamespace
    where namespace.nspname = 'public'
      and function.proname in ('auth_role', 'is_admin', 'handle_new_user')
      and function.prosecdef
      and coalesce(array_to_string(function.proconfig, ','), '') = 'search_path=""'
  ),
  3,
  'every security-definer identity function pins an empty search_path'
);

select * from finish();

rollback;
