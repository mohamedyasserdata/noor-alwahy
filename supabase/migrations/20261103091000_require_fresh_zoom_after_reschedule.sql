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
  set status = 'rescheduled',
      zoom_unpublished_at = case
        when zoom_override_url is null then zoom_unpublished_at
        else pg_catalog.clock_timestamp()
      end
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
    duration_min
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
    source_session.duration_min
  )
  returning id into replacement_id;

  insert into public.session_participants (
    session_id,
    student_id,
    assignment_id,
    is_primary,
    created_by
  )
  select
    replacement_id,
    participant.student_id,
    participant.assignment_id,
    false,
    (select auth.uid())
  from public.session_participants as participant
  where participant.session_id = source_session.id
    and not participant.is_primary
  on conflict (session_id, student_id) do nothing;

  update public.sessions
  set format = case
    when exists (
      select 1
      from public.session_participants as participant
      where participant.session_id = replacement_id
        and not participant.is_primary
    ) then 'group'
    else 'individual'
  end
  where id = replacement_id;

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

revoke execute on function public.reschedule_session(uuid, timestamptz)
from public, anon, service_role;
grant execute on function public.reschedule_session(uuid, timestamptz)
to authenticated;
