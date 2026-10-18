create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_role_text text := new.raw_app_meta_data ->> 'role';
  requested_role public.user_role;
  requested_full_name text := nullif(pg_catalog.btrim(new.raw_user_meta_data ->> 'full_name'), '');
  requested_display_name text := nullif(pg_catalog.btrim(new.raw_user_meta_data ->> 'display_name'), '');
  created_by_text text := nullif(new.raw_user_meta_data ->> 'created_by', '');
  created_by_id uuid;
begin
  if exists (select 1 from public.profiles where id = new.id) then
    return new;
  end if;

  if requested_role_text is null and new.invited_at is not null then
    requested_role_text := new.raw_user_meta_data ->> 'role';
  end if;

  -- GoTrue's admin endpoint first inserts the auth row, then applies trusted
  -- app metadata. Keep that intermediate row unable to sign in to the portal;
  -- the update trigger below provisions the profile once the role is present.
  if requested_role_text is null then
    return new;
  end if;

  if requested_role_text not in ('admin', 'teacher', 'student', 'parent') then
    raise exception using
      errcode = '22023',
      message = 'profile_role_required';
  end if;

  if requested_full_name is null then
    raise exception using
      errcode = '22023',
      message = 'profile_full_name_required';
  end if;

  if created_by_text is not null then
    begin
      created_by_id := created_by_text::uuid;
    exception when invalid_text_representation then
      raise exception using errcode = '22023', message = 'provisioning_admin_required';
    end;

    if not exists (
      select 1
      from public.profiles as actor
      where actor.id = created_by_id
        and actor.role = 'admin'::public.user_role
        and actor.is_active
    ) then
      raise exception using errcode = '42501', message = 'provisioning_admin_required';
    end if;
  end if;

  requested_role := requested_role_text::public.user_role;

  insert into public.profiles (id, role, full_name, display_name)
  values (new.id, requested_role, requested_full_name, requested_display_name);

  insert into public.profile_private (profile_id, phone, contact_email)
  values (new.id, new.phone, new.email);

  if created_by_id is not null then
    insert into public.audit_logs (user_id, action, table_name, record_id, after)
    values (
      created_by_id,
      'INSERT',
      'profiles',
      new.id::text,
      jsonb_build_object(
        'id', new.id,
        'role', requested_role,
        'full_name', requested_full_name,
        'display_name', requested_display_name,
        'is_active', true
      )
    );
  end if;

  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_provisioning_updated on auth.users;
create trigger on_auth_user_provisioning_updated
after update of raw_app_meta_data, raw_user_meta_data, invited_at on auth.users
for each row execute function public.handle_new_user();

create or replace function public.set_account_active(p_profile_id uuid, p_is_active boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select public.is_admin()) then
    raise exception using errcode = '42501', message = 'admin_required';
  end if;

  if p_profile_id = (select auth.uid()) and not p_is_active then
    raise exception using errcode = '23514', message = 'admin_cannot_disable_self';
  end if;

  update public.profiles
  set is_active = p_is_active
  where id = p_profile_id;

  if not found then
    raise exception using errcode = 'P0002', message = 'profile_not_found';
  end if;

  if not p_is_active then
    delete from auth.sessions where user_id = p_profile_id;
  end if;
end;
$$;

revoke execute on function public.set_account_active(uuid, boolean) from public, anon, service_role;
grant execute on function public.set_account_active(uuid, boolean) to authenticated;
