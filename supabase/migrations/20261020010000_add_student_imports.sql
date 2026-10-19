create table public.student_import_batches (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references public.profiles(id) on delete restrict,
  source_name text not null check (char_length(btrim(source_name)) between 1 and 180),
  status text not null default 'pending' check (status in ('pending', 'confirmed')),
  row_count integer not null check (row_count between 1 and 200),
  payload jsonb not null check (jsonb_typeof(payload) = 'array'),
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (status = 'pending' and confirmed_at is null)
    or (status = 'confirmed' and confirmed_at is not null and payload = '[]'::jsonb)
  )
);

create index student_import_batches_owner_idx
on public.student_import_batches (created_by, created_at desc);

create trigger student_import_batches_set_updated_at
before update on public.student_import_batches
for each row execute function public.set_updated_at();

alter table public.student_import_batches enable row level security;
revoke all on public.student_import_batches from public, anon, authenticated, service_role;
grant select, insert on public.student_import_batches to authenticated;

create policy student_import_batches_admin_read
on public.student_import_batches for select to authenticated
using ((select public.is_admin()));

create policy student_import_batches_admin_create
on public.student_import_batches for insert to authenticated
with check ((select public.is_admin()) and created_by = (select auth.uid()));

create or replace function public.confirm_student_import(p_batch_id uuid)
returns integer language plpgsql security definer set search_path = ''
as $$
declare
  managed_batch public.student_import_batches%rowtype;
  imported_student jsonb;
  imported_count integer := 0;
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'admin_access_required';
  end if;

  select * into managed_batch
  from public.student_import_batches
  where id = p_batch_id
    and created_by = (select auth.uid())
    and created_at > now() - interval '1 day'
  for update;

  if managed_batch.id is null or managed_batch.status <> 'pending' then
    raise exception using errcode = 'P0002', message = 'pending_import_not_found';
  end if;

  if jsonb_array_length(managed_batch.payload) <> managed_batch.row_count then
    raise exception using errcode = '22023', message = 'invalid_import_payload';
  end if;

  for imported_student in select value from jsonb_array_elements(managed_batch.payload)
  loop
    if exists (
      select 1 from public.students
      where lower(btrim(full_name)) = lower(btrim(imported_student ->> 'full_name'))
        and birth_date is not distinct from nullif(imported_student ->> 'birth_date', '')::date
    ) then
      raise exception using errcode = '23505', message = 'duplicate_student';
    end if;

    perform public.upsert_student(imported_student);
    imported_count := imported_count + 1;
  end loop;

  update public.student_import_batches
  set status = 'confirmed', payload = '[]'::jsonb, confirmed_at = now()
  where id = managed_batch.id;

  insert into public.audit_logs (user_id, action, table_name, record_id, after, ip)
  values (
    (select auth.uid()),
    'IMPORT',
    'students',
    managed_batch.id::text,
    jsonb_build_object('record_count', imported_count),
    inet_client_addr()
  );

  return imported_count;
end;
$$;

revoke execute on function public.confirm_student_import(uuid) from public, anon;
grant execute on function public.confirm_student_import(uuid) to authenticated;
