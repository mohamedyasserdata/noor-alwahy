alter function public.run_financial_reconciliation() set schema private;
alter function private.run_financial_reconciliation() rename to run_financial_reconciliation_unchecked;

revoke all on function private.run_financial_reconciliation_unchecked()
from public, anon, authenticated, service_role;

create or replace function public.run_financial_reconciliation()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  jwt_role text := nullif((select auth.jwt() ->> 'role'), '');
begin
  if jwt_role = 'service_role' then
    null;
  elsif jwt_role = 'authenticated' then
    if actor is null or not public.is_admin() then
      raise exception using errcode = '42501', message = 'admin_mfa_required';
    end if;
  elsif jwt_role is not null
    or session_user not in ('postgres', 'supabase_admin') then
    raise exception using errcode = '42501', message = 'admin_mfa_required';
  end if;

  return private.run_financial_reconciliation_unchecked();
end;
$$;

revoke execute on function public.run_financial_reconciliation() from public, anon;
grant execute on function public.run_financial_reconciliation() to authenticated, service_role;

comment on function public.run_financial_reconciliation() is
'Runs AC-120/AC-130 reconciliation for an AAL2 administrator, service role, or trusted database scheduler; delegates only after authorization.';
