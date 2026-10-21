create table public.applications (
  id uuid primary key default gen_random_uuid(),
  order_no text unique not null check (order_no ~ '^NW-A-[A-F0-9]{20}$'),
  status public.application_status not null default 'new',
  student_name text not null check (char_length(btrim(student_name)) between 2 and 160),
  student_gender public.gender_t not null,
  student_age smallint not null check (student_age between 3 and 100),
  guardian_name text check (guardian_name is null or char_length(btrim(guardian_name)) between 2 and 160),
  contact_email text check (contact_email is null or char_length(contact_email) between 5 and 254),
  contact_phone text check (contact_phone is null or char_length(contact_phone) between 7 and 30),
  country_code char(2) references public.countries(code) on delete restrict,
  timezone text not null check (char_length(btrim(timezone)) between 1 and 100),
  track_id uuid references public.tracks(id) on delete restrict,
  package_id uuid references public.packages(id) on delete restrict,
  self_level text not null check (self_level in ('beginner','intermediate','advanced','memorizing')),
  preferred_times jsonb not null check (jsonb_typeof(preferred_times) = 'array' and jsonb_array_length(preferred_times) between 1 and 7),
  preferred_teacher_gender public.gender_t,
  notes text check (notes is null or char_length(notes) <= 2000),
  consent_version text not null check (char_length(consent_version) between 1 and 40),
  consent_at timestamptz not null default now(),
  source text not null default 'website' check (char_length(source) between 1 and 80),
  internal_notes text check (internal_notes is null or char_length(internal_notes) <= 5000),
  converted_student_id uuid references public.students(id) on delete restrict,
  lookup_hash char(64) not null check (lookup_hash ~ '^[a-f0-9]{64}$'),
  request_ip_hash char(64) not null check (request_ip_hash ~ '^[a-f0-9]{64}$'),
  contact_hash char(64) not null check (contact_hash ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (contact_email is not null or contact_phone is not null),
  check (student_age >= 18 or guardian_name is not null),
  check (preferred_teacher_gender is null or preferred_teacher_gender = student_gender)
);

create index applications_status_created_idx on public.applications (status, created_at desc);
create index applications_ip_rate_idx on public.applications (request_ip_hash, created_at desc);
create index applications_contact_rate_idx on public.applications (contact_hash, created_at desc);
create index applications_order_lookup_idx on public.applications (order_no, lookup_hash);

create trigger applications_set_updated_at before update on public.applications
for each row execute function public.set_updated_at();

create or replace function public.audit_application_workflow()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if old.status is distinct from new.status
    or old.internal_notes is distinct from new.internal_notes
    or old.converted_student_id is distinct from new.converted_student_id then
    insert into public.audit_logs(user_id, action, table_name, record_id, before, after, ip)
    values (
      (select auth.uid()), 'UPDATE', 'applications', new.id::text,
      jsonb_build_object('status', old.status, 'has_internal_notes', old.internal_notes is not null, 'converted_student_id', old.converted_student_id),
      jsonb_build_object('status', new.status, 'has_internal_notes', new.internal_notes is not null, 'converted_student_id', new.converted_student_id),
      inet_client_addr()
    );
  end if;
  return new;
end;
$$;
revoke execute on function public.audit_application_workflow() from public, anon, authenticated, service_role;
create trigger applications_audit_workflow after update on public.applications
for each row execute function public.audit_application_workflow();

alter table public.applications enable row level security;
revoke all on public.applications from public, anon, authenticated, service_role;
grant select, update on public.applications to authenticated;

create policy applications_admin_read on public.applications for select to authenticated
using ((select public.is_admin()));
create policy applications_admin_update on public.applications for update to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));

create or replace function public.submit_application(
  p_payload jsonb,
  p_lookup_hash text,
  p_ip_hash text,
  p_contact_hash text
)
returns text language plpgsql security definer set search_path = ''
as $$
declare
  generated_order text;
begin
  if current_user not in ('service_role', 'postgres') then
    raise exception using errcode = '42501', message = 'service_role_required';
  end if;
  if p_lookup_hash !~ '^[a-f0-9]{64}$' or p_ip_hash !~ '^[a-f0-9]{64}$' or p_contact_hash !~ '^[a-f0-9]{64}$' then
    raise exception using errcode = '22023', message = 'application_hash_invalid';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_ip_hash, 0));
  if (select count(*) from public.applications where request_ip_hash = p_ip_hash and created_at > now() - interval '1 hour') >= 5
    or (select count(*) from public.applications where contact_hash = p_contact_hash and created_at > now() - interval '1 day') >= 3 then
    raise exception using errcode = 'P0001', message = 'application_rate_limited';
  end if;
  if nullif(p_payload ->> 'package_id', '') is not null and not exists (
    select 1 from public.packages where id = (p_payload ->> 'package_id')::uuid and is_active and is_published
  ) then raise exception using errcode = '23503', message = 'package_unavailable'; end if;
  if nullif(p_payload ->> 'track_id', '') is not null and not exists (
    select 1 from public.tracks where id = (p_payload ->> 'track_id')::uuid and is_active
  ) then raise exception using errcode = '23503', message = 'track_unavailable'; end if;

  generated_order := 'NW-A-' || upper(encode(extensions.gen_random_bytes(10), 'hex'));
  insert into public.applications(
    order_no, student_name, student_gender, student_age, guardian_name, contact_email, contact_phone,
    country_code, timezone, track_id, package_id, self_level, preferred_times,
    preferred_teacher_gender, notes, consent_version, source, lookup_hash, request_ip_hash, contact_hash
  ) values (
    generated_order, p_payload ->> 'student_name', (p_payload ->> 'student_gender')::public.gender_t,
    (p_payload ->> 'student_age')::smallint, nullif(p_payload ->> 'guardian_name', ''),
    nullif(p_payload ->> 'contact_email', ''), nullif(p_payload ->> 'contact_phone', ''),
    nullif(p_payload ->> 'country_code', ''), p_payload ->> 'timezone',
    nullif(p_payload ->> 'track_id', '')::uuid, nullif(p_payload ->> 'package_id', '')::uuid,
    p_payload ->> 'self_level', p_payload -> 'preferred_times',
    nullif(p_payload ->> 'preferred_teacher_gender', '')::public.gender_t,
    nullif(p_payload ->> 'notes', ''), p_payload ->> 'consent_version',
    coalesce(nullif(p_payload ->> 'source', ''), 'website'), p_lookup_hash, p_ip_hash, p_contact_hash
  );
  return generated_order;
end;
$$;

revoke execute on function public.submit_application(jsonb,text,text,text) from public, anon, authenticated;
grant execute on function public.submit_application(jsonb,text,text,text) to service_role;
