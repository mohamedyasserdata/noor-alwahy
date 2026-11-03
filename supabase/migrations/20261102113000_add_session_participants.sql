alter table public.sessions
add column format text not null default 'individual'
check (format in ('individual', 'group'));

grant select (format) on public.sessions to authenticated;

create table public.session_participants (
  session_id uuid not null references public.sessions(id) on delete restrict,
  student_id uuid not null references public.students(id) on delete restrict,
  assignment_id uuid references public.teacher_assignments(id) on delete restrict,
  is_primary boolean not null default false,
  created_by uuid references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (session_id, student_id)
);

create unique index session_participants_one_primary_idx
on public.session_participants (session_id)
where is_primary;

create index session_participants_student_session_idx
on public.session_participants (student_id, session_id);

create index session_participants_assignment_idx
on public.session_participants (assignment_id)
where assignment_id is not null;

insert into public.session_participants (
  session_id,
  student_id,
  assignment_id,
  is_primary
)
select session.id, session.student_id, session.assignment_id, true
from public.sessions as session
on conflict (session_id, student_id) do nothing;

create or replace function private.validate_session_participant()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  session_row public.sessions%rowtype;
  assignment_row public.teacher_assignments%rowtype;
  student_gender public.gender_t;
  teacher_gender public.gender_t;
begin
  select session.* into session_row
  from public.sessions as session
  where session.id = new.session_id;

  if session_row.id is null then
    raise exception using errcode = '23503', message = 'participant_session_not_found';
  end if;

  if new.is_primary and new.student_id is distinct from session_row.student_id then
    raise exception using errcode = '23514', message = 'participant_primary_mismatch';
  end if;

  if new.assignment_id is not null then
    select assignment.* into assignment_row
    from public.teacher_assignments as assignment
    where assignment.id = new.assignment_id;

    if assignment_row.id is null
      or assignment_row.student_id is distinct from new.student_id
      or assignment_row.teacher_id is distinct from session_row.teacher_id
      or assignment_row.status not in ('active', 'paused') then
      raise exception using errcode = '23514', message = 'participant_assignment_invalid';
    end if;
  elsif not new.is_primary then
    raise exception using errcode = '23514', message = 'participant_assignment_required';
  end if;

  select student.gender into student_gender
  from public.students as student
  where student.id = new.student_id;
  select teacher.gender into teacher_gender
  from public.teachers as teacher
  where teacher.id = session_row.teacher_id;

  if student_gender is null or teacher_gender is null then
    raise exception using errcode = '23503', message = 'participant_party_not_found';
  end if;
  if student_gender is distinct from teacher_gender then
    raise exception using errcode = 'P0001', message = 'gender_mismatch';
  end if;

  return new;
end;
$$;

revoke execute on function private.validate_session_participant()
from public, anon, authenticated, service_role;

create trigger session_participants_validate
before insert or update on public.session_participants
for each row execute function private.validate_session_participant();

create trigger session_participants_set_updated_at
before update on public.session_participants
for each row execute function public.set_updated_at();

create trigger session_participants_audit
after insert or update or delete on public.session_participants
for each row execute function public.audit_row();

create or replace function private.sync_primary_session_participant()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and old.student_id is distinct from new.student_id then
    delete from public.session_participants
    where session_id = old.id
      and student_id = old.student_id
      and is_primary;
  end if;

  insert into public.session_participants (
    session_id,
    student_id,
    assignment_id,
    is_primary,
    created_by
  )
  values (
    new.id,
    new.student_id,
    new.assignment_id,
    true,
    (select auth.uid())
  )
  on conflict (session_id, student_id) do update
  set assignment_id = excluded.assignment_id,
      is_primary = true;

  return new;
end;
$$;

revoke execute on function private.sync_primary_session_participant()
from public, anon, authenticated, service_role;

create trigger sessions_sync_primary_participant
after insert or update of student_id, assignment_id on public.sessions
for each row execute function private.sync_primary_session_participant();

alter table public.session_participants enable row level security;

revoke all on public.session_participants from public, anon, authenticated;
grant select on public.session_participants to authenticated;
grant select, insert, update, delete on public.session_participants to service_role;

create policy session_participants_admin_read
on public.session_participants
for select to authenticated
using ((select public.is_admin()));

create policy session_participants_teacher_read
on public.session_participants
for select to authenticated
using (exists (
  select 1
  from public.sessions as session
  where session.id = session_participants.session_id
    and session.teacher_id = (select private.current_teacher_id())
));

create policy session_participants_student_read
on public.session_participants
for select to authenticated
using (exists (
  select 1
  from public.students as student
  where student.id = session_participants.student_id
    and student.profile_id = (select auth.uid())
));

create policy session_participants_parent_read
on public.session_participants
for select to authenticated
using ((select private.guards_student(student_id)));

drop policy sessions_student_read on public.sessions;
create policy sessions_student_read
on public.sessions
for select to authenticated
using (exists (
  select 1
  from public.session_participants as participant
  join public.students as student on student.id = participant.student_id
  where participant.session_id = sessions.id
    and student.profile_id = (select auth.uid())
));

drop policy sessions_parent_read on public.sessions;
create policy sessions_parent_read
on public.sessions
for select to authenticated
using (exists (
  select 1
  from public.session_participants as participant
  where participant.session_id = sessions.id
    and (select private.guards_student(participant.student_id))
));

create or replace function public.manage_session_participant(
  p_session_id uuid,
  p_student_id uuid,
  p_assignment_id uuid,
  p_action text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  session_row public.sessions%rowtype;
begin
  if (select auth.uid()) is null or not (select public.is_admin()) then
    raise exception using errcode = '42501', message = 'session_participant_admin_required';
  end if;

  select session.* into session_row
  from public.sessions as session
  where session.id = p_session_id
  for update;

  if session_row.id is null then
    raise exception using errcode = 'P0002', message = 'session_not_found';
  end if;
  if session_row.status <> 'scheduled'
    or session_row.started_at is not null
    or session_row.ended_at is not null then
    raise exception using errcode = 'P0001', message = 'session_participants_locked';
  end if;

  if p_action = 'add' then
    if p_student_id = session_row.student_id then
      return;
    end if;
    insert into public.session_participants (
      session_id,
      student_id,
      assignment_id,
      is_primary,
      created_by
    )
    values (
      p_session_id,
      p_student_id,
      p_assignment_id,
      false,
      (select auth.uid())
    )
    on conflict (session_id, student_id) do update
    set assignment_id = excluded.assignment_id;

    update public.sessions set format = 'group' where id = p_session_id;
  elsif p_action = 'remove' then
    if p_student_id = session_row.student_id then
      raise exception using errcode = 'P0001', message = 'primary_participant_cannot_be_removed';
    end if;
    delete from public.session_participants
    where session_id = p_session_id
      and student_id = p_student_id
      and not is_primary;

    if not exists (
      select 1
      from public.session_participants as participant
      where participant.session_id = p_session_id
        and not participant.is_primary
    ) then
      update public.sessions set format = 'individual' where id = p_session_id;
    end if;
  else
    raise exception using errcode = '22023', message = 'invalid_participant_action';
  end if;
end;
$$;

revoke execute on function public.manage_session_participant(uuid, uuid, uuid, text)
from public, anon, service_role;
grant execute on function public.manage_session_participant(uuid, uuid, uuid, text)
to authenticated;

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
        from public.session_participants as participant
        join public.students as student on student.id = participant.student_id
        join public.profiles as profile on profile.id = student.profile_id
        where participant.session_id = session.id
          and student.profile_id = (select auth.uid())
          and profile.is_active
      )
      or exists (
        select 1
        from public.session_participants as participant
        where participant.session_id = session.id
          and (select private.guards_student(participant.student_id))
      )
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
