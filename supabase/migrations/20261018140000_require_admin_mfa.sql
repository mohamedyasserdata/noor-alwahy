create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select public.auth_role()) = 'admin'::public.user_role
      and (select auth.jwt() ->> 'aal') = 'aal2',
    false
  )
$$;

revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated, service_role;
