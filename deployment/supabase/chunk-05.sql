-- Generated staging deployment bundle. Source of truth remains supabase/migrations/.
-- BEGIN MIGRATION 20261027010000_create_teacher_applications.sql
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'teacher-applications',
  'teacher-applications',
  false,
  5242880,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do update
set public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table public.teacher_applications (
  id uuid primary key default gen_random_uuid(),
  application_no text unique not null check (application_no ~ '^NW-T-[A-F0-9]{20}$'),
  status text not null default 'new' check (
    status in ('new', 'reviewing', 'accepted', 'rejected', 'invited')
  ),
  full_name text not null check (char_length(btrim(full_name)) between 2 and 160),
  email text not null check (email = lower(email) and char_length(email) between 5 and 254),
  phone text not null check (char_length(btrim(phone)) between 7 and 30),
  gender public.gender_t not null,
  specialization text not null check (char_length(btrim(specialization)) between 2 and 200),
  qualifications text not null check (char_length(btrim(qualifications)) between 10 and 3000),
  experience_years smallint not null check (experience_years between 0 and 80),
  teaching_languages text[] not null check (
    cardinality(teaching_languages) between 1 and 8
    and array_position(teaching_languages, null) is null
  ),
  availability text not null check (char_length(btrim(availability)) between 5 and 2000),
  cv_path text unique check (
    cv_path is null
    or (
      char_length(cv_path) between 20 and 500
      and cv_path !~ '^[a-z]+://'
      and cv_path !~ '(^|/)\.\.(/|$)'
    )
  ),
  cv_name text check (cv_name is null or char_length(btrim(cv_name)) between 1 and 180),
  source text not null default 'website' check (char_length(source) between 1 and 80),
  consent_version text not null check (char_length(consent_version) between 1 and 40),
  consent_at timestamptz not null default now(),
  internal_notes text check (internal_notes is null or char_length(internal_notes) <= 5000),
  reviewed_by uuid references public.profiles(id) on delete restrict,
  reviewed_at timestamptz,
  invited_user_id uuid unique references public.profiles(id) on delete restrict,
  request_ip_hash char(64) not null check (request_ip_hash ~ '^[a-f0-9]{64}$'),
  contact_hash char(64) not null check (contact_hash ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((cv_path is null) = (cv_name is null)),
  check ((reviewed_by is null) = (reviewed_at is null)),
  check ((status = 'invited') = (invited_user_id is not null))
);

create index teacher_applications_status_created_idx
on public.teacher_applications (status, created_at desc, id);
create index teacher_applications_search_idx
on public.teacher_applications (created_at desc, id);
create index teacher_applications_ip_rate_idx
on public.teacher_applications (request_ip_hash, created_at desc);
create unique index teacher_applications_open_contact_idx
on public.teacher_applications (contact_hash)
where status in ('new', 'reviewing', 'accepted', 'invited');

create trigger teacher_applications_set_updated_at
before update on public.teacher_applications
for each row execute function public.set_updated_at();

create or replace function public.enforce_teacher_application_transition()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if old.status = new.status then return new; end if;
  if not (
    (old.status = 'new' and new.status in ('reviewing', 'rejected'))
    or (old.status = 'reviewing' and new.status in ('accepted', 'rejected'))
    or (old.status = 'accepted' and new.status = 'invited')
  ) then
    raise exception using errcode = 'P0001', message = 'invalid_teacher_application_transition';
  end if;
  return new;
end;
$$;
revoke execute on function public.enforce_teacher_application_transition()
from public, anon, authenticated, service_role;

create trigger teacher_applications_enforce_transition
before update of status on public.teacher_applications
for each row execute function public.enforce_teacher_application_transition();

create or replace function public.audit_teacher_application_workflow()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if old.status is distinct from new.status
    or old.internal_notes is distinct from new.internal_notes
    or old.invited_user_id is distinct from new.invited_user_id then
    insert into public.audit_logs(user_id, action, table_name, record_id, before, after, ip)
    values (
      (select auth.uid()),
      'UPDATE',
      'teacher_applications',
      new.id::text,
      jsonb_build_object(
        'status', old.status,
        'has_internal_notes', old.internal_notes is not null,
        'invited_user_id', old.invited_user_id
      ),
      jsonb_build_object(
        'status', new.status,
        'has_internal_notes', new.internal_notes is not null,
        'invited_user_id', new.invited_user_id
      ),
      inet_client_addr()
    );
  end if;
  return new;
end;
$$;
revoke execute on function public.audit_teacher_application_workflow()
from public, anon, authenticated, service_role;

create trigger teacher_applications_audit_workflow
after update on public.teacher_applications
for each row execute function public.audit_teacher_application_workflow();

alter table public.teacher_applications enable row level security;
revoke all on public.teacher_applications from public, anon, authenticated, service_role;
grant select, update on public.teacher_applications to authenticated;
grant select, insert, update, delete on public.teacher_applications to service_role;

create policy teacher_applications_admin_read
on public.teacher_applications for select to authenticated
using ((select public.is_admin()));

create policy teacher_applications_admin_update
on public.teacher_applications for update to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));

create or replace function public.submit_teacher_application(
  p_payload jsonb,
  p_ip_hash text,
  p_contact_hash text
)
returns text language plpgsql security definer set search_path = ''
as $$
declare
  generated_number text;
begin
  if current_user not in ('service_role', 'postgres') then
    raise exception using errcode = '42501', message = 'service_role_required';
  end if;
  if p_ip_hash !~ '^[a-f0-9]{64}$' or p_contact_hash !~ '^[a-f0-9]{64}$' then
    raise exception using errcode = '22023', message = 'teacher_application_hash_invalid';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_contact_hash, 0));
  if exists (
    select 1 from public.teacher_applications
    where contact_hash = p_contact_hash
      and status in ('new', 'reviewing', 'accepted', 'invited')
  ) then
    raise exception using errcode = '23505', message = 'teacher_application_exists';
  end if;
  if (
    select count(*) from public.teacher_applications
    where request_ip_hash = p_ip_hash and created_at > now() - interval '1 hour'
  ) >= 5 then
    raise exception using errcode = 'P0001', message = 'teacher_application_rate_limited';
  end if;

  generated_number := 'NW-T-' || upper(encode(extensions.gen_random_bytes(10), 'hex'));
  insert into public.teacher_applications (
    application_no, full_name, email, phone, gender, specialization, qualifications,
    experience_years, teaching_languages, availability, cv_path, cv_name, source,
    consent_version, request_ip_hash, contact_hash
  ) values (
    generated_number,
    p_payload ->> 'full_name',
    lower(p_payload ->> 'email'),
    p_payload ->> 'phone',
    (p_payload ->> 'gender')::public.gender_t,
    p_payload ->> 'specialization',
    p_payload ->> 'qualifications',
    (p_payload ->> 'experience_years')::smallint,
    array(select jsonb_array_elements_text(p_payload -> 'teaching_languages')),
    p_payload ->> 'availability',
    nullif(p_payload ->> 'cv_path', ''),
    nullif(p_payload ->> 'cv_name', ''),
    coalesce(nullif(p_payload ->> 'source', ''), 'website'),
    p_payload ->> 'consent_version',
    p_ip_hash,
    p_contact_hash
  );
  return generated_number;
end;
$$;

revoke execute on function public.submit_teacher_application(jsonb,text,text)
from public, anon, authenticated;
grant execute on function public.submit_teacher_application(jsonb,text,text) to service_role;

create or replace function public.finalize_teacher_application_invite(
  p_application_id uuid,
  p_profile_id uuid
)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  managed_application public.teacher_applications%rowtype;
  new_teacher_id uuid;
begin
  if not (select public.is_admin()) then
    raise exception using errcode = '42501', message = 'admin_mfa_required';
  end if;

  select * into managed_application
  from public.teacher_applications
  where id = p_application_id
  for update;

  if managed_application.id is null then
    raise exception using errcode = 'P0002', message = 'teacher_application_not_found';
  end if;
  if managed_application.invited_user_id is not null then
    raise exception using errcode = '23505', message = 'teacher_application_already_invited';
  end if;
  if managed_application.status <> 'accepted' then
    raise exception using errcode = 'P0001', message = 'teacher_application_not_accepted';
  end if;
  if not exists (
    select 1 from public.profiles
    where id = p_profile_id and role = 'teacher'::public.user_role and is_active
  ) then
    raise exception using errcode = '23503', message = 'teacher_profile_required';
  end if;

  insert into public.teachers (profile_id, gender, specialization, status)
  values (p_profile_id, managed_application.gender, managed_application.specialization, 'pending')
  returning id into new_teacher_id;

  update public.teacher_applications
  set status = 'invited',
    invited_user_id = p_profile_id,
    reviewed_by = coalesce(reviewed_by, (select auth.uid())),
    reviewed_at = coalesce(reviewed_at, now())
  where id = p_application_id;

  return new_teacher_id;
end;
$$;

revoke execute on function public.finalize_teacher_application_invite(uuid,uuid)
from public, anon, service_role;
grant execute on function public.finalize_teacher_application_invite(uuid,uuid)
to authenticated;

insert into supabase_migrations.schema_migrations(version, statements, name) values ('20261027010000', array[]::text[], 'create_teacher_applications') on conflict (version) do nothing;
-- END MIGRATION 20261027010000_create_teacher_applications.sql
-- BEGIN MIGRATION 20261027020000_fix_teacher_application_invite_link.sql
create or replace function public.finalize_teacher_application_invite(
  p_application_id uuid,
  p_profile_id uuid
)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  managed_application public.teacher_applications%rowtype;
  managed_teacher_id uuid;
begin
  if not (select public.is_admin()) then
    raise exception using errcode = '42501', message = 'admin_mfa_required';
  end if;

  select * into managed_application
  from public.teacher_applications
  where id = p_application_id
  for update;

  if managed_application.id is null then
    raise exception using errcode = 'P0002', message = 'teacher_application_not_found';
  end if;
  if managed_application.invited_user_id is not null then
    raise exception using errcode = '23505', message = 'teacher_application_already_invited';
  end if;
  if managed_application.status <> 'accepted' then
    raise exception using errcode = 'P0001', message = 'teacher_application_not_accepted';
  end if;
  if not exists (
    select 1 from public.profiles
    where id = p_profile_id and role = 'teacher'::public.user_role and is_active
  ) then
    raise exception using errcode = '23503', message = 'teacher_profile_required';
  end if;

  insert into public.teachers (profile_id, gender, specialization, status)
  values (p_profile_id, managed_application.gender, managed_application.specialization, 'pending')
  on conflict (profile_id) do update
  set gender = excluded.gender,
      specialization = excluded.specialization,
      status = 'pending'
  returning id into managed_teacher_id;

  update public.teacher_applications
  set status = 'invited',
    invited_user_id = p_profile_id,
    reviewed_by = coalesce(reviewed_by, (select auth.uid())),
    reviewed_at = coalesce(reviewed_at, now())
  where id = p_application_id;

  return managed_teacher_id;
end;
$$;

revoke execute on function public.finalize_teacher_application_invite(uuid,uuid)
from public, anon, service_role;
grant execute on function public.finalize_teacher_application_invite(uuid,uuid)
to authenticated;

insert into supabase_migrations.schema_migrations(version, statements, name) values ('20261027020000', array[]::text[], 'fix_teacher_application_invite_link') on conflict (version) do nothing;
-- END MIGRATION 20261027020000_fix_teacher_application_invite_link.sql
-- BEGIN MIGRATION 20261029010000_hide_evaluation_drafts.sql
drop policy if exists session_evaluations_student_read on public.session_evaluations;

create policy session_evaluations_student_read on public.session_evaluations
for select to authenticated
using (
  is_locked
  and exists (
    select 1 from public.sessions as session
    join public.students as student on student.id = session.student_id
    where session.id = session_evaluations.session_id
      and student.profile_id = (select auth.uid())
  )
);

drop policy if exists session_evaluations_parent_read on public.session_evaluations;

create policy session_evaluations_parent_read on public.session_evaluations
for select to authenticated
using (
  is_locked
  and exists (
    select 1 from public.sessions as session
    where session.id = session_evaluations.session_id
      and (select private.guards_student(session.student_id))
  )
);

insert into supabase_migrations.schema_migrations(version, statements, name) values ('20261029010000', array[]::text[], 'hide_evaluation_drafts') on conflict (version) do nothing;
-- END MIGRATION 20261029010000_hide_evaluation_drafts.sql
-- BEGIN MIGRATION 20261102090000_add_session_workspace_zoom_controls.sql
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

insert into supabase_migrations.schema_migrations(version, statements, name) values ('20261102090000', array[]::text[], 'add_session_workspace_zoom_controls') on conflict (version) do nothing;
-- END MIGRATION 20261102090000_add_session_workspace_zoom_controls.sql
-- BEGIN MIGRATION 20261102100000_complete_report_review_workflow.sql
alter table public.reports
  add column review_note text,
  add column published_by uuid references public.profiles(id) on delete restrict,
  add column published_version integer not null default 0 check (published_version >= 0);

create table public.report_versions (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports(id) on delete restrict,
  version_no integer not null check (version_no > 0),
  body_snapshot jsonb not null,
  published_by uuid not null references public.profiles(id) on delete restrict,
  published_at timestamptz not null default now(),
  unique (report_id, version_no)
);

create or replace function private.prepare_report()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_role public.user_role;
  allowed_transition boolean := false;
begin
  actor_role := (select public.auth_role());

  if tg_op = 'INSERT' then
    if new.status <> 'draft' then
      raise exception using errcode = 'P0001', message = 'report_must_start_draft';
    end if;
    if actor_role = 'teacher' and (
      new.teacher_id is distinct from (select private.current_teacher_id())
      or not (select private.teaches_student(new.student_id))
    ) then
      raise exception using errcode = '42501', message = 'report_forbidden';
    end if;
    new.body := jsonb_set(
      new.body,
      '{metrics}',
      private.calculate_report_metrics(new.student_id, new.period_start, new.period_end),
      true
    );
    return new;
  end if;

  if new.student_id is distinct from old.student_id
    or new.teacher_id is distinct from old.teacher_id
    or new.period_type is distinct from old.period_type
    or new.period_start is distinct from old.period_start
    or new.period_end is distinct from old.period_end then
    raise exception using errcode = 'P0001', message = 'report_identity_immutable';
  end if;

  if new.body is distinct from old.body and not (
    (actor_role = 'teacher' and old.status in ('draft', 'admin_review'))
    or (actor_role = 'admin' and old.status = 'approved')
  ) then
    raise exception using errcode = 'P0001', message = 'report_content_locked';
  end if;

  if new.status is distinct from old.status then
    allowed_transition := case
      when actor_role = 'teacher' then
        old.status in ('draft', 'admin_review') and new.status = 'approved'
      when actor_role = 'admin' then
        (old.status = 'approved' and new.status in ('admin_review', 'visible'))
        or (old.status = 'visible' and new.status = 'draft')
      else false
    end;
    if not allowed_transition then
      raise exception using errcode = 'P0001', message = 'report_transition_forbidden';
    end if;
  end if;

  if new.status = 'admin_review' and old.status <> 'admin_review'
    and char_length(btrim(coalesce(new.review_note, ''))) < 2 then
    raise exception using errcode = '23514', message = 'report_revision_reason_required';
  end if;

  if new.status = 'approved' and old.status in ('draft', 'admin_review') then
    new.review_note := null;
  end if;

  new.body := jsonb_set(
    new.body,
    '{metrics}',
    private.calculate_report_metrics(new.student_id, new.period_start, new.period_end),
    true
  );
  new.approved_at := case
    when new.status in ('approved', 'admin_review', 'visible')
      then coalesce(old.approved_at, pg_catalog.clock_timestamp())
    else null
  end;
  if new.status = 'visible' and old.status <> 'visible' then
    new.made_visible_at := pg_catalog.clock_timestamp();
    new.published_by := (select auth.uid());
    new.published_version := old.published_version + 1;
  elsif new.status <> 'visible' then
    new.made_visible_at := null;
  end if;
  return new;
end;
$$;

create or replace function private.snapshot_published_report()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'visible' and old.status <> 'visible' then
    insert into public.report_versions (
      report_id, version_no, body_snapshot, published_by, published_at
    ) values (
      new.id, new.published_version, new.body, new.published_by, new.made_visible_at
    );
  end if;
  return new;
end;
$$;

revoke execute on function private.snapshot_published_report() from public, anon, authenticated, service_role;

create trigger reports_snapshot_published
after update of status on public.reports
for each row execute function private.snapshot_published_report();

create or replace function private.notify_report_approved()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  recipient record;
begin
  if new.status = 'visible' and old.status <> 'visible' then
    for recipient in
      select guardian.profile_id as user_id
      from public.student_guardians as link
      join public.guardians as guardian on guardian.id = link.guardian_id
      where link.student_id = new.student_id
    loop
      perform private.enqueue_notification(
        recipient.user_id,
        'report_approved',
        jsonb_build_object(
          'report_id', new.id,
          'student_id', new.student_id,
          'period_type', new.period_type,
          'period_start', new.period_start,
          'period_end', new.period_end,
          'version', new.published_version
        )
      );
    end loop;
  end if;
  return new;
end;
$$;

alter table public.report_versions enable row level security;
revoke all on table public.report_versions from public, anon, authenticated, service_role;
grant select on table public.report_versions to authenticated, service_role;

create policy report_versions_admin_read on public.report_versions
for select to authenticated using ((select public.is_admin()));
create policy report_versions_teacher_read on public.report_versions
for select to authenticated using (exists (
  select 1 from public.reports as report
  where report.id = report_versions.report_id
    and report.teacher_id = (select private.current_teacher_id())
));

insert into supabase_migrations.schema_migrations(version, statements, name) values ('20261102100000', array[]::text[], 'complete_report_review_workflow') on conflict (version) do nothing;
-- END MIGRATION 20261102100000_complete_report_review_workflow.sql
-- BEGIN MIGRATION 20261102110000_add_teacher_attendance_register.sql
create table public.teacher_attendance (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null unique references public.sessions(id) on delete restrict,
  teacher_id uuid not null references public.teachers(id) on delete restrict,
  status text not null check (status in ('present', 'late', 'absent', 'excused')),
  minutes integer check (minutes is null or minutes between 0 and 240),
  note text check (note is null or char_length(btrim(note)) between 2 and 1000),
  recorded_by uuid not null references public.profiles(id) on delete restrict,
  recorded_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index teacher_attendance_teacher_recorded_idx
on public.teacher_attendance (teacher_id, recorded_at desc);

create index teacher_attendance_status_recorded_idx
on public.teacher_attendance (status, recorded_at desc);

create trigger teacher_attendance_set_updated_at
before update on public.teacher_attendance
for each row execute function public.set_updated_at();

create trigger teacher_attendance_audit
after insert or update on public.teacher_attendance
for each row execute function public.audit_row();

alter table public.teacher_attendance enable row level security;

revoke all on public.teacher_attendance from public, anon, authenticated;
grant select on public.teacher_attendance to authenticated;
grant select, insert, update, delete on public.teacher_attendance to service_role;

create policy teacher_attendance_admin_read
on public.teacher_attendance
for select to authenticated
using ((select public.is_admin()));

create policy teacher_attendance_teacher_read
on public.teacher_attendance
for select to authenticated
using (teacher_id = (select private.current_teacher_id()));

create or replace function public.record_teacher_attendance(
  p_session_id uuid,
  p_status text,
  p_minutes integer default null,
  p_note text default null
)
returns public.teacher_attendance
language plpgsql
security definer
set search_path = ''
as $$
declare
  session_row public.sessions%rowtype;
  saved_row public.teacher_attendance%rowtype;
  normalized_note text := nullif(pg_catalog.btrim(p_note), '');
begin
  if (select auth.uid()) is null or not (select public.is_admin()) then
    raise exception using errcode = '42501', message = 'teacher_attendance_admin_required';
  end if;

  if p_status is null or p_status not in ('present', 'late', 'absent', 'excused') then
    raise exception using errcode = '22023', message = 'teacher_attendance_status_invalid';
  end if;

  if p_minutes is not null and (p_minutes < 0 or p_minutes > 240) then
    raise exception using errcode = '22023', message = 'teacher_attendance_minutes_invalid';
  end if;

  if normalized_note is not null and char_length(normalized_note) not between 2 and 1000 then
    raise exception using errcode = '22023', message = 'teacher_attendance_note_invalid';
  end if;

  select session.* into session_row
  from public.sessions as session
  where session.id = p_session_id
  for update;

  if session_row.id is null then
    raise exception using errcode = 'P0002', message = 'teacher_attendance_session_not_found';
  end if;

  if session_row.ends_at > statement_timestamp() then
    raise exception using errcode = 'P0001', message = 'teacher_attendance_session_not_ended';
  end if;

  insert into public.teacher_attendance (
    session_id,
    teacher_id,
    status,
    minutes,
    note,
    recorded_by,
    recorded_at
  )
  values (
    session_row.id,
    session_row.teacher_id,
    p_status,
    p_minutes,
    normalized_note,
    (select auth.uid()),
    statement_timestamp()
  )
  on conflict (session_id) do update
  set teacher_id = excluded.teacher_id,
      status = excluded.status,
      minutes = excluded.minutes,
      note = excluded.note,
      recorded_by = excluded.recorded_by,
      recorded_at = excluded.recorded_at
  returning * into saved_row;

  return saved_row;
end;
$$;

revoke execute on function public.record_teacher_attendance(uuid, text, integer, text)
from public, anon, service_role;
grant execute on function public.record_teacher_attendance(uuid, text, integer, text)
to authenticated;

insert into supabase_migrations.schema_migrations(version, statements, name) values ('20261102110000', array[]::text[], 'add_teacher_attendance_register') on conflict (version) do nothing;
-- END MIGRATION 20261102110000_add_teacher_attendance_register.sql
-- BEGIN MIGRATION 20261102111000_use_teacher_attendance_in_reports.sql
create or replace function public.get_attendance_report(
  p_period text,
  p_anchor date default current_date
)
returns table (
  entity_type text,
  entity_id uuid,
  entity_name text,
  scheduled_count bigint,
  attended_count bigint,
  absent_count bigint,
  adherence_percent numeric
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor_role public.user_role := (select public.auth_role());
  range_start date;
  range_end date;
  instant_start timestamptz;
  instant_end timestamptz;
begin
  if actor_role is distinct from 'admin'::public.user_role then
    raise exception using errcode = '42501', message = 'attendance_report_forbidden';
  end if;

  if not (select public.is_admin()) then
    raise exception using errcode = '42501', message = 'mfa_required';
  end if;

  if p_period = 'daily' then
    range_start := p_anchor;
    range_end := p_anchor + 1;
  elsif p_period = 'weekly' then
    range_start := date_trunc('week', p_anchor::timestamp)::date;
    range_end := range_start + 7;
  elsif p_period = 'monthly' then
    range_start := date_trunc('month', p_anchor::timestamp)::date;
    range_end := (range_start + interval '1 month')::date;
  else
    raise exception using errcode = '22023', message = 'invalid_attendance_report_period';
  end if;

  instant_start := range_start::timestamp at time zone 'Africa/Cairo';
  instant_end := range_end::timestamp at time zone 'Africa/Cairo';

  return query
  with period_sessions as (
    select
      session.id,
      session.student_id,
      session.teacher_id,
      student_attendance.status as student_attendance_status,
      teacher_attendance.status as teacher_attendance_status
    from public.sessions as session
    left join public.attendance as student_attendance
      on student_attendance.session_id = session.id
    left join public.teacher_attendance as teacher_attendance
      on teacher_attendance.session_id = session.id
    where session.scheduled_at >= instant_start
      and session.scheduled_at < instant_end
      and session.status not in ('cancelled', 'rescheduled')
  ), student_rows as (
    select
      'student'::text as row_type,
      student.id as row_id,
      student.full_name as row_name,
      count(*) filter (
        where period.student_attendance_status not in (
          'teacher_absent', 'cancelled_teacher', 'cancelled_admin'
        )
        or period.student_attendance_status is null
      ) as row_scheduled,
      count(*) filter (
        where period.student_attendance_status in ('present', 'late')
      ) as row_attended,
      count(*) filter (
        where period.student_attendance_status in ('student_absent', 'student_excused')
      ) as row_absent
    from period_sessions as period
    join public.students as student on student.id = period.student_id
    group by student.id, student.full_name
  ), teacher_rows as (
    select
      'teacher'::text as row_type,
      teacher.id as row_id,
      profile.full_name as row_name,
      count(*) as row_scheduled,
      count(*) filter (
        where period.teacher_attendance_status in ('present', 'late')
      ) as row_attended,
      count(*) filter (
        where period.teacher_attendance_status in ('absent', 'excused')
      ) as row_absent
    from period_sessions as period
    join public.teachers as teacher on teacher.id = period.teacher_id
    join public.profiles as profile on profile.id = teacher.profile_id
    group by teacher.id, profile.full_name
  ), combined as (
    select * from student_rows
    union all
    select * from teacher_rows
  )
  select
    combined.row_type,
    combined.row_id,
    combined.row_name,
    combined.row_scheduled,
    combined.row_attended,
    combined.row_absent,
    case
      when combined.row_scheduled = 0 then 0::numeric
      else round(
        (combined.row_attended::numeric / combined.row_scheduled::numeric) * 100,
        1
      )
    end
  from combined
  order by combined.row_type, combined.row_name, combined.row_id;
end;
$$;

revoke execute on function public.get_attendance_report(text, date)
from public, anon, service_role;
grant execute on function public.get_attendance_report(text, date)
to authenticated;

insert into supabase_migrations.schema_migrations(version, statements, name) values ('20261102111000', array[]::text[], 'use_teacher_attendance_in_reports') on conflict (version) do nothing;
-- END MIGRATION 20261102111000_use_teacher_attendance_in_reports.sql
-- BEGIN MIGRATION 20261102112000_require_teacher_attendance_correction_reason.sql
create or replace function public.record_teacher_attendance(
  p_session_id uuid,
  p_status text,
  p_minutes integer default null,
  p_note text default null
)
returns public.teacher_attendance
language plpgsql
security definer
set search_path = ''
as $$
declare
  session_row public.sessions%rowtype;
  existing_row public.teacher_attendance%rowtype;
  saved_row public.teacher_attendance%rowtype;
  normalized_note text := nullif(pg_catalog.btrim(p_note), '');
begin
  if (select auth.uid()) is null or not (select public.is_admin()) then
    raise exception using errcode = '42501', message = 'teacher_attendance_admin_required';
  end if;

  if p_status is null or p_status not in ('present', 'late', 'absent', 'excused') then
    raise exception using errcode = '22023', message = 'teacher_attendance_status_invalid';
  end if;

  if p_minutes is not null and (p_minutes < 0 or p_minutes > 240) then
    raise exception using errcode = '22023', message = 'teacher_attendance_minutes_invalid';
  end if;

  if normalized_note is not null and char_length(normalized_note) not between 2 and 1000 then
    raise exception using errcode = '22023', message = 'teacher_attendance_note_invalid';
  end if;

  select session.* into session_row
  from public.sessions as session
  where session.id = p_session_id
  for update;

  if session_row.id is null then
    raise exception using errcode = 'P0002', message = 'teacher_attendance_session_not_found';
  end if;

  if session_row.ends_at > statement_timestamp() then
    raise exception using errcode = 'P0001', message = 'teacher_attendance_session_not_ended';
  end if;

  select attendance.* into existing_row
  from public.teacher_attendance as attendance
  where attendance.session_id = p_session_id;

  if existing_row.id is not null and normalized_note is null then
    raise exception using
      errcode = '22023',
      message = 'teacher_attendance_correction_reason_required';
  end if;

  insert into public.teacher_attendance (
    session_id,
    teacher_id,
    status,
    minutes,
    note,
    recorded_by,
    recorded_at
  )
  values (
    session_row.id,
    session_row.teacher_id,
    p_status,
    p_minutes,
    normalized_note,
    (select auth.uid()),
    statement_timestamp()
  )
  on conflict (session_id) do update
  set teacher_id = excluded.teacher_id,
      status = excluded.status,
      minutes = excluded.minutes,
      note = excluded.note,
      recorded_by = excluded.recorded_by,
      recorded_at = excluded.recorded_at
  returning * into saved_row;

  return saved_row;
end;
$$;

revoke execute on function public.record_teacher_attendance(uuid, text, integer, text)
from public, anon, service_role;
grant execute on function public.record_teacher_attendance(uuid, text, integer, text)
to authenticated;

insert into supabase_migrations.schema_migrations(version, statements, name) values ('20261102112000', array[]::text[], 'require_teacher_attendance_correction_reason') on conflict (version) do nothing;
-- END MIGRATION 20261102112000_require_teacher_attendance_correction_reason.sql
-- BEGIN MIGRATION 20261102113000_add_session_participants.sql
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

insert into supabase_migrations.schema_migrations(version, statements, name) values ('20261102113000', array[]::text[], 'add_session_participants') on conflict (version) do nothing;
-- END MIGRATION 20261102113000_add_session_participants.sql
-- BEGIN MIGRATION 20261102114000_add_session_participant_audit_identity.sql
alter table public.session_participants
add column id uuid default gen_random_uuid();

update public.session_participants
set id = gen_random_uuid()
where id is null;

alter table public.session_participants
alter column id set not null;

alter table public.session_participants
drop constraint session_participants_pkey;

alter table public.session_participants
add constraint session_participants_pkey primary key (id);

alter table public.session_participants
add constraint session_participants_session_student_key unique (session_id, student_id);

insert into supabase_migrations.schema_migrations(version, statements, name) values ('20261102114000', array[]::text[], 'add_session_participant_audit_identity') on conflict (version) do nothing;
-- END MIGRATION 20261102114000_add_session_participant_audit_identity.sql
-- BEGIN MIGRATION 20261102115000_fix_session_participant_rls_recursion.sql
create or replace function private.teacher_owns_session(p_session_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(exists (
    select 1
    from public.sessions as session
    where session.id = p_session_id
      and session.teacher_id = (select private.current_teacher_id())
  ), false)
$$;

create or replace function private.student_participates_in_session(p_session_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(exists (
    select 1
    from public.session_participants as participant
    join public.students as student on student.id = participant.student_id
    join public.profiles as profile on profile.id = student.profile_id
    where participant.session_id = p_session_id
      and student.profile_id = (select auth.uid())
      and profile.is_active
  ), false)
$$;

create or replace function private.guardian_has_session_participant(p_session_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(exists (
    select 1
    from public.session_participants as participant
    where participant.session_id = p_session_id
      and (select private.guards_student(participant.student_id))
  ), false)
$$;

revoke execute on function private.teacher_owns_session(uuid) from public, anon;
revoke execute on function private.student_participates_in_session(uuid) from public, anon;
revoke execute on function private.guardian_has_session_participant(uuid) from public, anon;
grant execute on function private.teacher_owns_session(uuid) to authenticated, service_role;
grant execute on function private.student_participates_in_session(uuid) to authenticated, service_role;
grant execute on function private.guardian_has_session_participant(uuid) to authenticated, service_role;

drop policy session_participants_teacher_read on public.session_participants;
create policy session_participants_teacher_read
on public.session_participants
for select to authenticated
using ((select private.teacher_owns_session(session_id)));

drop policy sessions_student_read on public.sessions;
create policy sessions_student_read
on public.sessions
for select to authenticated
using ((select private.student_participates_in_session(id)));

drop policy sessions_parent_read on public.sessions;
create policy sessions_parent_read
on public.sessions
for select to authenticated
using ((select private.guardian_has_session_participant(id)));

insert into supabase_migrations.schema_migrations(version, statements, name) values ('20261102115000', array[]::text[], 'fix_session_participant_rls_recursion') on conflict (version) do nothing;
-- END MIGRATION 20261102115000_fix_session_participant_rls_recursion.sql
-- BEGIN MIGRATION 20261102116000_add_participant_student_attendance.sql
alter table public.attendance
add column id uuid default gen_random_uuid(),
add column student_id uuid references public.students(id) on delete restrict,
add column correction_reason text check (
  correction_reason is null or char_length(btrim(correction_reason)) between 2 and 1000
);

update public.attendance as attendance
set student_id = session.student_id,
    id = coalesce(attendance.id, gen_random_uuid())
from public.sessions as session
where session.id = attendance.session_id;

alter table public.attendance
alter column id set not null,
alter column student_id set not null;

alter table public.attendance drop constraint attendance_pkey;
alter table public.attendance add constraint attendance_pkey primary key (id);
alter table public.attendance
add constraint attendance_session_student_key unique (session_id, student_id);

create index attendance_student_recorded_idx
on public.attendance (student_id, recorded_at desc);

create or replace function private.fill_attendance_student()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.student_id is null then
    select session.student_id into new.student_id
    from public.sessions as session
    where session.id = new.session_id;
  end if;

  if not exists (
    select 1
    from public.session_participants as participant
    where participant.session_id = new.session_id
      and participant.student_id = new.student_id
  ) then
    raise exception using errcode = '23514', message = 'attendance_student_not_participant';
  end if;

  return new;
end;
$$;

revoke execute on function private.fill_attendance_student()
from public, anon, authenticated, service_role;

create trigger attendance_fill_student
before insert or update of session_id, student_id on public.attendance
for each row execute function private.fill_attendance_student();

drop policy attendance_student_read on public.attendance;
create policy attendance_student_read
on public.attendance
for select to authenticated
using (exists (
  select 1
  from public.students as student
  where student.id = attendance.student_id
    and student.profile_id = (select auth.uid())
));

drop policy attendance_parent_read on public.attendance;
create policy attendance_parent_read
on public.attendance
for select to authenticated
using ((select private.guards_student(student_id)));

create or replace function public.record_attendance(
  p_session_id uuid,
  p_status public.attendance_status,
  p_student_joined_at timestamptz default null,
  p_teacher_joined_at timestamptz default null,
  p_minutes integer default null,
  p_student_notice_at timestamptz default null
)
returns public.attendance
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  session_row public.sessions%rowtype;
  existing_attendance public.attendance%rowtype;
  saved_attendance public.attendance%rowtype;
  policy_value jsonb;
  lock_hours integer;
  attendance_deadline timestamptz;
  actor_is_admin boolean := (select public.is_admin());
begin
  if actor_id is null then
    raise exception using errcode = '42501', message = 'attendance_forbidden';
  end if;

  select * into session_row
  from public.sessions
  where id = p_session_id
  for update;

  if session_row.id is null then
    raise exception using errcode = 'P0002', message = 'attendance_session_not_found';
  end if;

  if not actor_is_admin
    and session_row.teacher_id is distinct from (select private.current_teacher_id()) then
    raise exception using errcode = '42501', message = 'attendance_forbidden';
  end if;

  select setting.value into policy_value
  from public.app_settings as setting
  where setting.key = 'attendance_policy';
  lock_hours := coalesce((policy_value ->> 'attendance_lock_hours')::integer, 48);
  attendance_deadline := session_row.ends_at + pg_catalog.make_interval(hours => lock_hours);

  if not actor_is_admin and statement_timestamp() > attendance_deadline then
    raise exception using errcode = 'P0001', message = 'attendance_locked';
  end if;
  if p_minutes is not null and p_minutes not between 0 and 240 then
    raise exception using errcode = '22023', message = 'invalid_attendance_minutes';
  end if;

  select * into existing_attendance
  from public.attendance
  where session_id = p_session_id
    and student_id = session_row.student_id;

  if existing_attendance.id is not null then
    if existing_attendance.status = p_status
      and existing_attendance.student_joined_at is not distinct from p_student_joined_at
      and existing_attendance.teacher_joined_at is not distinct from p_teacher_joined_at
      and existing_attendance.minutes is not distinct from p_minutes
      and existing_attendance.student_notice_at is not distinct from p_student_notice_at then
      return existing_attendance;
    end if;
    raise exception using errcode = 'P0001', message = 'attendance_conflict';
  end if;

  insert into public.attendance (
    session_id,
    student_id,
    status,
    student_joined_at,
    teacher_joined_at,
    minutes,
    student_notice_at,
    recorded_by,
    locked_at
  )
  values (
    p_session_id,
    session_row.student_id,
    p_status,
    p_student_joined_at,
    p_teacher_joined_at,
    p_minutes,
    p_student_notice_at,
    actor_id,
    attendance_deadline
  )
  returning * into saved_attendance;

  if session_row.format = 'individual' then
    perform private.apply_attendance_effects(p_session_id);
  end if;

  return saved_attendance;
end;
$$;

revoke execute on function public.record_attendance(uuid, public.attendance_status, timestamptz, timestamptz, integer, timestamptz)
from public, anon, service_role;
grant execute on function public.record_attendance(uuid, public.attendance_status, timestamptz, timestamptz, integer, timestamptz)
to authenticated;

create or replace function public.record_student_attendance(
  p_session_id uuid,
  p_student_id uuid,
  p_status public.attendance_status,
  p_correction_reason text default null
)
returns public.attendance
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  actor_is_admin boolean := (select public.is_admin());
  session_row public.sessions%rowtype;
  existing_row public.attendance%rowtype;
  saved_row public.attendance%rowtype;
  policy_value jsonb;
  lock_hours integer;
  attendance_deadline timestamptz;
  reason_value text := nullif(pg_catalog.btrim(p_correction_reason), '');
begin
  if actor_id is null then
    raise exception using errcode = '42501', message = 'attendance_forbidden';
  end if;
  if p_status not in ('present', 'late', 'student_absent', 'student_excused') then
    raise exception using errcode = '22023', message = 'student_attendance_status_invalid';
  end if;

  select session.* into session_row
  from public.sessions as session
  where session.id = p_session_id
  for update;

  if session_row.id is null then
    raise exception using errcode = 'P0002', message = 'attendance_session_not_found';
  end if;
  if not actor_is_admin
    and session_row.teacher_id is distinct from (select private.current_teacher_id()) then
    raise exception using errcode = '42501', message = 'attendance_forbidden';
  end if;
  if not exists (
    select 1
    from public.session_participants as participant
    where participant.session_id = p_session_id
      and participant.student_id = p_student_id
  ) then
    raise exception using errcode = '42501', message = 'attendance_student_not_participant';
  end if;

  select setting.value into policy_value
  from public.app_settings as setting
  where setting.key = 'attendance_policy';
  lock_hours := coalesce((policy_value ->> 'attendance_lock_hours')::integer, 48);
  attendance_deadline := session_row.ends_at + pg_catalog.make_interval(hours => lock_hours);
  if not actor_is_admin and statement_timestamp() > attendance_deadline then
    raise exception using errcode = 'P0001', message = 'attendance_locked';
  end if;

  select attendance.* into existing_row
  from public.attendance as attendance
  where attendance.session_id = p_session_id
    and attendance.student_id = p_student_id
  for update;

  if existing_row.id is not null then
    if existing_row.status = p_status then
      return existing_row;
    end if;
    if reason_value is null or char_length(reason_value) not between 2 and 1000 then
      raise exception using errcode = '22023', message = 'attendance_correction_reason_required';
    end if;
    if session_row.format = 'individual'
      and (
        existing_row.status not in ('present', 'late')
        or p_status not in ('present', 'late')
      ) then
      raise exception using
        errcode = 'P0001',
        message = 'attendance_financial_correction_requires_admin_adjustment';
    end if;

    update public.attendance
    set status = p_status,
        correction_reason = reason_value,
        recorded_by = actor_id,
        recorded_at = statement_timestamp()
    where id = existing_row.id
    returning * into saved_row;
    return saved_row;
  end if;

  insert into public.attendance (
    session_id,
    student_id,
    status,
    recorded_by,
    locked_at
  )
  values (
    p_session_id,
    p_student_id,
    p_status,
    actor_id,
    attendance_deadline
  )
  returning * into saved_row;

  if session_row.format = 'individual' and p_student_id = session_row.student_id then
    perform private.apply_attendance_effects(p_session_id);
  end if;

  return saved_row;
end;
$$;

revoke execute on function public.record_student_attendance(uuid, uuid, public.attendance_status, text)
from public, anon, service_role;
grant execute on function public.record_student_attendance(uuid, uuid, public.attendance_status, text)
to authenticated;

create or replace function public.get_attendance_report(
  p_period text,
  p_anchor date default current_date
)
returns table (
  entity_type text,
  entity_id uuid,
  entity_name text,
  scheduled_count bigint,
  attended_count bigint,
  absent_count bigint,
  adherence_percent numeric
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor_role public.user_role := (select public.auth_role());
  range_start date;
  range_end date;
  instant_start timestamptz;
  instant_end timestamptz;
begin
  if actor_role is distinct from 'admin'::public.user_role then
    raise exception using errcode = '42501', message = 'attendance_report_forbidden';
  end if;
  if not (select public.is_admin()) then
    raise exception using errcode = '42501', message = 'mfa_required';
  end if;

  if p_period = 'daily' then
    range_start := p_anchor;
    range_end := p_anchor + 1;
  elsif p_period = 'weekly' then
    range_start := date_trunc('week', p_anchor::timestamp)::date;
    range_end := range_start + 7;
  elsif p_period = 'monthly' then
    range_start := date_trunc('month', p_anchor::timestamp)::date;
    range_end := (range_start + interval '1 month')::date;
  else
    raise exception using errcode = '22023', message = 'invalid_attendance_report_period';
  end if;

  instant_start := range_start::timestamp at time zone 'Africa/Cairo';
  instant_end := range_end::timestamp at time zone 'Africa/Cairo';

  return query
  with period_sessions as (
    select session.id, session.teacher_id
    from public.sessions as session
    where session.scheduled_at >= instant_start
      and session.scheduled_at < instant_end
      and session.status not in ('cancelled', 'rescheduled')
  ), participant_rows as (
    select
      period.id as session_id,
      participant.student_id,
      attendance.status as attendance_status
    from period_sessions as period
    join public.session_participants as participant on participant.session_id = period.id
    left join public.attendance as attendance
      on attendance.session_id = period.id
      and attendance.student_id = participant.student_id
  ), student_rows as (
    select
      'student'::text as row_type,
      student.id as row_id,
      student.full_name as row_name,
      count(*) filter (
        where participant.attendance_status not in (
          'teacher_absent', 'cancelled_teacher', 'cancelled_admin'
        ) or participant.attendance_status is null
      ) as row_scheduled,
      count(*) filter (where participant.attendance_status in ('present', 'late')) as row_attended,
      count(*) filter (
        where participant.attendance_status in ('student_absent', 'student_excused')
      ) as row_absent
    from participant_rows as participant
    join public.students as student on student.id = participant.student_id
    group by student.id, student.full_name
  ), teacher_rows as (
    select
      'teacher'::text as row_type,
      teacher.id as row_id,
      profile.full_name as row_name,
      count(*) as row_scheduled,
      count(*) filter (where teacher_attendance.status in ('present', 'late')) as row_attended,
      count(*) filter (where teacher_attendance.status in ('absent', 'excused')) as row_absent
    from period_sessions as period
    join public.teachers as teacher on teacher.id = period.teacher_id
    join public.profiles as profile on profile.id = teacher.profile_id
    left join public.teacher_attendance as teacher_attendance
      on teacher_attendance.session_id = period.id
    group by teacher.id, profile.full_name
  ), combined as (
    select * from student_rows
    union all
    select * from teacher_rows
  )
  select
    combined.row_type,
    combined.row_id,
    combined.row_name,
    combined.row_scheduled,
    combined.row_attended,
    combined.row_absent,
    case
      when combined.row_scheduled = 0 then 0::numeric
      else round((combined.row_attended::numeric / combined.row_scheduled::numeric) * 100, 1)
    end
  from combined
  order by combined.row_type, combined.row_name, combined.row_id;
end;
$$;

revoke execute on function public.get_attendance_report(text, date)
from public, anon, service_role;
grant execute on function public.get_attendance_report(text, date)
to authenticated;

insert into supabase_migrations.schema_migrations(version, statements, name) values ('20261102116000', array[]::text[], 'add_participant_student_attendance') on conflict (version) do nothing;
-- END MIGRATION 20261102116000_add_participant_student_attendance.sql
-- BEGIN MIGRATION 20261102117000_allow_substitute_session_participants.sql
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
  if new.is_primary and new.assignment_id is distinct from session_row.assignment_id then
    raise exception using errcode = '23514', message = 'participant_primary_assignment_mismatch';
  end if;

  if new.assignment_id is not null then
    select assignment.* into assignment_row
    from public.teacher_assignments as assignment
    where assignment.id = new.assignment_id;

    if assignment_row.id is null
      or assignment_row.student_id is distinct from new.student_id
      or assignment_row.status not in ('active', 'paused')
      or (
        not new.is_primary
        and assignment_row.teacher_id is distinct from session_row.teacher_id
        and assignment_row.teacher_id is distinct from session_row.original_teacher_id
      ) then
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

insert into supabase_migrations.schema_migrations(version, statements, name) values ('20261102117000', array[]::text[], 'allow_substitute_session_participants') on conflict (version) do nothing;
-- END MIGRATION 20261102117000_allow_substitute_session_participants.sql
-- BEGIN MIGRATION 20261102118000_fix_makeup_period_cap.sql
create or replace function private.apply_attendance_effects(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  attendance_row public.attendance%rowtype;
  session_row public.sessions%rowtype;
  subscription_row public.subscriptions%rowtype;
  selected_rate public.teacher_rates%rowtype;
  track_value uuid;
  consume_credit boolean := false;
  pay_teacher boolean := false;
  timely_excuse boolean := false;
  grant_makeup boolean := false;
  outside_cap boolean := false;
  cancel_notice_hours integer;
  max_makeups integer;
  makeup_valid_days integer;
  capped_makeups integer;
  payout_kind text;
  target_status public.session_status;
  admin_profile record;
begin
  select * into attendance_row
  from public.attendance
  where session_id = p_session_id;

  select * into session_row
  from public.sessions
  where id = p_session_id
  for update;

  if attendance_row.session_id is null or session_row.id is null then
    raise exception using errcode = 'P0002', message = 'attendance_session_not_found';
  end if;

  select subscription.* into subscription_row
  from public.subscriptions as subscription
  where subscription.student_id = session_row.student_id
    and subscription.status in ('trial', 'active')
    and session_row.scheduled_at::date between subscription.current_period_start and subscription.current_period_end
  order by subscription.current_period_start desc
  limit 1
  for update;

  if subscription_row.id is null then
    raise exception using errcode = 'P0001', message = 'active_subscription_required';
  end if;

  cancel_notice_hours := (subscription_row.policy_snapshot ->> 'cancel_notice_hours')::integer;
  max_makeups := (subscription_row.policy_snapshot ->> 'max_makeups_per_period')::integer;
  makeup_valid_days := (subscription_row.policy_snapshot ->> 'makeup_valid_days')::integer;
  timely_excuse := attendance_row.status = 'student_excused'
    and attendance_row.student_notice_at is not null
    and attendance_row.student_notice_at <= session_row.scheduled_at - pg_catalog.make_interval(hours => cancel_notice_hours);

  consume_credit := case attendance_row.status
    when 'present' then true
    when 'late' then true
    when 'student_absent' then (subscription_row.policy_snapshot ->> 'student_no_show_consumes_credit')::boolean
    when 'student_excused' then not timely_excuse and (subscription_row.policy_snapshot ->> 'student_no_show_consumes_credit')::boolean
    else false
  end;

  pay_teacher := case attendance_row.status
    when 'present' then true
    when 'late' then true
    when 'student_absent' then (subscription_row.policy_snapshot ->> 'student_no_show_pays_teacher')::boolean
    when 'student_excused' then not timely_excuse and (subscription_row.policy_snapshot ->> 'student_no_show_pays_teacher')::boolean
    else false
  end;

  target_status := case attendance_row.status
    when 'present' then 'held'::public.session_status
    when 'late' then 'held'::public.session_status
    when 'student_absent' then 'missed'::public.session_status
    when 'student_excused' then 'missed'::public.session_status
    when 'teacher_absent' then 'missed'::public.session_status
    else 'cancelled'::public.session_status
  end;

  update public.sessions
  set status = target_status,
      started_at = coalesce(started_at, attendance_row.teacher_joined_at),
      ended_at = case
        when attendance_row.teacher_joined_at is not null and attendance_row.minutes is not null
          then attendance_row.teacher_joined_at + pg_catalog.make_interval(mins => attendance_row.minutes)
        else ended_at
      end
  where id = p_session_id;

  if consume_credit then
    insert into public.session_credit_ledger (
      subscription_id, delta, reason, session_id, note, created_by
    )
    values (
      subscription_row.id, -1, 'consume', p_session_id, 'attendance_effect', attendance_row.recorded_by
    )
    on conflict (session_id) where reason = 'consume' do nothing;
  end if;

  if pay_teacher then
    if session_row.assignment_id is not null then
      select assignment.track_id into track_value
      from public.teacher_assignments as assignment
      where assignment.id = session_row.assignment_id;
    end if;

    select rate.* into selected_rate
    from public.teacher_rates as rate
    where rate.teacher_id = session_row.teacher_id
      and rate.valid_from <= session_row.scheduled_at::date
      and (rate.track_id is null or rate.track_id = track_value)
      and (rate.duration_min is null or rate.duration_min = session_row.duration_min)
    order by
      ((rate.track_id is not null)::integer + (rate.duration_min is not null)::integer) desc,
      rate.valid_from desc,
      rate.id
    limit 1;

    if selected_rate.id is null then
      raise exception using errcode = 'P0001', message = 'teacher_rate_missing';
    end if;

    payout_kind := case
      when session_row.kind = 'makeup' then 'makeup'
      when session_row.original_teacher_id is not null and session_row.original_teacher_id <> session_row.teacher_id then 'substitute'
      when attendance_row.status in ('student_absent', 'student_excused') then 'no_show'
      else 'session'
    end;

    insert into public.teacher_payout_items (
      session_id, teacher_id, amount, currency, rate_snapshot, kind
    )
    values (
      p_session_id, session_row.teacher_id, selected_rate.rate_per_session,
      selected_rate.currency, selected_rate.rate_per_session, payout_kind
    )
    on conflict (session_id) do nothing;
  end if;

  if timely_excuse then
    select count(*)::integer into capped_makeups
    from public.makeup_entitlements as entitlement
    join public.sessions as source_session
      on source_session.id = entitlement.source_session_id
    where entitlement.subscription_id = subscription_row.id
      and not entitlement.outside_period_cap
      and source_session.scheduled_at::date between
        subscription_row.current_period_start and subscription_row.current_period_end;

    grant_makeup := capped_makeups < max_makeups;
  elsif attendance_row.status in ('teacher_absent', 'cancelled_teacher', 'cancelled_admin') then
    grant_makeup := true;
    outside_cap := true;
  end if;

  if grant_makeup then
    insert into public.makeup_entitlements (
      subscription_id, student_id, source_session_id, outside_period_cap, expires_at
    )
    values (
      subscription_row.id,
      session_row.student_id,
      p_session_id,
      outside_cap,
      attendance_row.recorded_at + pg_catalog.make_interval(days => makeup_valid_days)
    )
    on conflict (source_session_id) do nothing;
  end if;

  if attendance_row.status = 'student_absent'
    or (attendance_row.status = 'student_excused' and not timely_excuse) then
    perform private.notify_session_parties(
      session_row.student_id,
      'student_absent',
      pg_catalog.jsonb_build_object('session_id', p_session_id)
    );
  end if;

  if attendance_row.status = 'teacher_absent' then
    for admin_profile in
      select profile.id
      from public.profiles as profile
      where profile.role = 'admin' and profile.is_active
    loop
      perform private.enqueue_notification(
        admin_profile.id,
        'teacher_absent',
        pg_catalog.jsonb_build_object('session_id', p_session_id)
      );
    end loop;

    perform private.notify_session_parties(
      session_row.student_id,
      'teacher_absent',
      pg_catalog.jsonb_build_object('session_id', p_session_id)
    );
  end if;
end;
$$;

revoke execute on function private.apply_attendance_effects(uuid)
from public, anon, authenticated, service_role;

insert into supabase_migrations.schema_migrations(version, statements, name) values ('20261102118000', array[]::text[], 'fix_makeup_period_cap') on conflict (version) do nothing;
-- END MIGRATION 20261102118000_fix_makeup_period_cap.sql
-- BEGIN MIGRATION 20261103090000_add_teacher_student_notes.sql
create table public.teacher_student_notes (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  teacher_id uuid not null references public.teachers(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 2 and 2000),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index teacher_student_notes_scope_idx
on public.teacher_student_notes (teacher_id, student_id, created_at desc);

create trigger teacher_student_notes_set_updated_at
before update on public.teacher_student_notes
for each row execute function public.set_updated_at();

create trigger teacher_student_notes_audit
after insert or update or delete on public.teacher_student_notes
for each row execute function public.audit_row();

alter table public.teacher_student_notes enable row level security;
revoke all on public.teacher_student_notes from public, anon, authenticated;
grant select, insert, update, delete on public.teacher_student_notes to authenticated;
grant select, insert, update, delete on public.teacher_student_notes to service_role;

create policy teacher_student_notes_admin_all
on public.teacher_student_notes
for all to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

create policy teacher_student_notes_teacher_read
on public.teacher_student_notes
for select to authenticated
using (
  teacher_id = (select private.current_teacher_id())
  and (select private.teaches_student(student_id))
);

create policy teacher_student_notes_teacher_insert
on public.teacher_student_notes
for insert to authenticated
with check (
  teacher_id = (select private.current_teacher_id())
  and created_by = (select auth.uid())
  and (select private.teaches_student(student_id))
);

create policy teacher_student_notes_teacher_update
on public.teacher_student_notes
for update to authenticated
using (
  teacher_id = (select private.current_teacher_id())
  and created_by = (select auth.uid())
  and (select private.teaches_student(student_id))
)
with check (
  teacher_id = (select private.current_teacher_id())
  and created_by = (select auth.uid())
  and (select private.teaches_student(student_id))
);

create policy teacher_student_notes_teacher_delete
on public.teacher_student_notes
for delete to authenticated
using (
  teacher_id = (select private.current_teacher_id())
  and created_by = (select auth.uid())
  and (select private.teaches_student(student_id))
);

insert into supabase_migrations.schema_migrations(version, statements, name) values ('20261103090000', array[]::text[], 'add_teacher_student_notes') on conflict (version) do nothing;
-- END MIGRATION 20261103090000_add_teacher_student_notes.sql
-- BEGIN MIGRATION 20261103091000_require_fresh_zoom_after_reschedule.sql
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

insert into supabase_migrations.schema_migrations(version, statements, name) values ('20261103091000', array[]::text[], 'require_fresh_zoom_after_reschedule') on conflict (version) do nothing;
-- END MIGRATION 20261103091000_require_fresh_zoom_after_reschedule.sql
-- BEGIN MIGRATION 20261103092000_add_admin_task_ownership_and_saved_views.sql
alter table public.intervention_cases
  add column assigned_to uuid references public.profiles(id) on delete restrict,
  add column due_at timestamptz;

create index intervention_cases_owner_due_idx
on public.intervention_cases (assigned_to, due_at, priority desc)
where status in ('open', 'acknowledged');

create table public.admin_saved_views (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  page_key text not null check (page_key ~ '^[a-z][a-z0-9_-]{2,63}$'),
  name text not null check (char_length(btrim(name)) between 2 and 80),
  query_params jsonb not null default '{}'::jsonb check (jsonb_typeof(query_params) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profile_id, page_key, name)
);

create index admin_saved_views_profile_page_idx
on public.admin_saved_views (profile_id, page_key, updated_at desc);

create trigger admin_saved_views_set_updated_at
before update on public.admin_saved_views
for each row execute function public.set_updated_at();

create trigger admin_saved_views_audit
after insert or update or delete on public.admin_saved_views
for each row execute function public.audit_row();

alter table public.admin_saved_views enable row level security;
revoke all on public.admin_saved_views from public, anon, authenticated;
grant select, insert, update, delete on public.admin_saved_views to authenticated;
grant select, insert, update, delete on public.admin_saved_views to service_role;

create policy admin_saved_views_read_own
on public.admin_saved_views for select to authenticated
using ((select public.is_admin()) and profile_id = (select auth.uid()));

create policy admin_saved_views_insert_own
on public.admin_saved_views for insert to authenticated
with check ((select public.is_admin()) and profile_id = (select auth.uid()));

create policy admin_saved_views_update_own
on public.admin_saved_views for update to authenticated
using ((select public.is_admin()) and profile_id = (select auth.uid()))
with check ((select public.is_admin()) and profile_id = (select auth.uid()));

create policy admin_saved_views_delete_own
on public.admin_saved_views for delete to authenticated
using ((select public.is_admin()) and profile_id = (select auth.uid()));

create or replace function public.assign_intervention_case(
  p_case uuid,
  p_assignee uuid,
  p_due_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or not (select public.is_admin()) then
    raise exception using errcode = '42501', message = 'admin_mfa_required';
  end if;
  if p_case is null or p_assignee is null or p_due_at is null or p_due_at <= now() then
    raise exception using errcode = '22023', message = 'intervention_assignment_invalid';
  end if;
  if not exists (
    select 1 from public.profiles
    where id = p_assignee and role = 'admin' and is_active
  ) then
    raise exception using errcode = '22023', message = 'intervention_assignee_invalid';
  end if;
  update public.intervention_cases
  set assigned_to = p_assignee, due_at = p_due_at
  where id = p_case and status in ('open', 'acknowledged');
  if not found then
    raise exception using errcode = 'P0002', message = 'intervention_case_not_assignable';
  end if;
end;
$$;

revoke all on function public.assign_intervention_case(uuid, uuid, timestamptz)
from public, anon, authenticated, service_role;
grant execute on function public.assign_intervention_case(uuid, uuid, timestamptz)
to authenticated;

comment on column public.intervention_cases.assigned_to is
'Active administrator responsible for the intervention follow-up.';
comment on column public.intervention_cases.due_at is
'Operational follow-up deadline; it does not alter intervention detection or escalation rules.';
comment on table public.admin_saved_views is
'Per-administrator URL filter presets for existing admin pages.';

insert into supabase_migrations.schema_migrations(version, statements, name) values ('20261103092000', array[]::text[], 'add_admin_task_ownership_and_saved_views') on conflict (version) do nothing;
-- END MIGRATION 20261103092000_add_admin_task_ownership_and_saved_views.sql
