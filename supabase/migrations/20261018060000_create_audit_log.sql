create table public.audit_logs (
  id bigserial primary key,
  user_id uuid,
  action text not null,
  table_name text,
  record_id text,
  before jsonb,
  after jsonb,
  ip inet,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index audit_logs_record_lookup_idx
on public.audit_logs (table_name, record_id, created_at desc);

create trigger audit_logs_set_updated_at
before update on public.audit_logs
for each row execute function public.set_updated_at();

create or replace function public.audit_row()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  previous_row jsonb;
  current_row jsonb;
  audited_record_id text;
begin
  if tg_op = 'INSERT' then
    current_row := to_jsonb(new);
  elsif tg_op = 'UPDATE' then
    previous_row := to_jsonb(old);
    current_row := to_jsonb(new);
  elsif tg_op = 'DELETE' then
    previous_row := to_jsonb(old);
  else
    raise exception using
      errcode = '0A000',
      message = 'audit_operation_not_supported';
  end if;

  audited_record_id := coalesce(
    current_row ->> 'id',
    previous_row ->> 'id',
    current_row ->> 'profile_id',
    previous_row ->> 'profile_id',
    current_row ->> 'key',
    previous_row ->> 'key'
  );

  insert into public.audit_logs (
    user_id,
    action,
    table_name,
    record_id,
    before,
    after,
    ip
  )
  values (
    (select auth.uid()),
    tg_op,
    tg_table_name,
    audited_record_id,
    previous_row,
    current_row,
    inet_client_addr()
  );

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

revoke execute on function public.audit_row() from public, anon, authenticated, service_role;

create trigger profiles_audit_role_or_status
after update of role, is_active on public.profiles
for each row
when (
  old.role is distinct from new.role
  or old.is_active is distinct from new.is_active
)
execute function public.audit_row();

alter table public.audit_logs enable row level security;

revoke all on table public.audit_logs from public, anon, authenticated, service_role;
revoke all on sequence public.audit_logs_id_seq from public, anon, authenticated, service_role;
grant select on table public.audit_logs to authenticated, service_role;

create policy audit_logs_admin_read
on public.audit_logs
for select
to authenticated
using ((select public.is_admin()));
