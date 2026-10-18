drop policy if exists profiles_read_own on public.profiles;

create policy profiles_read_own
on public.profiles
for select
to authenticated
using (
  id = (select auth.uid())
  and (select public.auth_role()) is not null
);
