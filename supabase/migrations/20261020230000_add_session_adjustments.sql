alter table public.sessions
add column rescheduled_from uuid references public.sessions(id) on delete restrict;

grant select (rescheduled_from) on public.sessions to authenticated;

create unique index sessions_rescheduled_from_once_idx
on public.sessions (rescheduled_from)
where rescheduled_from is not null;

create unique index sessions_makeup_source_once_idx
on public.sessions (makeup_of)
where kind = 'makeup' and makeup_of is not null;

revoke insert, update, delete on public.sessions from authenticated;

create or replace function public.assign_session_substitute(
  p_session_id uuid,
  p_substitute_teacher_id uuid,
  p_scope text
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  anchor_session public.sessions%rowtype;
  assignment_track_id uuid;
  changed_count integer := 0;
  changed_session record;
begin
  if not (select public.is_admin()) then
    raise exception using errcode = '42501', message = 'admin_mfa_required';
  end if;

  if p_scope not in ('session', 'week') then
    raise exception using errcode = '22023', message = 'invalid_substitute_scope';
  end if;

  select session.* into anchor_session
  from public.sessions as session
  where session.id = p_session_id
  for update;

  if anchor_session.id is null or anchor_session.status <> 'scheduled' then
    raise exception using errcode = 'P0001', message = 'session_not_adjustable';
  end if;

  if anchor_session.assignment_id is null then
    raise exception using errcode = 'P0001', message = 'session_assignment_required';
  end if;

  select assignment.track_id into assignment_track_id
  from public.teacher_assignments as assignment
  where assignment.id = anchor_session.assignment_id;

  if not exists (
    select 1
    from public.teachers as teacher
    join public.teacher_tracks as teacher_track on teacher_track.teacher_id = teacher.id
    where teacher.id = p_substitute_teacher_id
      and teacher.status = 'active'
      and teacher_track.track_id = assignment_track_id
  ) then
    raise exception using errcode = 'P0001', message = 'teacher_not_eligible';
  end if;

  for changed_session in
    update public.sessions as session
    set teacher_id = p_substitute_teacher_id,
        original_teacher_id = coalesce(session.original_teacher_id, session.teacher_id)
    where session.status = 'scheduled'
      and (
        (p_scope = 'session' and session.id = anchor_session.id)
        or (
          p_scope = 'week'
          and session.assignment_id = anchor_session.assignment_id
          and session.scheduled_at >= anchor_session.scheduled_at
          and session.scheduled_at < anchor_session.scheduled_at + interval '7 days'
        )
      )
    returning session.id, session.student_id
  loop
    changed_count := changed_count + 1;
    perform private.notify_session_parties(
      changed_session.student_id,
      'schedule_changed',
      pg_catalog.jsonb_build_object(
        'session_id', changed_session.id,
        'change', 'substitute'
      )
    );
  end loop;

  if changed_count = 0 then
    raise exception using errcode = 'P0001', message = 'session_not_adjustable';
  end if;

  return changed_count;
end;
$$;

create or replace function public.create_makeup_session(
  p_entitlement_id uuid,
  p_scheduled_at timestamptz,
  p_teacher_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  entitlement public.makeup_entitlements%rowtype;
  source_session public.sessions%rowtype;
  assignment_row public.teacher_assignments%rowtype;
  selected_teacher_id uuid;
  created_session_id uuid;
  updated_count integer;
begin
  if not (select public.is_admin()) then
    raise exception using errcode = '42501', message = 'admin_mfa_required';
  end if;

  if p_scheduled_at <= statement_timestamp() then
    raise exception using errcode = '22023', message = 'session_time_must_be_future';
  end if;

  select item.* into entitlement
  from public.makeup_entitlements as item
  where item.id = p_entitlement_id
  for update;

  if entitlement.id is null
    or entitlement.used_by_session_id is not null
    or entitlement.expires_at < statement_timestamp() then
    raise exception using errcode = 'P0001', message = 'makeup_entitlement_unavailable';
  end if;

  select session.* into source_session
  from public.sessions as session
  where session.id = entitlement.source_session_id
  for update;

  if source_session.id is null
    or source_session.student_id <> entitlement.student_id
    or source_session.assignment_id is null then
    raise exception using errcode = 'P0001', message = 'makeup_source_invalid';
  end if;

  select assignment.* into assignment_row
  from public.teacher_assignments as assignment
  where assignment.id = source_session.assignment_id;

  selected_teacher_id := coalesce(
    p_teacher_id,
    source_session.original_teacher_id,
    source_session.teacher_id
  );

  if not exists (
    select 1
    from public.teachers as teacher
    join public.teacher_tracks as teacher_track on teacher_track.teacher_id = teacher.id
    where teacher.id = selected_teacher_id
      and teacher.status = 'active'
      and teacher_track.track_id = assignment_row.track_id
  ) then
    raise exception using errcode = 'P0001', message = 'teacher_not_eligible';
  end if;

  insert into public.sessions (
    assignment_id,
    student_id,
    teacher_id,
    original_teacher_id,
    kind,
    makeup_of,
    scheduled_at,
    duration_min
  )
  values (
    source_session.assignment_id,
    source_session.student_id,
    selected_teacher_id,
    case
      when selected_teacher_id <> assignment_row.teacher_id then assignment_row.teacher_id
      else null
    end,
    'makeup',
    source_session.id,
    p_scheduled_at,
    source_session.duration_min
  )
  returning id into created_session_id;

  update public.makeup_entitlements
  set used_by_session_id = created_session_id
  where id = entitlement.id and used_by_session_id is null;
  get diagnostics updated_count = row_count;

  if updated_count <> 1 then
    raise exception using errcode = 'P0001', message = 'makeup_entitlement_unavailable';
  end if;

  perform private.notify_session_parties(
    source_session.student_id,
    'schedule_changed',
    pg_catalog.jsonb_build_object(
      'session_id', created_session_id,
      'source_session_id', source_session.id,
      'change', 'makeup'
    )
  );

  return created_session_id;
end;
$$;

create or replace function public.reschedule_session(
  p_session_id uuid,
  p_scheduled_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  source_session public.sessions%rowtype;
  replacement_id uuid;
begin
  if not (select public.is_admin()) then
    raise exception using errcode = '42501', message = 'admin_mfa_required';
  end if;

  if p_scheduled_at <= statement_timestamp() then
    raise exception using errcode = '22023', message = 'session_time_must_be_future';
  end if;

  select session.* into source_session
  from public.sessions as session
  where session.id = p_session_id
  for update;

  if source_session.id is null
    or source_session.status <> 'scheduled'
    or source_session.scheduled_at = p_scheduled_at then
    raise exception using errcode = 'P0001', message = 'session_not_adjustable';
  end if;

  update public.sessions
  set status = 'rescheduled'
  where id = source_session.id;

  insert into public.sessions (
    assignment_id,
    student_id,
    teacher_id,
    original_teacher_id,
    kind,
    makeup_of,
    rescheduled_from,
    scheduled_at,
    duration_min,
    zoom_override_url,
    zoom_meeting_id,
    zoom_passcode
  )
  values (
    source_session.assignment_id,
    source_session.student_id,
    source_session.teacher_id,
    source_session.original_teacher_id,
    source_session.kind,
    source_session.makeup_of,
    source_session.id,
    p_scheduled_at,
    source_session.duration_min,
    source_session.zoom_override_url,
    source_session.zoom_meeting_id,
    source_session.zoom_passcode
  )
  returning id into replacement_id;

  update public.makeup_entitlements
  set used_by_session_id = replacement_id
  where used_by_session_id = source_session.id;

  perform private.notify_session_parties(
    source_session.student_id,
    'schedule_changed',
    pg_catalog.jsonb_build_object(
      'session_id', replacement_id,
      'source_session_id', source_session.id,
      'change', 'rescheduled'
    )
  );

  return replacement_id;
end;
$$;

revoke execute on function public.assign_session_substitute(uuid, uuid, text) from public, anon, service_role;
revoke execute on function public.create_makeup_session(uuid, timestamptz, uuid) from public, anon, service_role;
revoke execute on function public.reschedule_session(uuid, timestamptz) from public, anon, service_role;

grant execute on function public.assign_session_substitute(uuid, uuid, text) to authenticated;
grant execute on function public.create_makeup_session(uuid, timestamptz, uuid) to authenticated;
grant execute on function public.reschedule_session(uuid, timestamptz) to authenticated;
