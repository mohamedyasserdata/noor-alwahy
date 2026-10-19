create trigger guardians_audit
after insert or update or delete on public.guardians
for each row execute function public.audit_row();

create trigger student_guardians_audit
after insert or update or delete on public.student_guardians
for each row execute function public.audit_row();

create or replace function public.provision_person_role_record()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  person_role public.user_role;
  person_name text;
  person_gender public.gender_t;
  target_student_id uuid;
  trusted_creator_text text;
  trusted_creator_id uuid;
begin
  trusted_creator_text := case
    when new.invited_at is not null then nullif(new.raw_user_meta_data ->> 'created_by', '')
    else nullif(new.raw_app_meta_data ->> 'created_by', '')
  end;

  if trusted_creator_text is null then
    return new;
  end if;

  begin
    trusted_creator_id := trusted_creator_text::uuid;
  exception when invalid_text_representation then
    raise exception using errcode = '22023', message = 'provisioning_admin_required';
  end;

  if not exists (
    select 1 from public.profiles
    where id = trusted_creator_id and role = 'admin' and is_active
  ) then
    raise exception using errcode = '42501', message = 'provisioning_admin_required';
  end if;

  select profile.role, profile.full_name
  into person_role, person_name
  from public.profiles as profile
  where profile.id = new.id;

  if person_role is null then
    return new;
  end if;

  person_gender := coalesce(nullif(new.raw_user_meta_data ->> 'gender', '')::public.gender_t, 'male');

  if person_role = 'parent' then
    insert into public.guardians (profile_id)
    values (new.id)
    on conflict (profile_id) do nothing;
  elsif person_role = 'student' then
    target_student_id := nullif(new.raw_user_meta_data ->> 'student_id', '')::uuid;
    if target_student_id is null then
      insert into public.students (profile_id, gender, full_name)
      values (new.id, person_gender, person_name)
      on conflict (profile_id) do nothing;
    else
      update public.students
      set profile_id = new.id
      where id = target_student_id
        and (profile_id is null or profile_id = new.id);

      if not found then
        raise exception using errcode = '23505', message = 'student_account_already_linked';
      end if;
    end if;
  elsif person_role = 'teacher' then
    insert into public.teachers (profile_id, gender)
    values (new.id, person_gender)
    on conflict (profile_id) do nothing;
  end if;

  return new;
end;
$$;

revoke execute on function public.provision_person_role_record() from public, anon, authenticated, service_role;

create trigger zz_on_auth_user_person_created
after insert on auth.users
for each row execute function public.provision_person_role_record();

create trigger zz_on_auth_user_person_updated
after update of raw_app_meta_data, raw_user_meta_data, invited_at on auth.users
for each row execute function public.provision_person_role_record();

create or replace function public.upsert_student_guardian(
  p_student_id uuid,
  p_parent_profile_id uuid,
  p_relation text,
  p_is_primary boolean,
  p_is_payer boolean
)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  managed_guardian_id uuid;
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'admin_access_required';
  end if;

  if not exists (
    select 1 from public.profiles
    where id = p_parent_profile_id and role = 'parent' and is_active
  ) then
    raise exception using errcode = '23503', message = 'active_parent_profile_required';
  end if;

  if not exists (select 1 from public.students where id = p_student_id) then
    raise exception using errcode = '23503', message = 'student_not_found';
  end if;

  insert into public.guardians (profile_id)
  values (p_parent_profile_id)
  on conflict (profile_id) do update set profile_id = excluded.profile_id
  returning id into managed_guardian_id;

  if p_is_primary then
    update public.student_guardians
    set is_primary = false
    where student_id = p_student_id
      and guardian_id <> managed_guardian_id
      and is_primary;
  end if;

  insert into public.student_guardians (student_id, guardian_id, relation, is_primary, is_payer)
  values (p_student_id, managed_guardian_id, nullif(btrim(p_relation), ''), p_is_primary, p_is_payer)
  on conflict (student_id, guardian_id) do update
  set relation = excluded.relation,
      is_primary = excluded.is_primary,
      is_payer = excluded.is_payer;

  return managed_guardian_id;
end;
$$;

create or replace function public.remove_student_guardian(p_student_id uuid, p_guardian_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'admin_access_required';
  end if;

  delete from public.student_guardians
  where student_id = p_student_id and guardian_id = p_guardian_id;

  if not found then
    raise exception using errcode = 'P0002', message = 'guardian_link_not_found';
  end if;
end;
$$;

revoke execute on function public.upsert_student_guardian(uuid,uuid,text,boolean,boolean) from public, anon;
revoke execute on function public.remove_student_guardian(uuid,uuid) from public, anon;
grant execute on function public.upsert_student_guardian(uuid,uuid,text,boolean,boolean) to authenticated;
grant execute on function public.remove_student_guardian(uuid,uuid) to authenticated;
