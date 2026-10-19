create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid references public.teacher_assignments(id) on delete restrict,
  student_id uuid not null references public.students(id) on delete restrict,
  teacher_id uuid not null references public.teachers(id) on delete restrict,
  original_teacher_id uuid references public.teachers(id) on delete restrict,
  slot_id uuid references public.schedule_slots(id) on delete set null,
  kind public.session_kind not null default 'regular',
  makeup_of uuid references public.sessions(id) on delete restrict,
  scheduled_at timestamptz not null,
  duration_min integer not null check (duration_min between 10 and 120),
  ends_at timestamptz not null,
  status public.session_status not null default 'scheduled',
  zoom_override_url text check (
    zoom_override_url is null
    or (
      char_length(zoom_override_url) between 12 and 2048
      and zoom_override_url ~* '^https://(([a-z0-9-]+\.)*zoom\.us|zoom\.com|([a-z0-9-]+\.)*zoomgov\.com)(/|$)'
    )
  ),
  zoom_meeting_id text check (
    zoom_meeting_id is null or char_length(btrim(zoom_meeting_id)) between 1 and 100
  ),
  zoom_passcode text check (
    zoom_passcode is null or char_length(zoom_passcode) between 1 and 100
  ),
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ended_at is null or started_at is null or ended_at >= started_at)
);

create unique index sessions_slot_scheduled_idx
on public.sessions (slot_id, scheduled_at)
where slot_id is not null;
create index sessions_assignment_scheduled_idx
on public.sessions (assignment_id, scheduled_at desc)
where assignment_id is not null;
create index sessions_teacher_upcoming_idx
on public.sessions (teacher_id, scheduled_at)
where status in ('scheduled', 'held');
create index sessions_student_upcoming_idx
on public.sessions (student_id, scheduled_at)
where status in ('scheduled', 'held');

create or replace function public.set_session_ends_at()
returns trigger language plpgsql set search_path = ''
as $$
begin
  new.ends_at := new.scheduled_at + pg_catalog.make_interval(mins => new.duration_min);
  return new;
end;
$$;
revoke execute on function public.set_session_ends_at() from public, anon, authenticated, service_role;

create trigger sessions_set_ends_at
before insert or update of scheduled_at, duration_min on public.sessions
for each row execute function public.set_session_ends_at();

create or replace function public.enforce_session_gender()
returns trigger language plpgsql set search_path = ''
as $$
declare
  student_gender public.gender_t;
  teacher_gender public.gender_t;
begin
  select student.gender into student_gender
  from public.students as student
  where student.id = new.student_id;

  select teacher.gender into teacher_gender
  from public.teachers as teacher
  where teacher.id = new.teacher_id;

  if student_gender is null or teacher_gender is null then
    raise exception using errcode = '23503', message = 'session_party_not_found';
  end if;

  if student_gender is distinct from teacher_gender then
    raise exception using errcode = 'P0001', message = 'gender_mismatch';
  end if;

  return new;
end;
$$;
revoke execute on function public.enforce_session_gender() from public, anon, authenticated, service_role;

create trigger sessions_enforce_gender
before insert or update of student_id, teacher_id on public.sessions
for each row execute function public.enforce_session_gender();

alter table public.sessions add constraint no_teacher_overlap exclude using gist (
  teacher_id with =,
  tstzrange(scheduled_at, ends_at, '[)') with &&
) where (status in ('scheduled', 'held'));

alter table public.sessions add constraint no_student_overlap exclude using gist (
  student_id with =,
  tstzrange(scheduled_at, ends_at, '[)') with &&
) where (status in ('scheduled', 'held'));

create trigger sessions_set_updated_at
before update on public.sessions
for each row execute function public.set_updated_at();

create or replace function public.audit_session_row()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  previous_row jsonb;
  current_row jsonb;
  audited_record_id text;
begin
  if tg_op in ('UPDATE', 'DELETE') then
    previous_row := to_jsonb(old)
      - 'zoom_override_url'
      - 'zoom_meeting_id'
      - 'zoom_passcode'
      || jsonb_build_object(
        'zoom_configured',
        old.zoom_override_url is not null
        or old.zoom_meeting_id is not null
        or old.zoom_passcode is not null
      );
  end if;

  if tg_op in ('INSERT', 'UPDATE') then
    current_row := to_jsonb(new)
      - 'zoom_override_url'
      - 'zoom_meeting_id'
      - 'zoom_passcode'
      || jsonb_build_object(
        'zoom_configured',
        new.zoom_override_url is not null
        or new.zoom_meeting_id is not null
        or new.zoom_passcode is not null
      );
  end if;

  audited_record_id := coalesce(current_row ->> 'id', previous_row ->> 'id');

  insert into public.audit_logs (user_id, action, table_name, record_id, before, after, ip)
  values (
    (select auth.uid()),
    tg_op,
    'sessions',
    audited_record_id,
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
revoke execute on function public.audit_session_row() from public, anon, authenticated, service_role;

create trigger sessions_audit
after insert or update or delete on public.sessions
for each row execute function public.audit_session_row();

create or replace function public.block_student_gender_change()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if new.gender is not distinct from old.gender then
    return new;
  end if;

  if exists (
    select 1 from public.teacher_assignments as assignment
    where assignment.student_id = old.id and assignment.status in ('active', 'paused')
  ) then
    raise exception using errcode = 'P0001', message = 'gender_change_blocked_active_assignment';
  end if;

  if exists (
    select 1 from public.sessions as session
    where session.student_id = old.id and session.status in ('scheduled', 'held')
  ) then
    raise exception using errcode = 'P0001', message = 'gender_change_blocked_active_session';
  end if;

  return new;
end;
$$;

create or replace function public.block_teacher_gender_change()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if new.gender is not distinct from old.gender then
    return new;
  end if;

  if exists (
    select 1 from public.teacher_assignments as assignment
    where assignment.teacher_id = old.id and assignment.status in ('active', 'paused')
  ) then
    raise exception using errcode = 'P0001', message = 'gender_change_blocked_active_assignment';
  end if;

  if exists (
    select 1 from public.sessions as session
    where session.teacher_id = old.id and session.status in ('scheduled', 'held')
  ) then
    raise exception using errcode = 'P0001', message = 'gender_change_blocked_active_session';
  end if;

  return new;
end;
$$;

revoke execute on function public.block_student_gender_change() from public, anon, authenticated, service_role;
revoke execute on function public.block_teacher_gender_change() from public, anon, authenticated, service_role;

alter table public.sessions enable row level security;
revoke all on public.sessions from public, anon, authenticated;
grant select (
  id,
  assignment_id,
  student_id,
  teacher_id,
  original_teacher_id,
  slot_id,
  kind,
  makeup_of,
  scheduled_at,
  duration_min,
  ends_at,
  status,
  started_at,
  ended_at,
  created_at,
  updated_at
) on public.sessions to authenticated;
grant insert, update, delete on public.sessions to authenticated;
grant select, insert, update, delete on public.sessions to service_role;

create policy sessions_admin_all on public.sessions for all to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));
create policy sessions_teacher_read on public.sessions for select to authenticated
using (teacher_id = (select private.current_teacher_id()));
create policy sessions_student_read on public.sessions for select to authenticated
using (
  exists (
    select 1 from public.students as student
    where student.id = sessions.student_id
      and student.profile_id = (select auth.uid())
  )
);
create policy sessions_parent_read on public.sessions for select to authenticated
using ((select private.guards_student(student_id)));
