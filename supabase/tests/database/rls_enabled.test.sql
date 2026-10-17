begin;

select plan(2);

select is(
  (
    select count(*)::integer
    from pg_catalog.pg_class as relation
    join pg_catalog.pg_namespace as namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relkind in ('r', 'p')
      and not relation.relrowsecurity
  ),
  0,
  'every public table has row level security enabled'
);

-- This probe exists only inside the rolled-back test transaction. It proves
-- that the guard query detects an unprotected table instead of passing vacuously.
create table public.__rls_guard_probe (id bigint primary key);

select is(
  (
    select count(*)::integer
    from pg_catalog.pg_class as relation
    join pg_catalog.pg_namespace as namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relname = '__rls_guard_probe'
      and relation.relkind in ('r', 'p')
      and not relation.relrowsecurity
  ),
  1,
  'the RLS guard detects a public table without row level security'
);

select * from finish();

rollback;
