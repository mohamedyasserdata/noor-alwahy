create or replace function public.lookup_application_status(
  p_order_no text,
  p_lookup_hash text
)
returns table(
  status public.application_status,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select application.status, application.updated_at
  from public.applications as application
  where application.order_no = p_order_no
    and application.lookup_hash = p_lookup_hash
  limit 1
$$;

revoke execute on function public.lookup_application_status(text, text) from public, anon, authenticated;
grant execute on function public.lookup_application_status(text, text) to service_role;
