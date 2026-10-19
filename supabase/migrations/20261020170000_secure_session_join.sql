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
    coalesce(session.zoom_override_url, zoom.join_url),
    coalesce(session.zoom_meeting_id, zoom.meeting_id),
    coalesce(session.zoom_passcode, zoom.passcode),
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
  left join public.teacher_zoom_settings as zoom on zoom.teacher_id = session.teacher_id
  where session.id = p_session_id
    and session.status in ('scheduled', 'held')
    and statement_timestamp() >= session.scheduled_at - interval '10 minutes'
    and statement_timestamp() <= session.ends_at + interval '15 minutes'
    and coalesce(session.zoom_override_url, zoom.join_url) is not null
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
  select
    released_session_id,
    released_join_url,
    released_meeting_id,
    released_passcode,
    released_scheduled_at,
    released_ends_at;
end;
$$;

revoke execute on function public.get_session_join(uuid) from public, anon;
grant execute on function public.get_session_join(uuid) to authenticated;
