create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type ~ '^[a-z][a-z0-9_]{1,63}$'),
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index notifications_user_unread_idx
on public.notifications (user_id, created_at desc)
where read_at is null;

create table public.notification_prefs (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  prefs jsonb not null default '{"in_app":true,"schedule_changed":true,"zoom_link_changed":true}'::jsonb
    check (jsonb_typeof(prefs) = 'object'),
  updated_at timestamptz not null default now()
);

create trigger notification_prefs_set_updated_at
before update on public.notification_prefs
for each row execute function public.set_updated_at();

create table public.notification_outbox (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.notifications(id) on delete cascade,
  channel text not null check (channel in ('email', 'web_push', 'whatsapp', 'sms')),
  status text not null default 'pending' check (status in ('pending', 'processing', 'sent', 'failed')),
  attempts integer not null default 0 check (attempts >= 0),
  next_attempt_at timestamptz not null default now(),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index notification_outbox_pending_idx
on public.notification_outbox (next_attempt_at, created_at)
where status in ('pending', 'failed');

create trigger notification_outbox_set_updated_at
before update on public.notification_outbox
for each row execute function public.set_updated_at();

alter table public.notifications enable row level security;
alter table public.notification_prefs enable row level security;
alter table public.notification_outbox enable row level security;

revoke all on public.notifications from public, anon, authenticated;
revoke all on public.notification_prefs from public, anon, authenticated;
revoke all on public.notification_outbox from public, anon, authenticated;

grant select, insert, update (read_at) on public.notifications to authenticated;
grant select, insert, update (prefs) on public.notification_prefs to authenticated;
grant select, insert, update, delete on public.notifications to service_role;
grant select, insert, update, delete on public.notification_prefs to service_role;
grant select, insert, update, delete on public.notification_outbox to service_role;

create policy notifications_read_own on public.notifications
for select to authenticated
using (user_id = (select auth.uid()));

create policy notifications_mark_own_read on public.notifications
for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy notifications_admin_create on public.notifications
for insert to authenticated
with check ((select public.is_admin()));

create policy notification_prefs_read_own on public.notification_prefs
for select to authenticated
using (user_id = (select auth.uid()));

create policy notification_prefs_create_own on public.notification_prefs
for insert to authenticated
with check (user_id = (select auth.uid()));

create policy notification_prefs_update_own on public.notification_prefs
for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create or replace function private.enqueue_notification(
  target_user_id uuid,
  notification_type text,
  notification_payload jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  stored_prefs jsonb;
  in_app_value jsonb;
  event_value jsonb;
begin
  select preference.prefs into stored_prefs
  from public.notification_prefs as preference
  where preference.user_id = target_user_id;

  in_app_value := coalesce(stored_prefs -> 'in_app', 'true'::jsonb);
  event_value := coalesce(stored_prefs -> notification_type, 'true'::jsonb);

  if (jsonb_typeof(in_app_value) = 'boolean' and not (in_app_value::text)::boolean)
    or (jsonb_typeof(event_value) = 'boolean' and not (event_value::text)::boolean) then
    return;
  end if;

  insert into public.notifications (user_id, type, payload)
  values (target_user_id, notification_type, coalesce(notification_payload, '{}'::jsonb));
end;
$$;

create or replace function private.notify_session_parties(
  target_student_id uuid,
  notification_type text,
  notification_payload jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  recipient record;
begin
  for recipient in
    select student.profile_id as user_id
    from public.students as student
    where student.id = target_student_id
    union
    select guardian.profile_id
    from public.student_guardians as link
    join public.guardians as guardian on guardian.id = link.guardian_id
    where link.student_id = target_student_id
  loop
    perform private.enqueue_notification(
      recipient.user_id,
      notification_type,
      notification_payload
    );
  end loop;
end;
$$;

create or replace function private.notify_zoom_link_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected_session record;
begin
  if tg_op = 'UPDATE'
    and new.join_url is not distinct from old.join_url
    and new.meeting_id is not distinct from old.meeting_id
    and new.passcode is not distinct from old.passcode then
    return new;
  end if;

  for affected_session in
    select session.id, session.student_id
    from public.sessions as session
    where session.teacher_id = new.teacher_id
      and session.status in ('scheduled', 'held')
      and session.ends_at >= statement_timestamp()
  loop
    perform private.notify_session_parties(
      affected_session.student_id,
      'zoom_link_changed',
      jsonb_build_object('session_id', affected_session.id)
    );
  end loop;

  return new;
end;
$$;

create trigger teacher_zoom_settings_notify_change
after insert or update of join_url, meeting_id, passcode on public.teacher_zoom_settings
for each row execute function private.notify_zoom_link_change();

create or replace function private.notify_session_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.scheduled_at is distinct from old.scheduled_at
    or new.duration_min is distinct from old.duration_min then
    perform private.notify_session_parties(
      new.student_id,
      'schedule_changed',
      jsonb_build_object(
        'session_id', new.id,
        'scheduled_at', new.scheduled_at,
        'ends_at', new.ends_at
      )
    );
  end if;

  if new.zoom_override_url is distinct from old.zoom_override_url
    or new.zoom_meeting_id is distinct from old.zoom_meeting_id
    or new.zoom_passcode is distinct from old.zoom_passcode then
    perform private.notify_session_parties(
      new.student_id,
      'zoom_link_changed',
      jsonb_build_object('session_id', new.id)
    );
  end if;

  return new;
end;
$$;

create trigger sessions_notify_change
after update of scheduled_at, duration_min, zoom_override_url, zoom_meeting_id, zoom_passcode
on public.sessions
for each row execute function private.notify_session_change();

revoke execute on function private.enqueue_notification(uuid, text, jsonb) from public, anon, authenticated, service_role;
revoke execute on function private.notify_session_parties(uuid, text, jsonb) from public, anon, authenticated, service_role;
revoke execute on function private.notify_zoom_link_change() from public, anon, authenticated, service_role;
revoke execute on function private.notify_session_change() from public, anon, authenticated, service_role;

do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'sessions'
  ) then
    alter publication supabase_realtime add table public.sessions;
  end if;
end;
$$;
