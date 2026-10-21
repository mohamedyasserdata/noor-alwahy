create table public.package_import_batches (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references public.profiles(id) on delete restrict,
  source_name text not null check (char_length(btrim(source_name)) between 1 and 180),
  status text not null default 'pending' check (status in ('pending', 'confirmed')),
  package_count integer not null check (package_count between 1 and 200),
  price_count integer not null check (price_count between 1 and 1000),
  payload jsonb not null check (jsonb_typeof(payload) = 'array'),
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (status = 'pending' and confirmed_at is null)
    or (status = 'confirmed' and confirmed_at is not null and payload = '[]'::jsonb)
  )
);

create index package_import_batches_owner_idx
on public.package_import_batches (created_by, created_at desc);

create trigger package_import_batches_set_updated_at
before update on public.package_import_batches
for each row execute function public.set_updated_at();

alter table public.package_import_batches enable row level security;
revoke all on public.package_import_batches from public, anon, authenticated, service_role;
grant select, insert on public.package_import_batches to authenticated;

create policy package_import_batches_admin_read
on public.package_import_batches for select to authenticated
using ((select public.is_admin()) and created_by = (select auth.uid()));

create policy package_import_batches_admin_create
on public.package_import_batches for insert to authenticated
with check ((select public.is_admin()) and created_by = (select auth.uid()));

create or replace function public.confirm_package_import(p_batch_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  managed_batch public.package_import_batches%rowtype;
  imported_package jsonb;
  imported_count integer := 0;
  counted_prices integer := 0;
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'admin_mfa_required';
  end if;

  select * into managed_batch
  from public.package_import_batches
  where id = p_batch_id
    and created_by = (select auth.uid())
    and created_at > now() - interval '1 day'
  for update;

  if managed_batch.id is null or managed_batch.status <> 'pending' then
    raise exception using errcode = 'P0002', message = 'pending_import_not_found';
  end if;
  if jsonb_array_length(managed_batch.payload) <> managed_batch.package_count then
    raise exception using errcode = '22023', message = 'invalid_import_payload';
  end if;

  for imported_package in select value from jsonb_array_elements(managed_batch.payload)
  loop
    if jsonb_typeof(imported_package -> 'prices') <> 'array'
      or jsonb_array_length(imported_package -> 'prices') = 0 then
      raise exception using errcode = '22023', message = 'invalid_import_payload';
    end if;
    counted_prices := counted_prices + jsonb_array_length(imported_package -> 'prices');
    perform public.save_package(imported_package);
    imported_count := imported_count + 1;
  end loop;

  if counted_prices <> managed_batch.price_count then
    raise exception using errcode = '22023', message = 'invalid_import_payload';
  end if;

  update public.package_import_batches
  set status = 'confirmed', payload = '[]'::jsonb, confirmed_at = now()
  where id = managed_batch.id;

  insert into public.audit_logs (user_id, action, table_name, record_id, after, ip)
  values (
    (select auth.uid()),
    'IMPORT',
    'packages',
    managed_batch.id::text,
    jsonb_build_object('package_count', imported_count, 'price_count', counted_prices),
    inet_client_addr()
  );

  return imported_count;
end;
$$;

revoke execute on function public.confirm_package_import(uuid) from public, anon;
grant execute on function public.confirm_package_import(uuid) to authenticated;
