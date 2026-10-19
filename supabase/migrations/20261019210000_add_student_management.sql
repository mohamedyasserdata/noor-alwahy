create trigger students_audit
after insert or update on public.students
for each row execute function public.audit_row();

create or replace function public.audit_student_private_notes()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  previous_row jsonb;
  current_row jsonb;
begin
  if tg_op = 'INSERT' then
    current_row := jsonb_build_object(
      'student_id', new.student_id,
      'has_health_notes', new.health_notes is not null and btrim(new.health_notes) <> '',
      'has_special_notes', new.special_notes is not null and btrim(new.special_notes) <> '',
      'share_with_teacher', new.share_with_teacher
    );
  elsif tg_op = 'UPDATE' then
    previous_row := jsonb_build_object(
      'student_id', old.student_id,
      'has_health_notes', old.health_notes is not null and btrim(old.health_notes) <> '',
      'has_special_notes', old.special_notes is not null and btrim(old.special_notes) <> '',
      'share_with_teacher', old.share_with_teacher
    );
    current_row := jsonb_build_object(
      'student_id', new.student_id,
      'has_health_notes', new.health_notes is not null and btrim(new.health_notes) <> '',
      'has_special_notes', new.special_notes is not null and btrim(new.special_notes) <> '',
      'share_with_teacher', new.share_with_teacher
    );
  else
    raise exception using errcode = '0A000', message = 'audit_operation_not_supported';
  end if;

  insert into public.audit_logs (user_id, action, table_name, record_id, before, after, ip)
  values ((select auth.uid()), tg_op, tg_table_name, new.student_id::text, previous_row, current_row, inet_client_addr());
  return new;
end;
$$;

revoke execute on function public.audit_student_private_notes() from public, anon, authenticated, service_role;

create trigger student_private_notes_audit
after insert or update on public.student_private_notes
for each row execute function public.audit_student_private_notes();

create or replace function public.upsert_student(p_payload jsonb)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  managed_student_id uuid;
  requested_student_id uuid := nullif(p_payload ->> 'student_id', '')::uuid;
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'admin_access_required';
  end if;

  if jsonb_typeof(p_payload) <> 'object' then
    raise exception using errcode = '22023', message = 'invalid_student_payload';
  end if;

  if requested_student_id is null then
    insert into public.students (
      full_name, gender, birth_date, status, level_id, joined_at, country_code, timezone
    ) values (
      p_payload ->> 'full_name',
      (p_payload ->> 'gender')::public.gender_t,
      nullif(p_payload ->> 'birth_date', '')::date,
      (p_payload ->> 'status')::public.student_status,
      nullif(p_payload ->> 'level_id', '')::uuid,
      (p_payload ->> 'joined_at')::date,
      nullif(p_payload ->> 'country_code', '')::char(2),
      p_payload ->> 'timezone'
    ) returning id into managed_student_id;
  else
    update public.students
    set full_name = p_payload ->> 'full_name',
        gender = (p_payload ->> 'gender')::public.gender_t,
        birth_date = nullif(p_payload ->> 'birth_date', '')::date,
        status = (p_payload ->> 'status')::public.student_status,
        level_id = nullif(p_payload ->> 'level_id', '')::uuid,
        joined_at = (p_payload ->> 'joined_at')::date,
        country_code = nullif(p_payload ->> 'country_code', '')::char(2),
        timezone = p_payload ->> 'timezone'
    where id = requested_student_id
    returning id into managed_student_id;

    if managed_student_id is null then
      raise exception using errcode = 'P0001', message = 'student_not_found';
    end if;
  end if;

  insert into public.student_private_notes (
    student_id, health_notes, special_notes, share_with_teacher
  ) values (
    managed_student_id,
    nullif(btrim(coalesce(p_payload ->> 'health_notes', '')), ''),
    nullif(btrim(coalesce(p_payload ->> 'special_notes', '')), ''),
    coalesce((p_payload ->> 'share_with_teacher')::boolean, false)
  )
  on conflict (student_id) do update
  set health_notes = excluded.health_notes,
      special_notes = excluded.special_notes,
      share_with_teacher = excluded.share_with_teacher;

  return managed_student_id;
end;
$$;

create or replace function public.archive_student(p_student_id uuid)
returns void language plpgsql security invoker set search_path = ''
as $$
begin
  update public.students set status = 'archived' where id = p_student_id;
  if not found then
    raise exception using errcode = 'P0001', message = 'student_not_found';
  end if;
end;
$$;

create or replace function public.record_student_export(p_count integer)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'admin_access_required';
  end if;

  insert into public.audit_logs (user_id, action, table_name, record_id, after, ip)
  values (
    (select auth.uid()),
    'EXPORT',
    'students',
    null,
    jsonb_build_object('record_count', greatest(coalesce(p_count, 0), 0)),
    inet_client_addr()
  );
end;
$$;

revoke execute on function public.upsert_student(jsonb) from public, anon;
revoke execute on function public.archive_student(uuid) from public, anon;
revoke execute on function public.record_student_export(integer) from public, anon;
grant execute on function public.upsert_student(jsonb) to authenticated;
grant execute on function public.archive_student(uuid) to authenticated;
grant execute on function public.record_student_export(integer) to authenticated;
