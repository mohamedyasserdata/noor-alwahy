create table public.calendar_feed_tokens (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger calendar_feed_tokens_set_updated_at
before update on public.calendar_feed_tokens
for each row execute function public.set_updated_at();

create or replace function public.audit_calendar_feed_token()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  previous_row jsonb;
  current_row jsonb;
begin
  if tg_op in ('UPDATE', 'DELETE') then
    previous_row := to_jsonb(old) - 'token_hash';
  end if;

  if tg_op in ('INSERT', 'UPDATE') then
    current_row := to_jsonb(new) - 'token_hash';
  end if;

  insert into public.audit_logs (user_id, action, table_name, record_id, before, after, ip)
  values (
    (select auth.uid()),
    tg_op,
    'calendar_feed_tokens',
    coalesce(current_row ->> 'user_id', previous_row ->> 'user_id'),
    previous_row,
    current_row,
    inet_client_addr()
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke execute on function public.audit_calendar_feed_token() from public, anon, authenticated, service_role;

create trigger calendar_feed_tokens_audit
after insert or update or delete on public.calendar_feed_tokens
for each row execute function public.audit_calendar_feed_token();

alter table public.calendar_feed_tokens enable row level security;
revoke all on public.calendar_feed_tokens from public, anon, authenticated;
grant select, insert, update, delete on public.calendar_feed_tokens to service_role;

create or replace function public.rotate_calendar_feed_token(p_token_hash text)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  changed_at timestamptz;
begin
  if caller_id is null or (select public.auth_role()) is null then
    raise exception using errcode = '42501', message = 'active_account_required';
  end if;

  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = '22023', message = 'invalid_calendar_token_hash';
  end if;

  insert into public.calendar_feed_tokens (user_id, token_hash, revoked_at)
  values (caller_id, p_token_hash, null)
  on conflict (user_id) do update
  set token_hash = excluded.token_hash,
      revoked_at = null
  returning updated_at into changed_at;

  return changed_at;
end;
$$;

revoke execute on function public.rotate_calendar_feed_token(text) from public, anon;
grant execute on function public.rotate_calendar_feed_token(text) to authenticated;

create or replace function public.revoke_calendar_feed_token()
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  changed_at timestamptz;
begin
  if caller_id is null or (select public.auth_role()) is null then
    raise exception using errcode = '42501', message = 'active_account_required';
  end if;

  update public.calendar_feed_tokens
  set revoked_at = statement_timestamp()
  where user_id = caller_id
    and revoked_at is null
  returning updated_at into changed_at;

  return changed_at;
end;
$$;

revoke execute on function public.revoke_calendar_feed_token() from public, anon;
grant execute on function public.revoke_calendar_feed_token() to authenticated;

create or replace function private.calendar_feed_rows_for_user(
  p_user_id uuid,
  p_from timestamptz,
  p_until timestamptz
)
returns table (
  owner_name text,
  owner_timezone text,
  owner_locale text,
  session_id uuid,
  scheduled_at timestamptz,
  ends_at timestamptz,
  status text,
  student_name text,
  teacher_name text,
  track_name_ar text,
  track_name_en text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    owner.full_name,
    owner.timezone,
    owner.preferred_locale,
    event.session_id,
    event.scheduled_at,
    event.ends_at,
    event.status,
    event.student_name,
    event.teacher_name,
    event.track_name_ar,
    event.track_name_en
  from public.profiles as owner
  left join lateral (
    select
      session.id as session_id,
      session.scheduled_at,
      session.ends_at,
      session.status::text,
      student.full_name as student_name,
      teacher_profile.full_name as teacher_name,
      track.name_ar as track_name_ar,
      track.name_en as track_name_en
    from public.sessions as session
    join public.students as student on student.id = session.student_id
    join public.teachers as teacher on teacher.id = session.teacher_id
    join public.profiles as teacher_profile on teacher_profile.id = teacher.profile_id
    left join public.teacher_assignments as assignment on assignment.id = session.assignment_id
    left join public.tracks as track on track.id = assignment.track_id
    where session.status in ('scheduled', 'held')
      and session.scheduled_at >= p_from
      and session.scheduled_at < p_until
      and (
        owner.role = 'admin'
        or student.profile_id = p_user_id
        or teacher.profile_id = p_user_id
        or exists (
          select 1
          from public.guardians as guardian
          join public.student_guardians as link on link.guardian_id = guardian.id
          where guardian.profile_id = p_user_id
            and link.student_id = student.id
        )
      )
    order by session.scheduled_at, session.id
  ) as event on true
  where owner.id = p_user_id
    and owner.is_active
$$;

revoke execute on function private.calendar_feed_rows_for_user(uuid, timestamptz, timestamptz)
from public, anon, authenticated, service_role;

create or replace function public.get_calendar_feed(p_token_hash text)
returns table (
  owner_name text,
  owner_timezone text,
  owner_locale text,
  session_id uuid,
  scheduled_at timestamptz,
  ends_at timestamptz,
  status text,
  student_name text,
  teacher_name text,
  track_name_ar text,
  track_name_en text
)
language sql
stable
security definer
set search_path = ''
as $$
  select feed.*
  from public.calendar_feed_tokens as token
  cross join lateral private.calendar_feed_rows_for_user(
    token.user_id,
    statement_timestamp() - interval '1 day',
    statement_timestamp() + interval '28 days'
  ) as feed
  where p_token_hash ~ '^[0-9a-f]{64}$'
    and token.token_hash = p_token_hash
    and token.revoked_at is null
$$;

revoke execute on function public.get_calendar_feed(text) from public;
grant execute on function public.get_calendar_feed(text) to anon, authenticated;

create or replace function public.get_my_calendar_feed()
returns table (
  owner_name text,
  owner_timezone text,
  owner_locale text,
  session_id uuid,
  scheduled_at timestamptz,
  ends_at timestamptz,
  status text,
  student_name text,
  teacher_name text,
  track_name_ar text,
  track_name_en text
)
language sql
stable
security definer
set search_path = ''
as $$
  select feed.*
  from private.calendar_feed_rows_for_user(
    (select auth.uid()),
    statement_timestamp() - interval '1 day',
    statement_timestamp() + interval '28 days'
  ) as feed
  where (select public.auth_role()) is not null
$$;

revoke execute on function public.get_my_calendar_feed() from public, anon;
grant execute on function public.get_my_calendar_feed() to authenticated;
