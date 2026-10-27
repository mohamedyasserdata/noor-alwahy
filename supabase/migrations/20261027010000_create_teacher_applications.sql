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
