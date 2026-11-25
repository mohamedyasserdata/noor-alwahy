do $$
declare
  constraint_name text;
begin
  select item.conname
  into constraint_name
  from pg_catalog.pg_constraint as item
  where item.conrelid = 'public.applications'::regclass
    and item.contype = 'c'
    and pg_catalog.pg_get_constraintdef(item.oid) like '%student_age%'
    and pg_catalog.pg_get_constraintdef(item.oid) like '%guardian_name%'
  limit 1;

  if constraint_name is not null then
    execute format('alter table public.applications drop constraint %I', constraint_name);
  end if;
end;
$$;
