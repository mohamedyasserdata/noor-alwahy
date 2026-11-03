alter table public.intervention_cases
  add column assigned_to uuid references public.profiles(id) on delete restrict,
  add column due_at timestamptz;

create index intervention_cases_owner_due_idx
on public.intervention_cases (assigned_to, due_at, priority desc)
where status in ('open', 'acknowledged');

create table public.admin_saved_views (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  page_key text not null check (page_key ~ '^[a-z][a-z0-9_-]{2,63}$'),
  name text not null check (char_length(btrim(name)) between 2 and 80),
  query_params jsonb not null default '{}'::jsonb check (jsonb_typeof(query_params) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profile_id, page_key, name)
);

create index admin_saved_views_profile_page_idx
on public.admin_saved_views (profile_id, page_key, updated_at desc);

create trigger admin_saved_views_set_updated_at
before update on public.admin_saved_views
for each row execute function public.set_updated_at();

create trigger admin_saved_views_audit
after insert or update or delete on public.admin_saved_views
for each row execute function public.audit_row();

alter table public.admin_saved_views enable row level security;
revoke all on public.admin_saved_views from public, anon, authenticated;
grant select, insert, update, delete on public.admin_saved_views to authenticated;
grant select, insert, update, delete on public.admin_saved_views to service_role;

create policy admin_saved_views_read_own
on public.admin_saved_views for select to authenticated
using ((select public.is_admin()) and profile_id = (select auth.uid()));

create policy admin_saved_views_insert_own
on public.admin_saved_views for insert to authenticated
with check ((select public.is_admin()) and profile_id = (select auth.uid()));

create policy admin_saved_views_update_own
on public.admin_saved_views for update to authenticated
using ((select public.is_admin()) and profile_id = (select auth.uid()))
with check ((select public.is_admin()) and profile_id = (select auth.uid()));

create policy admin_saved_views_delete_own
on public.admin_saved_views for delete to authenticated
using ((select public.is_admin()) and profile_id = (select auth.uid()));

create or replace function public.assign_intervention_case(
  p_case uuid,
  p_assignee uuid,
  p_due_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or not (select public.is_admin()) then
    raise exception using errcode = '42501', message = 'admin_mfa_required';
  end if;
  if p_case is null or p_assignee is null or p_due_at is null or p_due_at <= now() then
    raise exception using errcode = '22023', message = 'intervention_assignment_invalid';
  end if;
  if not exists (
    select 1 from public.profiles
    where id = p_assignee and role = 'admin' and is_active
  ) then
    raise exception using errcode = '22023', message = 'intervention_assignee_invalid';
  end if;
  update public.intervention_cases
  set assigned_to = p_assignee, due_at = p_due_at
  where id = p_case and status in ('open', 'acknowledged');
  if not found then
    raise exception using errcode = 'P0002', message = 'intervention_case_not_assignable';
  end if;
end;
$$;

revoke all on function public.assign_intervention_case(uuid, uuid, timestamptz)
from public, anon, authenticated, service_role;
grant execute on function public.assign_intervention_case(uuid, uuid, timestamptz)
to authenticated;

comment on column public.intervention_cases.assigned_to is
'Active administrator responsible for the intervention follow-up.';
comment on column public.intervention_cases.due_at is
'Operational follow-up deadline; it does not alter intervention detection or escalation rules.';
comment on table public.admin_saved_views is
'Per-administrator URL filter presets for existing admin pages.';
