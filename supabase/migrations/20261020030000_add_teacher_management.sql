create or replace function public.enforce_teacher_activation()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if new.status = 'active'
    and (new.identity_verified_at is null or new.code_of_conduct_accepted_at is null) then
    raise exception using errcode = '23514', message = 'teacher_activation_requirements';
  end if;
  return new;
end;
$$;

revoke execute on function public.enforce_teacher_activation() from public, anon, authenticated, service_role;

create trigger teachers_enforce_activation
before insert or update of status, identity_verified_at, code_of_conduct_accepted_at
on public.teachers for each row execute function public.enforce_teacher_activation();

create trigger teachers_audit
after insert or update on public.teachers
for each row execute function public.audit_row();

create trigger teacher_tracks_audit
after insert or update or delete on public.teacher_tracks
for each row execute function public.audit_row();

create trigger teacher_availability_audit
after insert or update or delete on public.teacher_availability
for each row execute function public.audit_row();

create or replace function public.upsert_teacher(p_payload jsonb)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  managed_teacher_id uuid := nullif(p_payload ->> 'teacher_id', '')::uuid;
  requested_profile_id uuid := nullif(p_payload ->> 'profile_id', '')::uuid;
  requested_status text := p_payload ->> 'status';
  requested_tracks jsonb := coalesce(p_payload -> 'track_ids', '[]'::jsonb);
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'admin_access_required';
  end if;
  if jsonb_typeof(p_payload) <> 'object' or jsonb_typeof(requested_tracks) <> 'array' then
    raise exception using errcode = '22023', message = 'invalid_teacher_payload';
  end if;
  if not exists (
    select 1 from public.profiles
    where id = requested_profile_id and role = 'teacher' and is_active
  ) then
    raise exception using errcode = '23514', message = 'active_teacher_profile_required';
  end if;

  if managed_teacher_id is null then
    insert into public.teachers (
      profile_id, gender, specialization, ijazah_info, max_students, status, identity_verified_at
    ) values (
      requested_profile_id,
      (p_payload ->> 'gender')::public.gender_t,
      nullif(btrim(coalesce(p_payload ->> 'specialization', '')), ''),
      coalesce(p_payload -> 'ijazah_info', '[]'::jsonb),
      (p_payload ->> 'max_students')::integer,
      requested_status,
      case when coalesce((p_payload ->> 'identity_verified')::boolean, false) then now() end
    ) returning id into managed_teacher_id;
  else
    update public.teachers
    set profile_id = requested_profile_id,
        gender = (p_payload ->> 'gender')::public.gender_t,
        specialization = nullif(btrim(coalesce(p_payload ->> 'specialization', '')), ''),
        ijazah_info = coalesce(p_payload -> 'ijazah_info', '[]'::jsonb),
        max_students = (p_payload ->> 'max_students')::integer,
        status = requested_status,
        identity_verified_at = case
          when coalesce((p_payload ->> 'identity_verified')::boolean, false)
            then coalesce(identity_verified_at, now())
          else null
        end
    where id = managed_teacher_id
    returning id into managed_teacher_id;
    if managed_teacher_id is null then
      raise exception using errcode = 'P0001', message = 'teacher_not_found';
    end if;
  end if;

  delete from public.teacher_tracks where teacher_id = managed_teacher_id;
  insert into public.teacher_tracks (teacher_id, track_id)
  select managed_teacher_id, value::uuid
  from jsonb_array_elements_text(requested_tracks)
  on conflict do nothing;

  return managed_teacher_id;
end;
$$;

create or replace function public.accept_teacher_code_of_conduct()
returns timestamptz language plpgsql security definer set search_path = ''
as $$
declare
  accepted_at timestamptz;
begin
  update public.teachers
  set code_of_conduct_accepted_at = coalesce(code_of_conduct_accepted_at, now())
  where id = (select private.current_teacher_id())
  returning code_of_conduct_accepted_at into accepted_at;
  if accepted_at is null then
    raise exception using errcode = '42501', message = 'teacher_access_required';
  end if;
  return accepted_at;
end;
$$;

revoke execute on function public.upsert_teacher(jsonb) from public, anon;
revoke execute on function public.accept_teacher_code_of_conduct() from public, anon;
grant execute on function public.upsert_teacher(jsonb) to authenticated;
grant execute on function public.accept_teacher_code_of_conduct() to authenticated;
