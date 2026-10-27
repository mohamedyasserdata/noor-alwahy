create or replace function public.finalize_teacher_application_invite(
  p_application_id uuid,
  p_profile_id uuid
)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  managed_application public.teacher_applications%rowtype;
  managed_teacher_id uuid;
begin
  if not (select public.is_admin()) then
    raise exception using errcode = '42501', message = 'admin_mfa_required';
  end if;

  select * into managed_application
  from public.teacher_applications
  where id = p_application_id
  for update;

  if managed_application.id is null then
    raise exception using errcode = 'P0002', message = 'teacher_application_not_found';
  end if;
  if managed_application.invited_user_id is not null then
    raise exception using errcode = '23505', message = 'teacher_application_already_invited';
  end if;
  if managed_application.status <> 'accepted' then
    raise exception using errcode = 'P0001', message = 'teacher_application_not_accepted';
  end if;
  if not exists (
    select 1 from public.profiles
    where id = p_profile_id and role = 'teacher'::public.user_role and is_active
  ) then
    raise exception using errcode = '23503', message = 'teacher_profile_required';
  end if;

  insert into public.teachers (profile_id, gender, specialization, status)
  values (p_profile_id, managed_application.gender, managed_application.specialization, 'pending')
  on conflict (profile_id) do update
  set gender = excluded.gender,
      specialization = excluded.specialization,
      status = 'pending'
  returning id into managed_teacher_id;

  update public.teacher_applications
  set status = 'invited',
    invited_user_id = p_profile_id,
    reviewed_by = coalesce(reviewed_by, (select auth.uid())),
    reviewed_at = coalesce(reviewed_at, now())
  where id = p_application_id;

  return managed_teacher_id;
end;
$$;

revoke execute on function public.finalize_teacher_application_invite(uuid,uuid)
from public, anon, service_role;
grant execute on function public.finalize_teacher_application_invite(uuid,uuid)
to authenticated;
