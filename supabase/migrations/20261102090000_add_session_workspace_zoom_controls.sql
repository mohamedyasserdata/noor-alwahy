alter table public.sessions
  add column zoom_published_at timestamptz,
  add column zoom_unpublished_at timestamptz;

update public.sessions
set zoom_published_at = coalesce(updated_at, created_at)
where zoom_override_url is not null;

create or replace function public.get_teacher_session_zoom(p_session_id uuid)
returns table (
  session_id uuid,
  join_url text,
  is_published boolean,
  published_at timestamptz,
  unpublished_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  return query
  select
    session.id,
    session.zoom_override_url,
    session.zoom_override_url is not null
      and session.zoom_published_at is not null
      and session.zoom_unpublished_at is null,
    session.zoom_published_at,
    session.zoom_unpublished_at
  from public.sessions as session
  where session.id = p_session_id
    and (
      (select public.is_admin())
      or session.teacher_id = (select private.current_teacher_id())
    );
end;
$$;

revoke execute on function public.get_teacher_session_zoom(uuid) from public, anon;
grant execute on function public.get_teacher_session_zoom(uuid) to authenticated, service_role;

create or replace function public.manage_session_zoom(
  p_session_id uuid,
  p_action text,
  p_join_url text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  session_row public.sessions;
begin
  select * into session_row
  from public.sessions as session
  where session.id = p_session_id
  for update;

  if session_row.id is null then
    raise exception using errcode = 'P0002', message = 'session_not_found';
  end if;
  if not (select public.is_admin())
    and session_row.teacher_id is distinct from (select private.current_teacher_id()) then
    raise exception using errcode = '42501', message = 'session_forbidden';
  end if;

  if p_action = 'publish' then
    if session_row.status <> 'scheduled' or session_row.ended_at is not null then
      raise exception using errcode = 'P0001', message = 'session_not_publishable';
    end if;
    if p_join_url is null
      or char_length(p_join_url) not between 12 and 2048
      or p_join_url !~* '^https://(([a-z0-9-]+\.)*zoom\.us|zoom\.com|([a-z0-9-]+\.)*zoomgov\.com)(/|$)' then
      raise exception using errcode = '22023', message = 'invalid_zoom_url';
    end if;

    update public.sessions
    set
      zoom_override_url = p_join_url,
      zoom_published_at = pg_catalog.clock_timestamp(),
      zoom_unpublished_at = null
    where id = p_session_id;
  elsif p_action = 'unpublish' then
    update public.sessions
    set zoom_unpublished_at = pg_catalog.clock_timestamp()
    where id = p_session_id;
  else
    raise exception using errcode = '22023', message = 'invalid_zoom_action';
  end if;
end;
$$;

revoke execute on function public.manage_session_zoom(uuid, text, text) from public, anon;
grant execute on function public.manage_session_zoom(uuid, text, text) to authenticated, service_role;

create or replace function public.update_teacher_session_state(p_session_id uuid, p_action text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  session_row public.sessions;
begin
  select * into session_row
  from public.sessions as session
  where session.id = p_session_id
  for update;

  if session_row.id is null then
    raise exception using errcode = 'P0002', message = 'session_not_found';
  end if;
  if session_row.teacher_id is distinct from (select private.current_teacher_id()) then
    raise exception using errcode = '42501', message = 'session_forbidden';
  end if;

  if p_action = 'start' then
    if session_row.status <> 'scheduled' or session_row.ended_at is not null then
      raise exception using errcode = 'P0001', message = 'session_not_startable';
    end if;
    if pg_catalog.statement_timestamp() < session_row.scheduled_at - interval '30 minutes' then
      raise exception using errcode = 'P0001', message = 'session_too_early';
    end if;
    update public.sessions
    set started_at = coalesce(started_at, pg_catalog.clock_timestamp())
    where id = p_session_id;
  elsif p_action = 'end' then
    if session_row.status <> 'scheduled' or session_row.ended_at is not null then
      raise exception using errcode = 'P0001', message = 'session_not_endable';
    end if;
    if pg_catalog.statement_timestamp() < session_row.scheduled_at - interval '30 minutes' then
      raise exception using errcode = 'P0001', message = 'session_too_early';
    end if;
    update public.sessions
    set
      status = 'held',
      started_at = coalesce(started_at, pg_catalog.clock_timestamp()),
      ended_at = pg_catalog.clock_timestamp(),
      zoom_unpublished_at = case
        when zoom_override_url is null then zoom_unpublished_at
        else pg_catalog.clock_timestamp()
      end
    where id = p_session_id;
  else
    raise exception using errcode = '22023', message = 'invalid_session_action';
  end if;
end;
$$;

revoke execute on function public.update_teacher_session_state(uuid, text) from public, anon;
grant execute on function public.update_teacher_session_state(uuid, text) to authenticated, service_role;

create or replace function public.get_session_join(p_session_id uuid)
returns table (
  session_id uuid,
  join_url text,
  meeting_id text,
  passcode text,
  scheduled_at timestamptz,
  ends_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  released_session_id uuid;
  released_join_url text;
  released_meeting_id text;
  released_passcode text;
  released_scheduled_at timestamptz;
  released_ends_at timestamptz;
  released_status public.session_status;
begin
  select
    session.id,
    session.zoom_override_url,
    session.zoom_meeting_id,
    session.zoom_passcode,
    session.scheduled_at,
    session.ends_at,
    session.status
  into
    released_session_id,
    released_join_url,
    released_meeting_id,
    released_passcode,
    released_scheduled_at,
    released_ends_at,
    released_status
  from public.sessions as session
  where session.id = p_session_id
    and session.status in ('scheduled', 'held')
    and session.zoom_override_url is not null
    and session.zoom_published_at is not null
    and session.zoom_unpublished_at is null
    and statement_timestamp() >= session.scheduled_at - interval '10 minutes'
    and statement_timestamp() <= session.ends_at + interval '15 minutes'
    and (
      (select public.is_admin())
      or session.teacher_id = (select private.current_teacher_id())
      or exists (
        select 1
        from public.students as student
        join public.profiles as profile on profile.id = student.profile_id
        where student.id = session.student_id
          and student.profile_id = (select auth.uid())
          and profile.is_active
      )
      or (select private.guards_student(session.student_id))
    );

  if released_session_id is null then
    return;
  end if;

  insert into public.audit_logs (user_id, action, table_name, record_id, before, after, ip)
  values (
    (select auth.uid()),
    'SESSION_JOIN_RELEASE',
    'sessions',
    released_session_id::text,
    null,
    jsonb_build_object('released_to', (select auth.uid()), 'session_status', released_status),
    inet_client_addr()
  );

  return query
  select released_session_id, released_join_url, released_meeting_id, released_passcode,
    released_scheduled_at, released_ends_at;
end;
$$;

revoke execute on function public.get_session_join(uuid) from public, anon;
grant execute on function public.get_session_join(uuid) to authenticated;
