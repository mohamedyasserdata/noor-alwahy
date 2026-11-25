alter table public.sessions
  add column if not exists zoom_review_status text not null default 'not_submitted'
    check (zoom_review_status in ('not_submitted', 'pending', 'approved', 'rejected')),
  add column if not exists zoom_reviewed_by uuid references public.profiles(id) on delete restrict,
  add column if not exists zoom_reviewed_at timestamptz;

update public.sessions
set zoom_review_status = case
  when zoom_override_url is null then 'not_submitted'
  when zoom_published_at is not null and zoom_unpublished_at is null then 'approved'
  else 'not_submitted'
end;

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
  actor_is_admin boolean := (select public.is_admin());
begin
  select * into session_row
  from public.sessions as session
  where session.id = p_session_id
  for update;

  if session_row.id is null then
    raise exception using errcode = 'P0002', message = 'session_not_found';
  end if;

  if p_action in ('submit', 'publish') then
    if actor_is_admin or session_row.teacher_id is distinct from (select private.current_teacher_id()) then
      raise exception using errcode = '42501', message = 'session_forbidden';
    end if;
    if session_row.status <> 'scheduled' or session_row.ended_at is not null then
      raise exception using errcode = 'P0001', message = 'session_not_publishable';
    end if;
    if p_join_url is null
      or char_length(p_join_url) not between 12 and 2048
      or p_join_url !~* '^https://(([a-z0-9-]+\.)*zoom\.us|zoom\.com|([a-z0-9-]+\.)*zoomgov\.com)(/|$)' then
      raise exception using errcode = '22023', message = 'invalid_zoom_url';
    end if;

    update public.sessions
    set zoom_override_url = p_join_url,
        zoom_review_status = 'pending',
        zoom_reviewed_by = null,
        zoom_reviewed_at = null,
        zoom_published_at = null,
        zoom_unpublished_at = pg_catalog.clock_timestamp()
    where id = p_session_id;
  elsif p_action = 'approve' then
    if not actor_is_admin then
      raise exception using errcode = '42501', message = 'admin_access_required';
    end if;
    if session_row.status <> 'scheduled'
      or session_row.zoom_review_status <> 'pending'
      or session_row.zoom_override_url is null then
      raise exception using errcode = 'P0001', message = 'zoom_review_invalid';
    end if;
    update public.sessions
    set zoom_review_status = 'approved',
        zoom_reviewed_by = (select auth.uid()),
        zoom_reviewed_at = pg_catalog.clock_timestamp(),
        zoom_published_at = pg_catalog.clock_timestamp(),
        zoom_unpublished_at = null
    where id = p_session_id;
  elsif p_action = 'reject' then
    if not actor_is_admin then
      raise exception using errcode = '42501', message = 'admin_access_required';
    end if;
    if session_row.zoom_review_status <> 'pending' then
      raise exception using errcode = 'P0001', message = 'zoom_review_invalid';
    end if;
    update public.sessions
    set zoom_review_status = 'rejected',
        zoom_reviewed_by = (select auth.uid()),
        zoom_reviewed_at = pg_catalog.clock_timestamp(),
        zoom_published_at = null,
        zoom_unpublished_at = pg_catalog.clock_timestamp()
    where id = p_session_id;
  elsif p_action = 'unpublish' then
    if not actor_is_admin
      and session_row.teacher_id is distinct from (select private.current_teacher_id()) then
      raise exception using errcode = '42501', message = 'session_forbidden';
    end if;
    update public.sessions
    set zoom_review_status = 'not_submitted',
        zoom_published_at = null,
        zoom_unpublished_at = pg_catalog.clock_timestamp()
    where id = p_session_id;
  else
    raise exception using errcode = '22023', message = 'invalid_zoom_action';
  end if;
end;
$$;

revoke execute on function public.manage_session_zoom(uuid, text, text) from public, anon;
grant execute on function public.manage_session_zoom(uuid, text, text) to authenticated, service_role;
