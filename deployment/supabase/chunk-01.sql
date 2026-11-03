-- Generated staging deployment bundle. Source of truth remains supabase/migrations/.
-- BEGIN MIGRATION 20261018050000_create_identity_foundation.sql
create extension if not exists btree_gist with schema extensions;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_trgm with schema extensions;

create type public.user_role as enum ('admin', 'teacher', 'student', 'parent');
create type public.gender_t as enum ('male', 'female');
create type public.student_status as enum ('active', 'dropped', 'graduated', 'suspended', 'archived');
create type public.assignment_status as enum ('active', 'paused', 'ended');
create type public.session_status as enum ('scheduled', 'held', 'missed', 'cancelled', 'rescheduled');
create type public.session_kind as enum ('regular', 'trial', 'makeup', 'extra');
create type public.attendance_status as enum (
  'present',
  'late',
  'student_absent',
  'student_excused',
  'teacher_absent',
  'cancelled_teacher',
  'cancelled_admin'
);
create type public.session_type_t as enum (
  'new_memo',
  'near_review',
  'far_review',
  'recitation',
  'noorani',
  'matn_theory'
);
create type public.subscription_status as enum ('trial', 'active', 'paused', 'expired', 'cancelled');
create type public.invoice_status as enum ('draft', 'issued', 'partially_paid', 'paid', 'overdue', 'void');
create type public.payment_status as enum ('pending_confirmation', 'confirmed', 'rejected');
create type public.payment_kind as enum ('payment', 'refund');
create type public.payout_status as enum ('accruing', 'due', 'approved', 'paid');
create type public.progress_status as enum ('not_started', 'in_progress', 'mastered', 'needs_review');
create type public.application_status as enum ('new', 'contacted', 'trial_booked', 'accepted', 'rejected', 'postponed');
create type public.billing_period as enum ('monthly', 'quarterly', 'yearly');
create type public.report_status as enum ('draft', 'approved', 'admin_review', 'visible');

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = pg_catalog.clock_timestamp();
  return new;
end;
$$;

revoke execute on function public.set_updated_at() from public, anon, authenticated;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete restrict,
  role public.user_role not null,
  full_name text not null constraint profiles_full_name_not_blank check (btrim(full_name) <> ''),
  display_name text constraint profiles_display_name_not_blank check (display_name is null or btrim(display_name) <> ''),
  avatar_url text,
  country_code character(2) constraint profiles_country_code_format check (
    country_code is null or country_code ~ '^[A-Z]{2}$'
  ),
  timezone text not null default 'Africa/Cairo' constraint profiles_timezone_not_blank check (btrim(timezone) <> ''),
  preferred_locale text not null default 'ar' constraint profiles_preferred_locale_allowed check (
    preferred_locale in ('ar', 'en')
  ),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profile_private (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  phone text,
  contact_email text,
  address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger profile_private_set_updated_at
before update on public.profile_private
for each row execute function public.set_updated_at();

create or replace function public.auth_role()
returns public.user_role
language sql
stable
security definer
set search_path = ''
as $$
  select profile.role
  from public.profiles as profile
  where profile.id = (select auth.uid())
    and profile.is_active
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select public.auth_role()) = 'admin'::public.user_role, false)
$$;

revoke execute on function public.auth_role() from public, anon;
revoke execute on function public.is_admin() from public, anon;
grant execute on function public.auth_role() to authenticated, service_role;
grant execute on function public.is_admin() to authenticated, service_role;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_role_text text := new.raw_app_meta_data ->> 'role';
  requested_role public.user_role;
  requested_full_name text := nullif(pg_catalog.btrim(new.raw_user_meta_data ->> 'full_name'), '');
  requested_display_name text := nullif(pg_catalog.btrim(new.raw_user_meta_data ->> 'display_name'), '');
begin
  if requested_role_text is null
    or requested_role_text not in ('admin', 'teacher', 'student', 'parent') then
    raise exception using
      errcode = '22023',
      message = 'profile_role_required';
  end if;

  if requested_full_name is null then
    raise exception using
      errcode = '22023',
      message = 'profile_full_name_required';
  end if;

  requested_role := requested_role_text::public.user_role;

  insert into public.profiles (id, role, full_name, display_name)
  values (new.id, requested_role, requested_full_name, requested_display_name);

  insert into public.profile_private (profile_id, phone, contact_email)
  values (new.id, new.phone, new.email);

  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.profile_private enable row level security;

revoke all on table public.profiles from public, anon;
revoke all on table public.profile_private from public, anon;
grant select, insert, update, delete on table public.profiles to authenticated, service_role;
grant select, insert, update, delete on table public.profile_private to authenticated, service_role;

create policy profiles_admin_all
on public.profiles
for all
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

create policy profiles_read_own
on public.profiles
for select
to authenticated
using (id = (select auth.uid()));

create policy profile_private_admin_all
on public.profile_private
for all
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

create policy profile_private_read_own
on public.profile_private
for select
to authenticated
using (
  profile_id = (select auth.uid())
  and (select public.auth_role()) is not null
);

create policy profile_private_update_own
on public.profile_private
for update
to authenticated
using (
  profile_id = (select auth.uid())
  and (select public.auth_role()) is not null
)
with check (
  profile_id = (select auth.uid())
  and (select public.auth_role()) is not null
);

insert into supabase_migrations.schema_migrations(version, statements, name) values ('20261018050000', array[]::text[], 'create_identity_foundation') on conflict (version) do nothing;
-- END MIGRATION 20261018050000_create_identity_foundation.sql
-- BEGIN MIGRATION 20261018060000_create_audit_log.sql
create table public.audit_logs (
  id bigserial primary key,
  user_id uuid,
  action text not null,
  table_name text,
  record_id text,
  before jsonb,
  after jsonb,
  ip inet,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index audit_logs_record_lookup_idx
on public.audit_logs (table_name, record_id, created_at desc);

create trigger audit_logs_set_updated_at
before update on public.audit_logs
for each row execute function public.set_updated_at();

create or replace function public.audit_row()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  previous_row jsonb;
  current_row jsonb;
  audited_record_id text;
begin
  if tg_op = 'INSERT' then
    current_row := to_jsonb(new);
  elsif tg_op = 'UPDATE' then
    previous_row := to_jsonb(old);
    current_row := to_jsonb(new);
  elsif tg_op = 'DELETE' then
    previous_row := to_jsonb(old);
  else
    raise exception using
      errcode = '0A000',
      message = 'audit_operation_not_supported';
  end if;

  audited_record_id := coalesce(
    current_row ->> 'id',
    previous_row ->> 'id',
    current_row ->> 'profile_id',
    previous_row ->> 'profile_id',
    current_row ->> 'key',
    previous_row ->> 'key'
  );

  insert into public.audit_logs (
    user_id,
    action,
    table_name,
    record_id,
    before,
    after,
    ip
  )
  values (
    (select auth.uid()),
    tg_op,
    tg_table_name,
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

revoke execute on function public.audit_row() from public, anon, authenticated, service_role;

create trigger profiles_audit_role_or_status
after update of role, is_active on public.profiles
for each row
when (
  old.role is distinct from new.role
  or old.is_active is distinct from new.is_active
)
execute function public.audit_row();

alter table public.audit_logs enable row level security;

revoke all on table public.audit_logs from public, anon, authenticated, service_role;
revoke all on sequence public.audit_logs_id_seq from public, anon, authenticated, service_role;
grant select on table public.audit_logs to authenticated, service_role;

create policy audit_logs_admin_read
on public.audit_logs
for select
to authenticated
using ((select public.is_admin()));

insert into supabase_migrations.schema_migrations(version, statements, name) values ('20261018060000', array[]::text[], 'create_audit_log') on conflict (version) do nothing;
-- END MIGRATION 20261018060000_create_audit_log.sql
-- BEGIN MIGRATION 20261018110000_secure_account_management.sql
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_role_text text := new.raw_app_meta_data ->> 'role';
  requested_role public.user_role;
  requested_full_name text := nullif(pg_catalog.btrim(new.raw_user_meta_data ->> 'full_name'), '');
  requested_display_name text := nullif(pg_catalog.btrim(new.raw_user_meta_data ->> 'display_name'), '');
  created_by_text text := nullif(new.raw_user_meta_data ->> 'created_by', '');
  created_by_id uuid;
begin
  if exists (select 1 from public.profiles where id = new.id) then
    return new;
  end if;

  if requested_role_text is null and new.invited_at is not null then
    requested_role_text := new.raw_user_meta_data ->> 'role';
  end if;

  -- GoTrue's admin endpoint first inserts the auth row, then applies trusted
  -- app metadata. Keep that intermediate row unable to sign in to the portal;
  -- the update trigger below provisions the profile once the role is present.
  if requested_role_text is null then
    return new;
  end if;

  if requested_role_text not in ('admin', 'teacher', 'student', 'parent') then
    raise exception using
      errcode = '22023',
      message = 'profile_role_required';
  end if;

  if requested_full_name is null then
    raise exception using
      errcode = '22023',
      message = 'profile_full_name_required';
  end if;

  if created_by_text is not null then
    begin
      created_by_id := created_by_text::uuid;
    exception when invalid_text_representation then
      raise exception using errcode = '22023', message = 'provisioning_admin_required';
    end;

    if not exists (
      select 1
      from public.profiles as actor
      where actor.id = created_by_id
        and actor.role = 'admin'::public.user_role
        and actor.is_active
    ) then
      raise exception using errcode = '42501', message = 'provisioning_admin_required';
    end if;
  end if;

  requested_role := requested_role_text::public.user_role;

  insert into public.profiles (id, role, full_name, display_name)
  values (new.id, requested_role, requested_full_name, requested_display_name);

  insert into public.profile_private (profile_id, phone, contact_email)
  values (new.id, new.phone, new.email);

  if created_by_id is not null then
    insert into public.audit_logs (user_id, action, table_name, record_id, after)
    values (
      created_by_id,
      'INSERT',
      'profiles',
      new.id::text,
      jsonb_build_object(
        'id', new.id,
        'role', requested_role,
        'full_name', requested_full_name,
        'display_name', requested_display_name,
        'is_active', true
      )
    );
  end if;

  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_provisioning_updated on auth.users;
create trigger on_auth_user_provisioning_updated
after update of raw_app_meta_data, raw_user_meta_data, invited_at on auth.users
for each row execute function public.handle_new_user();

create or replace function public.set_account_active(p_profile_id uuid, p_is_active boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select public.is_admin()) then
    raise exception using errcode = '42501', message = 'admin_required';
  end if;

  if p_profile_id = (select auth.uid()) and not p_is_active then
    raise exception using errcode = '23514', message = 'admin_cannot_disable_self';
  end if;

  update public.profiles
  set is_active = p_is_active
  where id = p_profile_id;

  if not found then
    raise exception using errcode = 'P0002', message = 'profile_not_found';
  end if;

  if not p_is_active then
    delete from auth.sessions where user_id = p_profile_id;
  end if;
end;
$$;

revoke execute on function public.set_account_active(uuid, boolean) from public, anon, service_role;
grant execute on function public.set_account_active(uuid, boolean) to authenticated;

insert into supabase_migrations.schema_migrations(version, statements, name) values ('20261018110000', array[]::text[], 'secure_account_management') on conflict (version) do nothing;
-- END MIGRATION 20261018110000_secure_account_management.sql
-- BEGIN MIGRATION 20261018140000_require_admin_mfa.sql
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select public.auth_role()) = 'admin'::public.user_role
      and (select auth.jwt() ->> 'aal') = 'aal2',
    false
  )
$$;

revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated, service_role;

insert into supabase_migrations.schema_migrations(version, statements, name) values ('20261018140000', array[]::text[], 'require_admin_mfa') on conflict (version) do nothing;
-- END MIGRATION 20261018140000_require_admin_mfa.sql
-- BEGIN MIGRATION 20261018160000_create_contact_links.sql
create table public.contact_links (
  id uuid primary key default gen_random_uuid(),
  type text not null check (
    type in ('whatsapp', 'phone', 'email', 'facebook', 'instagram', 'telegram', 'youtube', 'tiktok', 'other')
  ),
  label_ar text not null check (char_length(btrim(label_ar)) between 1 and 100),
  label_en text check (label_en is null or char_length(btrim(label_en)) between 1 and 100),
  url text not null check (
    char_length(url) <= 2048
    and url ~* '^(https://|mailto:|tel:)'
  ),
  sort_order integer not null default 0 check (sort_order >= 0),
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index contact_links_public_order_idx
on public.contact_links (sort_order, created_at, id)
where is_visible;

create trigger contact_links_set_updated_at
before update on public.contact_links
for each row execute function public.set_updated_at();

create trigger contact_links_audit
after insert or update or delete on public.contact_links
for each row execute function public.audit_row();

alter table public.contact_links enable row level security;

revoke all on table public.contact_links from public, anon, authenticated;
grant select on table public.contact_links to anon, authenticated;
grant insert, update, delete on table public.contact_links to authenticated;

create policy contact_links_read_visible
on public.contact_links
for select
to anon, authenticated
using (is_visible);

create policy contact_links_admin_read_all
on public.contact_links
for select
to authenticated
using ((select public.is_admin()));

create policy contact_links_admin_insert
on public.contact_links
for insert
to authenticated
with check ((select public.is_admin()));

create policy contact_links_admin_update
on public.contact_links
for update
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

create policy contact_links_admin_delete
on public.contact_links
for delete
to authenticated
using ((select public.is_admin()));

insert into supabase_migrations.schema_migrations(version, statements, name) values ('20261018160000', array[]::text[], 'create_contact_links') on conflict (version) do nothing;
-- END MIGRATION 20261018160000_create_contact_links.sql
-- BEGIN MIGRATION 20261018180000_create_app_settings.sql
create table public.app_settings (
  key text primary key check (
    char_length(key) between 1 and 100
    and key ~ '^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*$'
  ),
  value jsonb not null check (
    jsonb_typeof(value) = 'object'
    and octet_length(value::text) <= 16384
  ),
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint app_settings_public_shape check (
    (
      key = 'academy_profile'
      and value ?& array['name_ar', 'name_en', 'description_ar', 'description_en', 'logo_url']
      and value - array['name_ar', 'name_en', 'description_ar', 'description_en', 'logo_url'] = '{}'::jsonb
      and jsonb_typeof(value -> 'name_ar') = 'string'
      and jsonb_typeof(value -> 'name_en') = 'string'
      and jsonb_typeof(value -> 'description_ar') = 'string'
      and jsonb_typeof(value -> 'description_en') = 'string'
      and (value -> 'logo_url' = 'null'::jsonb or jsonb_typeof(value -> 'logo_url') = 'string')
      and value ->> 'name_ar' = btrim(value ->> 'name_ar')
      and value ->> 'name_en' = btrim(value ->> 'name_en')
      and value ->> 'description_ar' = btrim(value ->> 'description_ar')
      and value ->> 'description_en' = btrim(value ->> 'description_en')
      and char_length(btrim(value ->> 'name_ar')) between 2 and 120
      and char_length(btrim(value ->> 'name_en')) between 2 and 120
      and char_length(btrim(value ->> 'description_ar')) between 2 and 500
      and char_length(btrim(value ->> 'description_en')) between 2 and 500
      and (
        value ->> 'logo_url' is null
        or (
          char_length(value ->> 'logo_url') between 1 and 2048
          and value ->> 'logo_url' like '/%'
          and value ->> 'logo_url' not like '//%'
          and value ->> 'logo_url' !~ '[^A-Za-z0-9_./-]'
          and not (value ->> 'logo_url' ~ '(^|/)\.\.(/|$)')
        )
      )
    )
    or (
      key = 'support_hours'
      and value ?& array['ar', 'en']
      and value - array['ar', 'en'] = '{}'::jsonb
      and jsonb_typeof(value -> 'ar') = 'string'
      and jsonb_typeof(value -> 'en') = 'string'
      and value ->> 'ar' = btrim(value ->> 'ar')
      and value ->> 'en' = btrim(value ->> 'en')
      and char_length(btrim(value ->> 'ar')) between 2 and 500
      and char_length(btrim(value ->> 'en')) between 2 and 500
    )
    or key not in ('academy_profile', 'support_hours')
  )
);

insert into public.app_settings (key, value)
values
  (
    'academy_profile',
    jsonb_build_object(
      'name_ar', 'أكاديمية نور الوحي',
      'name_en', 'Noor Al-Wahy Academy',
      'description_ar', 'تعليم قرآني منظم بمتابعة آمنة وواضحة.',
      'description_en', 'Structured Quran learning with safe, clear follow-up.',
      'logo_url', null
    )
  ),
  (
    'support_hours',
    jsonb_build_object(
      'ar', 'تكون الاستجابة خلال مواعيد العمل المعلنة للأكاديمية.',
      'en', 'Responses are provided during the academy’s announced working hours.'
    )
  );

create or replace function public.set_app_setting_actor()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_by = auth.uid();
  return new;
end;
$$;

revoke execute on function public.set_app_setting_actor() from public, anon, authenticated;

create trigger app_settings_set_actor
before insert or update on public.app_settings
for each row execute function public.set_app_setting_actor();

create trigger app_settings_set_updated_at
before update on public.app_settings
for each row execute function public.set_updated_at();

create trigger app_settings_audit
after insert or update or delete on public.app_settings
for each row execute function public.audit_row();

alter table public.app_settings enable row level security;

revoke all on table public.app_settings from public, anon, authenticated;
grant select (key, value) on table public.app_settings to anon, authenticated;
grant insert, update, delete on table public.app_settings to authenticated;

create policy app_settings_public_read
on public.app_settings
for select
to anon, authenticated
using (key in ('academy_profile', 'support_hours'));

create policy app_settings_admin_read_all
on public.app_settings
for select
to authenticated
using ((select public.is_admin()));

create policy app_settings_admin_insert
on public.app_settings
for insert
to authenticated
with check ((select public.is_admin()));

create policy app_settings_admin_update
on public.app_settings
for update
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

create policy app_settings_admin_delete
on public.app_settings
for delete
to authenticated
using ((select public.is_admin()));

create or replace function public.update_public_app_settings(
  p_academy_profile jsonb,
  p_support_hours jsonb
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.app_settings
  set value = p_academy_profile
  where key = 'academy_profile';

  if not found then
    raise exception 'academy_profile_missing';
  end if;

  update public.app_settings
  set value = p_support_hours
  where key = 'support_hours';

  if not found then
    raise exception 'support_hours_missing';
  end if;
end;
$$;

revoke execute on function public.update_public_app_settings(jsonb, jsonb) from public, anon;
grant execute on function public.update_public_app_settings(jsonb, jsonb) to authenticated;

insert into supabase_migrations.schema_migrations(version, statements, name) values ('20261018180000', array[]::text[], 'create_app_settings') on conflict (version) do nothing;
-- END MIGRATION 20261018180000_create_app_settings.sql
-- BEGIN MIGRATION 20261018194326_harden_inactive_profile_rls.sql
drop policy if exists profiles_read_own on public.profiles;

create policy profiles_read_own
on public.profiles
for select
to authenticated
using (
  id = (select auth.uid())
  and (select public.auth_role()) is not null
);

insert into supabase_migrations.schema_migrations(version, statements, name) values ('20261018194326', array[]::text[], 'harden_inactive_profile_rls') on conflict (version) do nothing;
-- END MIGRATION 20261018194326_harden_inactive_profile_rls.sql
-- BEGIN MIGRATION 20261018200000_create_people_directory.sql
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

create sequence public.student_no_seq;
revoke all on sequence public.student_no_seq from public, anon, authenticated;

create table public.tracks (
  id uuid primary key default gen_random_uuid(),
  code text unique not null check (code = lower(code) and code ~ '^[a-z0-9][a-z0-9_-]{1,39}$'),
  name_ar text not null check (char_length(btrim(name_ar)) between 2 and 120),
  name_en text check (name_en is null or char_length(btrim(name_en)) between 2 and 120),
  sort_order integer not null default 0 check (sort_order >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.levels (
  id uuid primary key default gen_random_uuid(),
  track_id uuid not null references public.tracks(id) on delete restrict,
  name_ar text not null check (char_length(btrim(name_ar)) between 2 and 120),
  name_en text check (name_en is null or char_length(btrim(name_en)) between 2 and 120),
  sort_order integer not null default 0 check (sort_order >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (track_id, name_ar)
);

create table public.students (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid unique references public.profiles(id) on delete restrict,
  student_no text unique not null default ('NW-' || lpad(nextval('public.student_no_seq')::text, 6, '0')),
  gender public.gender_t not null,
  birth_date date check (birth_date is null or birth_date <= current_date),
  status public.student_status not null default 'active',
  level_id uuid references public.levels(id) on delete restrict,
  joined_at date not null default current_date,
  country_code char(2) check (country_code is null or country_code ~ '^[A-Z]{2}$'),
  timezone text not null default 'Africa/Cairo' check (char_length(btrim(timezone)) between 1 and 100),
  full_name text not null check (char_length(btrim(full_name)) between 2 and 160),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.student_private_notes (
  student_id uuid primary key references public.students(id) on delete cascade,
  health_notes text,
  special_notes text,
  share_with_teacher boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.guardians (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid unique not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.student_guardians (
  student_id uuid not null references public.students(id) on delete cascade,
  guardian_id uuid not null references public.guardians(id) on delete cascade,
  relation text check (relation is null or char_length(btrim(relation)) between 2 and 80),
  is_primary boolean not null default false,
  is_payer boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (student_id, guardian_id)
);

create unique index student_guardians_one_primary_idx
on public.student_guardians (student_id)
where is_primary;

create table public.teachers (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid unique not null references public.profiles(id) on delete restrict,
  gender public.gender_t not null,
  specialization text check (specialization is null or char_length(btrim(specialization)) between 2 and 200),
  ijazah_info jsonb not null default '[]'::jsonb check (jsonb_typeof(ijazah_info) = 'array'),
  max_students integer not null default 15 check (max_students > 0),
  status text not null default 'pending' check (status in ('pending', 'active', 'on_leave', 'inactive')),
  identity_verified_at timestamptz,
  code_of_conduct_accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.teacher_tracks (
  teacher_id uuid not null references public.teachers(id) on delete cascade,
  track_id uuid not null references public.tracks(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (teacher_id, track_id)
);

create table public.teacher_availability (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.teachers(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null check (end_time > start_time),
  status text not null default 'proposed' check (status in ('proposed', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (teacher_id, weekday, start_time, end_time)
);

create index levels_track_order_idx on public.levels (track_id, sort_order);
create index students_level_status_idx on public.students (level_id, status);
create index student_guardians_guardian_idx on public.student_guardians (guardian_id, student_id);
create index teacher_availability_teacher_day_idx on public.teacher_availability (teacher_id, weekday, start_time);

create trigger tracks_set_updated_at before update on public.tracks for each row execute function public.set_updated_at();
create trigger levels_set_updated_at before update on public.levels for each row execute function public.set_updated_at();
create trigger students_set_updated_at before update on public.students for each row execute function public.set_updated_at();
create trigger student_private_notes_set_updated_at before update on public.student_private_notes for each row execute function public.set_updated_at();
create trigger guardians_set_updated_at before update on public.guardians for each row execute function public.set_updated_at();
create trigger student_guardians_set_updated_at before update on public.student_guardians for each row execute function public.set_updated_at();
create trigger teachers_set_updated_at before update on public.teachers for each row execute function public.set_updated_at();
create trigger teacher_tracks_set_updated_at before update on public.teacher_tracks for each row execute function public.set_updated_at();
create trigger teacher_availability_set_updated_at before update on public.teacher_availability for each row execute function public.set_updated_at();

create or replace function private.current_teacher_id()
returns uuid language sql stable security definer set search_path = ''
as $$
  select teacher.id from public.teachers as teacher
  join public.profiles as profile on profile.id = teacher.profile_id
  where teacher.profile_id = (select auth.uid()) and profile.is_active
$$;

create or replace function private.current_guardian_id()
returns uuid language sql stable security definer set search_path = ''
as $$
  select guardian.id from public.guardians as guardian
  join public.profiles as profile on profile.id = guardian.profile_id
  where guardian.profile_id = (select auth.uid()) and profile.is_active
$$;

create or replace function private.guards_student(p_student uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select coalesce(exists (
    select 1 from public.student_guardians as link
    where link.student_id = p_student
      and link.guardian_id = (select private.current_guardian_id())
  ), false)
$$;

revoke execute on function private.current_teacher_id() from public, anon;
revoke execute on function private.current_guardian_id() from public, anon;
revoke execute on function private.guards_student(uuid) from public, anon;
grant execute on function private.current_teacher_id() to authenticated, service_role;
grant execute on function private.current_guardian_id() to authenticated, service_role;
grant execute on function private.guards_student(uuid) to authenticated, service_role;

alter table public.tracks enable row level security;
alter table public.levels enable row level security;
alter table public.students enable row level security;
alter table public.student_private_notes enable row level security;
alter table public.guardians enable row level security;
alter table public.student_guardians enable row level security;
alter table public.teachers enable row level security;
alter table public.teacher_tracks enable row level security;
alter table public.teacher_availability enable row level security;

revoke all on public.tracks, public.levels, public.students, public.student_private_notes,
  public.guardians, public.student_guardians, public.teachers, public.teacher_tracks,
  public.teacher_availability from public, anon, authenticated;
grant select on public.tracks, public.levels to anon, authenticated;
grant select, insert, update on public.tracks, public.levels, public.students,
  public.guardians, public.teachers to authenticated;
grant insert, update on public.student_private_notes to authenticated;
grant select, insert, update, delete on public.student_guardians, public.teacher_tracks,
  public.teacher_availability to authenticated;

create policy tracks_public_read on public.tracks for select to anon, authenticated using (is_active);
create policy tracks_admin_read on public.tracks for select to authenticated using ((select public.is_admin()));
create policy tracks_admin_insert on public.tracks for insert to authenticated with check ((select public.is_admin()));
create policy tracks_admin_update on public.tracks for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

create policy levels_public_read on public.levels for select to anon, authenticated using (
  is_active and exists (select 1 from public.tracks where tracks.id = levels.track_id and tracks.is_active)
);
create policy levels_admin_read on public.levels for select to authenticated using ((select public.is_admin()));
create policy levels_admin_insert on public.levels for insert to authenticated with check ((select public.is_admin()));
create policy levels_admin_update on public.levels for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

create policy students_admin_all on public.students for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy students_self_read on public.students for select to authenticated using (
  profile_id = (select auth.uid()) and (select public.auth_role()) is not null
);
create policy students_guardian_read on public.students for select to authenticated using ((select private.guards_student(id)));

create policy student_private_notes_admin_all on public.student_private_notes for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

create or replace function public.get_student_private_notes(p_student uuid)
returns table (student_id uuid, health_notes text, special_notes text, share_with_teacher boolean)
language plpgsql security definer set search_path = ''
as $$
begin
  if not (select public.is_admin()) then
    raise exception using errcode = '42501', message = 'admin_required';
  end if;

  insert into public.audit_logs (user_id, action, table_name, record_id, ip)
  values ((select auth.uid()), 'ACCESS', 'student_private_notes', p_student::text, inet_client_addr());

  return query
  select notes.student_id, notes.health_notes, notes.special_notes, notes.share_with_teacher
  from public.student_private_notes as notes
  where notes.student_id = p_student;
end;
$$;

revoke execute on function public.get_student_private_notes(uuid) from public, anon;
grant execute on function public.get_student_private_notes(uuid) to authenticated, service_role;

create policy guardians_admin_all on public.guardians for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy guardians_self_read on public.guardians for select to authenticated using (
  profile_id = (select auth.uid()) and (select public.auth_role()) is not null
);

create policy student_guardians_admin_all on public.student_guardians for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy student_guardians_parent_read on public.student_guardians for select to authenticated using (
  guardian_id = (select private.current_guardian_id())
);

create policy teachers_admin_all on public.teachers for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy teachers_self_read on public.teachers for select to authenticated using (
  profile_id = (select auth.uid()) and (select public.auth_role()) is not null
);

create policy teacher_tracks_admin_all on public.teacher_tracks for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy teacher_tracks_self_read on public.teacher_tracks for select to authenticated using (
  teacher_id = (select private.current_teacher_id())
);

create policy teacher_availability_admin_all on public.teacher_availability for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy teacher_availability_self_read on public.teacher_availability for select to authenticated using (
  teacher_id = (select private.current_teacher_id())
);
create policy teacher_availability_self_insert on public.teacher_availability for insert to authenticated with check (
  teacher_id = (select private.current_teacher_id()) and status = 'proposed'
);
create policy teacher_availability_self_update on public.teacher_availability for update to authenticated using (
  teacher_id = (select private.current_teacher_id()) and status = 'proposed'
) with check (teacher_id = (select private.current_teacher_id()) and status = 'proposed');
create policy teacher_availability_self_delete on public.teacher_availability for delete to authenticated using (
  teacher_id = (select private.current_teacher_id()) and status = 'proposed'
);

insert into supabase_migrations.schema_migrations(version, statements, name) values ('20261018200000', array[]::text[], 'create_people_directory') on conflict (version) do nothing;
-- END MIGRATION 20261018200000_create_people_directory.sql
-- BEGIN MIGRATION 20261019210000_add_student_management.sql
create trigger students_audit
after insert or update on public.students
for each row execute function public.audit_row();

create or replace function public.audit_student_private_notes()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  previous_row jsonb;
  current_row jsonb;
begin
  if tg_op = 'INSERT' then
    current_row := jsonb_build_object(
      'student_id', new.student_id,
      'has_health_notes', new.health_notes is not null and btrim(new.health_notes) <> '',
      'has_special_notes', new.special_notes is not null and btrim(new.special_notes) <> '',
      'share_with_teacher', new.share_with_teacher
    );
  elsif tg_op = 'UPDATE' then
    previous_row := jsonb_build_object(
      'student_id', old.student_id,
      'has_health_notes', old.health_notes is not null and btrim(old.health_notes) <> '',
      'has_special_notes', old.special_notes is not null and btrim(old.special_notes) <> '',
      'share_with_teacher', old.share_with_teacher
    );
    current_row := jsonb_build_object(
      'student_id', new.student_id,
      'has_health_notes', new.health_notes is not null and btrim(new.health_notes) <> '',
      'has_special_notes', new.special_notes is not null and btrim(new.special_notes) <> '',
      'share_with_teacher', new.share_with_teacher
    );
  else
    raise exception using errcode = '0A000', message = 'audit_operation_not_supported';
  end if;

  insert into public.audit_logs (user_id, action, table_name, record_id, before, after, ip)
  values ((select auth.uid()), tg_op, tg_table_name, new.student_id::text, previous_row, current_row, inet_client_addr());
  return new;
end;
$$;

revoke execute on function public.audit_student_private_notes() from public, anon, authenticated, service_role;

create trigger student_private_notes_audit
after insert or update on public.student_private_notes
for each row execute function public.audit_student_private_notes();

create or replace function public.upsert_student(p_payload jsonb)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  managed_student_id uuid;
  requested_student_id uuid := nullif(p_payload ->> 'student_id', '')::uuid;
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'admin_access_required';
  end if;

  if jsonb_typeof(p_payload) <> 'object' then
    raise exception using errcode = '22023', message = 'invalid_student_payload';
  end if;

  if requested_student_id is null then
    insert into public.students (
      full_name, gender, birth_date, status, level_id, joined_at, country_code, timezone
    ) values (
      p_payload ->> 'full_name',
      (p_payload ->> 'gender')::public.gender_t,
      nullif(p_payload ->> 'birth_date', '')::date,
      (p_payload ->> 'status')::public.student_status,
      nullif(p_payload ->> 'level_id', '')::uuid,
      (p_payload ->> 'joined_at')::date,
      nullif(p_payload ->> 'country_code', '')::char(2),
      p_payload ->> 'timezone'
    ) returning id into managed_student_id;
  else
    update public.students
    set full_name = p_payload ->> 'full_name',
        gender = (p_payload ->> 'gender')::public.gender_t,
        birth_date = nullif(p_payload ->> 'birth_date', '')::date,
        status = (p_payload ->> 'status')::public.student_status,
        level_id = nullif(p_payload ->> 'level_id', '')::uuid,
        joined_at = (p_payload ->> 'joined_at')::date,
        country_code = nullif(p_payload ->> 'country_code', '')::char(2),
        timezone = p_payload ->> 'timezone'
    where id = requested_student_id
    returning id into managed_student_id;

    if managed_student_id is null then
      raise exception using errcode = 'P0001', message = 'student_not_found';
    end if;
  end if;

  insert into public.student_private_notes (
    student_id, health_notes, special_notes, share_with_teacher
  ) values (
    managed_student_id,
    nullif(btrim(coalesce(p_payload ->> 'health_notes', '')), ''),
    nullif(btrim(coalesce(p_payload ->> 'special_notes', '')), ''),
    coalesce((p_payload ->> 'share_with_teacher')::boolean, false)
  )
  on conflict (student_id) do update
  set health_notes = excluded.health_notes,
      special_notes = excluded.special_notes,
      share_with_teacher = excluded.share_with_teacher;

  return managed_student_id;
end;
$$;

create or replace function public.archive_student(p_student_id uuid)
returns void language plpgsql security invoker set search_path = ''
as $$
begin
  update public.students set status = 'archived' where id = p_student_id;
  if not found then
    raise exception using errcode = 'P0001', message = 'student_not_found';
  end if;
end;
$$;

create or replace function public.record_student_export(p_count integer)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'admin_access_required';
  end if;

  insert into public.audit_logs (user_id, action, table_name, record_id, after, ip)
  values (
    (select auth.uid()),
    'EXPORT',
    'students',
    null,
    jsonb_build_object('record_count', greatest(coalesce(p_count, 0), 0)),
    inet_client_addr()
  );
end;
$$;

revoke execute on function public.upsert_student(jsonb) from public, anon;
revoke execute on function public.archive_student(uuid) from public, anon;
revoke execute on function public.record_student_export(integer) from public, anon;
grant execute on function public.upsert_student(jsonb) to authenticated;
grant execute on function public.archive_student(uuid) to authenticated;
grant execute on function public.record_student_export(integer) to authenticated;

insert into supabase_migrations.schema_migrations(version, statements, name) values ('20261019210000', array[]::text[], 'add_student_management') on conflict (version) do nothing;
-- END MIGRATION 20261019210000_add_student_management.sql
-- BEGIN MIGRATION 20261019230000_add_family_account_management.sql
create trigger guardians_audit
after insert or update or delete on public.guardians
for each row execute function public.audit_row();

create trigger student_guardians_audit
after insert or update or delete on public.student_guardians
for each row execute function public.audit_row();

create or replace function public.provision_person_role_record()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  person_role public.user_role;
  person_name text;
  person_gender public.gender_t;
  target_student_id uuid;
  trusted_creator_text text;
  trusted_creator_id uuid;
begin
  trusted_creator_text := case
    when new.invited_at is not null then nullif(new.raw_user_meta_data ->> 'created_by', '')
    else nullif(new.raw_app_meta_data ->> 'created_by', '')
  end;

  if trusted_creator_text is null then
    return new;
  end if;

  begin
    trusted_creator_id := trusted_creator_text::uuid;
  exception when invalid_text_representation then
    raise exception using errcode = '22023', message = 'provisioning_admin_required';
  end;

  if not exists (
    select 1 from public.profiles
    where id = trusted_creator_id and role = 'admin' and is_active
  ) then
    raise exception using errcode = '42501', message = 'provisioning_admin_required';
  end if;

  select profile.role, profile.full_name
  into person_role, person_name
  from public.profiles as profile
  where profile.id = new.id;

  if person_role is null then
    return new;
  end if;

  person_gender := coalesce(nullif(new.raw_user_meta_data ->> 'gender', '')::public.gender_t, 'male');

  if person_role = 'parent' then
    insert into public.guardians (profile_id)
    values (new.id)
    on conflict (profile_id) do nothing;
  elsif person_role = 'student' then
    target_student_id := nullif(new.raw_user_meta_data ->> 'student_id', '')::uuid;
    if target_student_id is null then
      insert into public.students (profile_id, gender, full_name)
      values (new.id, person_gender, person_name)
      on conflict (profile_id) do nothing;
    else
      update public.students
      set profile_id = new.id
      where id = target_student_id
        and (profile_id is null or profile_id = new.id);

      if not found then
        raise exception using errcode = '23505', message = 'student_account_already_linked';
      end if;
    end if;
  elsif person_role = 'teacher' then
    insert into public.teachers (profile_id, gender)
    values (new.id, person_gender)
    on conflict (profile_id) do nothing;
  end if;

  return new;
end;
$$;

revoke execute on function public.provision_person_role_record() from public, anon, authenticated, service_role;

create trigger zz_on_auth_user_person_created
after insert on auth.users
for each row execute function public.provision_person_role_record();

create trigger zz_on_auth_user_person_updated
after update of raw_app_meta_data, raw_user_meta_data, invited_at on auth.users
for each row execute function public.provision_person_role_record();

create or replace function public.upsert_student_guardian(
  p_student_id uuid,
  p_parent_profile_id uuid,
  p_relation text,
  p_is_primary boolean,
  p_is_payer boolean
)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  managed_guardian_id uuid;
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'admin_access_required';
  end if;

  if not exists (
    select 1 from public.profiles
    where id = p_parent_profile_id and role = 'parent' and is_active
  ) then
    raise exception using errcode = '23503', message = 'active_parent_profile_required';
  end if;

  if not exists (select 1 from public.students where id = p_student_id) then
    raise exception using errcode = '23503', message = 'student_not_found';
  end if;

  insert into public.guardians (profile_id)
  values (p_parent_profile_id)
  on conflict (profile_id) do update set profile_id = excluded.profile_id
  returning id into managed_guardian_id;

  if p_is_primary then
    update public.student_guardians
    set is_primary = false
    where student_id = p_student_id
      and guardian_id <> managed_guardian_id
      and is_primary;
  end if;

  insert into public.student_guardians (student_id, guardian_id, relation, is_primary, is_payer)
  values (p_student_id, managed_guardian_id, nullif(btrim(p_relation), ''), p_is_primary, p_is_payer)
  on conflict (student_id, guardian_id) do update
  set relation = excluded.relation,
      is_primary = excluded.is_primary,
      is_payer = excluded.is_payer;

  return managed_guardian_id;
end;
$$;

create or replace function public.remove_student_guardian(p_student_id uuid, p_guardian_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'admin_access_required';
  end if;

  delete from public.student_guardians
  where student_id = p_student_id and guardian_id = p_guardian_id;

  if not found then
    raise exception using errcode = 'P0002', message = 'guardian_link_not_found';
  end if;
end;
$$;

revoke execute on function public.upsert_student_guardian(uuid,uuid,text,boolean,boolean) from public, anon;
revoke execute on function public.remove_student_guardian(uuid,uuid) from public, anon;
grant execute on function public.upsert_student_guardian(uuid,uuid,text,boolean,boolean) to authenticated;
grant execute on function public.remove_student_guardian(uuid,uuid) to authenticated;

insert into supabase_migrations.schema_migrations(version, statements, name) values ('20261019230000', array[]::text[], 'add_family_account_management') on conflict (version) do nothing;
-- END MIGRATION 20261019230000_add_family_account_management.sql
-- BEGIN MIGRATION 20261020010000_add_student_imports.sql
create table public.student_import_batches (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references public.profiles(id) on delete restrict,
  source_name text not null check (char_length(btrim(source_name)) between 1 and 180),
  status text not null default 'pending' check (status in ('pending', 'confirmed')),
  row_count integer not null check (row_count between 1 and 200),
  payload jsonb not null check (jsonb_typeof(payload) = 'array'),
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (status = 'pending' and confirmed_at is null)
    or (status = 'confirmed' and confirmed_at is not null and payload = '[]'::jsonb)
  )
);

create index student_import_batches_owner_idx
on public.student_import_batches (created_by, created_at desc);

create trigger student_import_batches_set_updated_at
before update on public.student_import_batches
for each row execute function public.set_updated_at();

alter table public.student_import_batches enable row level security;
revoke all on public.student_import_batches from public, anon, authenticated, service_role;
grant select, insert on public.student_import_batches to authenticated;

create policy student_import_batches_admin_read
on public.student_import_batches for select to authenticated
using ((select public.is_admin()));

create policy student_import_batches_admin_create
on public.student_import_batches for insert to authenticated
with check ((select public.is_admin()) and created_by = (select auth.uid()));

create or replace function public.confirm_student_import(p_batch_id uuid)
returns integer language plpgsql security definer set search_path = ''
as $$
declare
  managed_batch public.student_import_batches%rowtype;
  imported_student jsonb;
  imported_count integer := 0;
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'admin_access_required';
  end if;

  select * into managed_batch
  from public.student_import_batches
  where id = p_batch_id
    and created_by = (select auth.uid())
    and created_at > now() - interval '1 day'
  for update;

  if managed_batch.id is null or managed_batch.status <> 'pending' then
    raise exception using errcode = 'P0002', message = 'pending_import_not_found';
  end if;

  if jsonb_array_length(managed_batch.payload) <> managed_batch.row_count then
    raise exception using errcode = '22023', message = 'invalid_import_payload';
  end if;

  for imported_student in select value from jsonb_array_elements(managed_batch.payload)
  loop
    if exists (
      select 1 from public.students
      where lower(btrim(full_name)) = lower(btrim(imported_student ->> 'full_name'))
        and birth_date is not distinct from nullif(imported_student ->> 'birth_date', '')::date
    ) then
      raise exception using errcode = '23505', message = 'duplicate_student';
    end if;

    perform public.upsert_student(imported_student);
    imported_count := imported_count + 1;
  end loop;

  update public.student_import_batches
  set status = 'confirmed', payload = '[]'::jsonb, confirmed_at = now()
  where id = managed_batch.id;

  insert into public.audit_logs (user_id, action, table_name, record_id, after, ip)
  values (
    (select auth.uid()),
    'IMPORT',
    'students',
    managed_batch.id::text,
    jsonb_build_object('record_count', imported_count),
    inet_client_addr()
  );

  return imported_count;
end;
$$;

revoke execute on function public.confirm_student_import(uuid) from public, anon;
grant execute on function public.confirm_student_import(uuid) to authenticated;

insert into supabase_migrations.schema_migrations(version, statements, name) values ('20261020010000', array[]::text[], 'add_student_imports') on conflict (version) do nothing;
-- END MIGRATION 20261020010000_add_student_imports.sql
-- BEGIN MIGRATION 20261020030000_add_teacher_management.sql
create or replace function public.enforce_teacher_activation()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if new.status = 'active'
    and (new.identity_verified_at is null or new.code_of_conduct_accepted_at is null) then
    raise exception using errcode = '23514', message = 'teacher_activation_requirements';
  end if;
  return new;
end;
$$;

revoke execute on function public.enforce_teacher_activation() from public, anon, authenticated, service_role;

create trigger teachers_enforce_activation
before insert or update of status, identity_verified_at, code_of_conduct_accepted_at
on public.teachers for each row execute function public.enforce_teacher_activation();

create trigger teachers_audit
after insert or update on public.teachers
for each row execute function public.audit_row();

create trigger teacher_tracks_audit
after insert or update or delete on public.teacher_tracks
for each row execute function public.audit_row();

create trigger teacher_availability_audit
after insert or update or delete on public.teacher_availability
for each row execute function public.audit_row();

create or replace function public.upsert_teacher(p_payload jsonb)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  managed_teacher_id uuid := nullif(p_payload ->> 'teacher_id', '')::uuid;
  requested_profile_id uuid := nullif(p_payload ->> 'profile_id', '')::uuid;
  requested_status text := p_payload ->> 'status';
  requested_tracks jsonb := coalesce(p_payload -> 'track_ids', '[]'::jsonb);
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'admin_access_required';
  end if;
  if jsonb_typeof(p_payload) <> 'object' or jsonb_typeof(requested_tracks) <> 'array' then
    raise exception using errcode = '22023', message = 'invalid_teacher_payload';
  end if;
  if not exists (
    select 1 from public.profiles
    where id = requested_profile_id and role = 'teacher' and is_active
  ) then
    raise exception using errcode = '23514', message = 'active_teacher_profile_required';
  end if;

  if managed_teacher_id is null then
    insert into public.teachers (
      profile_id, gender, specialization, ijazah_info, max_students, status, identity_verified_at
    ) values (
      requested_profile_id,
      (p_payload ->> 'gender')::public.gender_t,
      nullif(btrim(coalesce(p_payload ->> 'specialization', '')), ''),
      coalesce(p_payload -> 'ijazah_info', '[]'::jsonb),
      (p_payload ->> 'max_students')::integer,
      requested_status,
      case when coalesce((p_payload ->> 'identity_verified')::boolean, false) then now() end
    ) returning id into managed_teacher_id;
  else
    update public.teachers
    set profile_id = requested_profile_id,
        gender = (p_payload ->> 'gender')::public.gender_t,
        specialization = nullif(btrim(coalesce(p_payload ->> 'specialization', '')), ''),
        ijazah_info = coalesce(p_payload -> 'ijazah_info', '[]'::jsonb),
        max_students = (p_payload ->> 'max_students')::integer,
        status = requested_status,
        identity_verified_at = case
          when coalesce((p_payload ->> 'identity_verified')::boolean, false)
            then coalesce(identity_verified_at, now())
          else null
        end
    where id = managed_teacher_id
    returning id into managed_teacher_id;
    if managed_teacher_id is null then
      raise exception using errcode = 'P0001', message = 'teacher_not_found';
    end if;
  end if;

  delete from public.teacher_tracks where teacher_id = managed_teacher_id;
  insert into public.teacher_tracks (teacher_id, track_id)
  select managed_teacher_id, value::uuid
  from jsonb_array_elements_text(requested_tracks)
  on conflict do nothing;

  return managed_teacher_id;
end;
$$;

create or replace function public.accept_teacher_code_of_conduct()
returns timestamptz language plpgsql security definer set search_path = ''
as $$
declare
  accepted_at timestamptz;
begin
  update public.teachers
  set code_of_conduct_accepted_at = coalesce(code_of_conduct_accepted_at, now())
  where id = (select private.current_teacher_id())
  returning code_of_conduct_accepted_at into accepted_at;
  if accepted_at is null then
    raise exception using errcode = '42501', message = 'teacher_access_required';
  end if;
  return accepted_at;
end;
$$;

revoke execute on function public.upsert_teacher(jsonb) from public, anon;
revoke execute on function public.accept_teacher_code_of_conduct() from public, anon;
grant execute on function public.upsert_teacher(jsonb) to authenticated;
grant execute on function public.accept_teacher_code_of_conduct() to authenticated;

insert into supabase_migrations.schema_migrations(version, statements, name) values ('20261020030000', array[]::text[], 'add_teacher_management') on conflict (version) do nothing;
-- END MIGRATION 20261020030000_add_teacher_management.sql
-- BEGIN MIGRATION 20261020050000_add_teacher_assignments.sql
create table public.teacher_assignments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete restrict,
  teacher_id uuid not null references public.teachers(id) on delete restrict,
  track_id uuid not null references public.tracks(id) on delete restrict,
  status public.assignment_status not null default 'active',
  start_date date not null default current_date,
  end_date date,
  assigned_by uuid not null references public.profiles(id) on delete restrict,
  reason text not null check (char_length(btrim(reason)) between 2 and 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date is null or end_date >= start_date)
);

create unique index teacher_assignments_one_current_idx
on public.teacher_assignments (student_id, track_id)
where status in ('active', 'paused');
create index teacher_assignments_teacher_status_idx on public.teacher_assignments (teacher_id, status);
create index teacher_assignments_student_history_idx on public.teacher_assignments (student_id, created_at desc);

create table public.schedule_slots (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.teacher_assignments(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  local_start_time time not null,
  duration_min integer not null check (duration_min between 10 and 120),
  anchor_timezone text not null check (char_length(btrim(anchor_timezone)) between 1 and 100),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (assignment_id, weekday, local_start_time)
);

create index schedule_slots_assignment_active_idx on public.schedule_slots (assignment_id, is_active, weekday);
create trigger teacher_assignments_set_updated_at before update on public.teacher_assignments for each row execute function public.set_updated_at();
create trigger schedule_slots_set_updated_at before update on public.schedule_slots for each row execute function public.set_updated_at();
create trigger teacher_assignments_audit after insert or update or delete on public.teacher_assignments for each row execute function public.audit_row();
create trigger schedule_slots_audit after insert or update or delete on public.schedule_slots for each row execute function public.audit_row();

create or replace function public.enforce_assignment_gender()
returns trigger language plpgsql set search_path = ''
as $$
declare
  student_gender public.gender_t;
  teacher_gender public.gender_t;
begin
  select gender into student_gender from public.students where id = new.student_id;
  select gender into teacher_gender from public.teachers where id = new.teacher_id;
  if student_gender is null or teacher_gender is null then
    raise exception using errcode = '23503', message = 'assignment_party_not_found';
  end if;
  if student_gender is distinct from teacher_gender then
    raise exception using errcode = 'P0001', message = 'gender_mismatch';
  end if;
  if not exists (
    select 1 from public.teachers teacher
    join public.teacher_tracks teacher_track on teacher_track.teacher_id = teacher.id
    where teacher.id = new.teacher_id and teacher.status = 'active' and teacher_track.track_id = new.track_id
  ) then
    raise exception using errcode = 'P0001', message = 'teacher_not_eligible';
  end if;
  return new;
end;
$$;

create trigger teacher_assignments_enforce_gender
before insert or update of student_id, teacher_id, track_id
on public.teacher_assignments for each row execute function public.enforce_assignment_gender();

create or replace function public.block_student_gender_change()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if new.gender is distinct from old.gender and exists (
    select 1 from public.teacher_assignments assignment
    where assignment.student_id = old.id and assignment.status in ('active', 'paused')
  ) then
    raise exception using errcode = 'P0001', message = 'gender_change_blocked_active_assignment';
  end if;
  return new;
end;
$$;

create or replace function public.block_teacher_gender_change()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if new.gender is distinct from old.gender and exists (
    select 1 from public.teacher_assignments assignment
    where assignment.teacher_id = old.id and assignment.status in ('active', 'paused')
  ) then
    raise exception using errcode = 'P0001', message = 'gender_change_blocked_active_assignment';
  end if;
  return new;
end;
$$;

create trigger students_block_assigned_gender_change before update of gender on public.students for each row execute function public.block_student_gender_change();
create trigger teachers_block_assigned_gender_change before update of gender on public.teachers for each row execute function public.block_teacher_gender_change();

revoke execute on function public.enforce_assignment_gender() from public, anon, authenticated, service_role;
revoke execute on function public.block_student_gender_change() from public, anon, authenticated, service_role;
revoke execute on function public.block_teacher_gender_change() from public, anon, authenticated, service_role;

create or replace function private.teaches_student(p_student uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select coalesce(exists (
    select 1 from public.teacher_assignments assignment
    where assignment.student_id = p_student
      and assignment.teacher_id = (select private.current_teacher_id())
      and assignment.status in ('active', 'paused')
  ), false)
$$;
revoke execute on function private.teaches_student(uuid) from public, anon;
grant execute on function private.teaches_student(uuid) to authenticated, service_role;

create or replace function public.get_shared_student_notes(p_student uuid)
returns table (student_id uuid, health_notes text, special_notes text)
language plpgsql security definer set search_path = ''
as $$
begin
  if not (select private.teaches_student(p_student)) then
    raise exception using errcode = '42501', message = 'assigned_teacher_required';
  end if;
  insert into public.audit_logs (user_id, action, table_name, record_id, ip)
  values ((select auth.uid()), 'ACCESS_SHARED', 'student_private_notes', p_student::text, inet_client_addr());
  return query
  select notes.student_id, notes.health_notes, notes.special_notes
  from public.student_private_notes notes
  where notes.student_id = p_student and notes.share_with_teacher;
end;
$$;
revoke execute on function public.get_shared_student_notes(uuid) from public, anon;
grant execute on function public.get_shared_student_notes(uuid) to authenticated;

alter table public.teacher_assignments enable row level security;
alter table public.schedule_slots enable row level security;
revoke all on public.teacher_assignments, public.schedule_slots from public, anon, authenticated;
grant select, insert, update, delete on public.teacher_assignments, public.schedule_slots to authenticated;

create policy teacher_assignments_admin_all on public.teacher_assignments for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy teacher_assignments_teacher_read on public.teacher_assignments for select to authenticated using (teacher_id = (select private.current_teacher_id()));
create policy schedule_slots_admin_all on public.schedule_slots for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy schedule_slots_teacher_read on public.schedule_slots for select to authenticated using (
  exists (select 1 from public.teacher_assignments assignment where assignment.id = schedule_slots.assignment_id and assignment.teacher_id = (select private.current_teacher_id()))
);
create policy students_assigned_teacher_read on public.students for select to authenticated using ((select private.teaches_student(id)));

insert into supabase_migrations.schema_migrations(version, statements, name) values ('20261020050000', array[]::text[], 'add_teacher_assignments') on conflict (version) do nothing;
-- END MIGRATION 20261020050000_add_teacher_assignments.sql
-- BEGIN MIGRATION 20261020070000_add_smart_assignments.sql
create or replace function public.enforce_assignment_gender()
returns trigger language plpgsql set search_path = ''
as $$
declare
  student_gender public.gender_t;
  teacher_gender public.gender_t;
  teacher_capacity integer;
  current_load integer;
begin
  select gender into student_gender from public.students where id = new.student_id;
  select gender, max_students into teacher_gender, teacher_capacity from public.teachers where id = new.teacher_id;
  if student_gender is null or teacher_gender is null then
    raise exception using errcode = '23503', message = 'assignment_party_not_found';
  end if;
  if student_gender is distinct from teacher_gender then
    raise exception using errcode = 'P0001', message = 'gender_mismatch';
  end if;
  if new.status in ('active', 'paused') then
    if not exists (
      select 1 from public.teachers teacher
      join public.teacher_tracks teacher_track on teacher_track.teacher_id = teacher.id
      where teacher.id = new.teacher_id and teacher.status = 'active' and teacher_track.track_id = new.track_id
    ) then
      raise exception using errcode = 'P0001', message = 'teacher_not_eligible';
    end if;
    select count(*)::integer into current_load
    from public.teacher_assignments assignment
    where assignment.teacher_id = new.teacher_id
      and assignment.status in ('active', 'paused')
      and assignment.id is distinct from new.id;
    if current_load >= teacher_capacity then
      raise exception using errcode = 'P0001', message = 'teacher_capacity_reached';
    end if;
  end if;
  return new;
end;
$$;

drop trigger teacher_assignments_enforce_gender on public.teacher_assignments;
create trigger teacher_assignments_enforce_gender
before insert or update of student_id, teacher_id, track_id, status
on public.teacher_assignments for each row execute function public.enforce_assignment_gender();

create or replace function public.suggest_teachers(p_student uuid, p_track uuid)
returns table (
  teacher_id uuid,
  teacher_name text,
  timezone text,
  approved_slots integer,
  current_load integer,
  max_students integer,
  remaining_capacity integer,
  near_capacity boolean
)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'admin_access_required';
  end if;
  return query
  select
    teacher.id,
    profile.full_name,
    profile.timezone,
    count(distinct availability.id)::integer,
    count(distinct assignment.id)::integer,
    teacher.max_students,
    teacher.max_students - count(distinct assignment.id)::integer,
    count(distinct assignment.id)::numeric / teacher.max_students::numeric >= 0.85
  from public.students student
  join public.teachers teacher on teacher.gender = student.gender and teacher.status = 'active'
  join public.profiles profile on profile.id = teacher.profile_id and profile.is_active
  join public.teacher_tracks teacher_track on teacher_track.teacher_id = teacher.id and teacher_track.track_id = p_track
  left join public.teacher_availability availability on availability.teacher_id = teacher.id and availability.status = 'approved'
  left join public.teacher_assignments assignment on assignment.teacher_id = teacher.id and assignment.status in ('active', 'paused')
  where student.id = p_student
    and not exists (
      select 1 from public.teacher_assignments current_assignment
      where current_assignment.student_id = p_student
        and current_assignment.track_id = p_track
        and current_assignment.teacher_id = teacher.id
        and current_assignment.status in ('active', 'paused')
    )
  group by teacher.id, profile.full_name, profile.timezone
  having count(distinct assignment.id) < teacher.max_students
  order by count(distinct availability.id) desc,
    teacher.max_students - count(distinct assignment.id) desc,
    count(distinct assignment.id), profile.full_name;
end;
$$;

create or replace function public.manage_teacher_assignment(
  p_student uuid,
  p_teacher uuid,
  p_track uuid,
  p_reason text,
  p_action text default 'assign'
)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  current_assignment public.teacher_assignments%rowtype;
  managed_id uuid;
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'admin_access_required';
  end if;
  if char_length(btrim(coalesce(p_reason, ''))) < 2 then
    raise exception using errcode = '22023', message = 'assignment_reason_required';
  end if;
  if p_action not in ('assign', 'change', 'pause', 'resume', 'end') then
    raise exception using errcode = '22023', message = 'invalid_assignment_action';
  end if;

  select * into current_assignment
  from public.teacher_assignments
  where student_id = p_student and track_id = p_track and status in ('active', 'paused')
  for update;

  if p_action = 'assign' then
    if current_assignment.id is not null then
      raise exception using errcode = '23505', message = 'current_assignment_exists';
    end if;
    insert into public.teacher_assignments (student_id,teacher_id,track_id,assigned_by,reason)
    values (p_student,p_teacher,p_track,(select auth.uid()),btrim(p_reason)) returning id into managed_id;
  elsif p_action = 'change' then
    if current_assignment.id is null then
      raise exception using errcode = 'P0001', message = 'current_assignment_not_found';
    end if;
    update public.teacher_assignments set status='ended',end_date=current_date,
      reason = reason || E'\n' || '[ended] ' || btrim(p_reason)
    where id=current_assignment.id;
    insert into public.teacher_assignments (student_id,teacher_id,track_id,assigned_by,reason)
    values (p_student,p_teacher,p_track,(select auth.uid()),btrim(p_reason)) returning id into managed_id;
  elsif p_action = 'pause' then
    if current_assignment.id is null or current_assignment.status <> 'active' then
      raise exception using errcode = 'P0001', message = 'active_assignment_not_found';
    end if;
    update public.teacher_assignments set status='paused',reason=btrim(p_reason)
    where id=current_assignment.id returning id into managed_id;
  elsif p_action = 'resume' then
    if current_assignment.id is null or current_assignment.status <> 'paused' then
      raise exception using errcode = 'P0001', message = 'paused_assignment_not_found';
    end if;
    update public.teacher_assignments set status='active',reason=btrim(p_reason)
    where id=current_assignment.id returning id into managed_id;
  else
    if current_assignment.id is null then
      raise exception using errcode = 'P0001', message = 'current_assignment_not_found';
    end if;
    update public.teacher_assignments set status='ended',end_date=current_date,reason=btrim(p_reason)
    where id=current_assignment.id returning id into managed_id;
  end if;
  return managed_id;
end;
$$;

revoke execute on function public.suggest_teachers(uuid,uuid) from public, anon;
revoke execute on function public.manage_teacher_assignment(uuid,uuid,uuid,text,text) from public, anon;
grant execute on function public.suggest_teachers(uuid,uuid) to authenticated;
grant execute on function public.manage_teacher_assignment(uuid,uuid,uuid,text,text) to authenticated;

-- The service role is reserved for trusted server workflows and local test fixture setup.
grant select, insert, update, delete on public.profiles, public.tracks, public.students,
  public.teachers, public.teacher_tracks, public.teacher_availability,
  public.teacher_assignments, public.schedule_slots to service_role;
grant usage, select on sequence public.student_no_seq to service_role;

insert into supabase_migrations.schema_migrations(version, statements, name) values ('20261020070000', array[]::text[], 'add_smart_assignments') on conflict (version) do nothing;
-- END MIGRATION 20261020070000_add_smart_assignments.sql
-- BEGIN MIGRATION 20261020090000_secure_weekly_schedules.sql
create or replace function public.validate_schedule_slot()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = new.anchor_timezone) then
    raise exception using errcode = '22023', message = 'invalid_anchor_timezone';
  end if;
  if not exists (
    select 1 from public.teacher_assignments assignment
    where assignment.id = new.assignment_id and assignment.status = 'active'
  ) then
    raise exception using errcode = 'P0001', message = 'active_assignment_required';
  end if;
  return new;
end;
$$;

create trigger schedule_slots_validate
before insert or update of assignment_id, anchor_timezone
on public.schedule_slots for each row execute function public.validate_schedule_slot();

create policy schedule_slots_student_read on public.schedule_slots for select to authenticated using (
  exists (
    select 1 from public.teacher_assignments assignment
    join public.students student on student.id = assignment.student_id
    where assignment.id = schedule_slots.assignment_id and student.profile_id = (select auth.uid())
  )
);
create policy schedule_slots_parent_read on public.schedule_slots for select to authenticated using (
  exists (
    select 1 from public.teacher_assignments assignment
    where assignment.id = schedule_slots.assignment_id
      and (select private.guards_student(assignment.student_id))
  )
);

create or replace function public.get_visible_schedule()
returns table (
  slot_id uuid,
  assignment_id uuid,
  student_name text,
  teacher_name text,
  track_name_ar text,
  track_name_en text,
  weekday smallint,
  local_start_time time,
  duration_min integer,
  anchor_timezone text,
  is_active boolean
)
language sql stable security definer set search_path = ''
as $$
  select slot.id, assignment.id, student.full_name, profile.full_name,
    track.name_ar, track.name_en, slot.weekday, slot.local_start_time,
    slot.duration_min, slot.anchor_timezone, slot.is_active
  from public.schedule_slots slot
  join public.teacher_assignments assignment on assignment.id = slot.assignment_id
  join public.students student on student.id = assignment.student_id
  join public.teachers teacher on teacher.id = assignment.teacher_id
  join public.profiles profile on profile.id = teacher.profile_id
  join public.tracks track on track.id = assignment.track_id
  where slot.is_active and assignment.status = 'active'
    and (
      (select public.is_admin())
      or assignment.teacher_id = (select private.current_teacher_id())
      or student.profile_id = (select auth.uid())
      or (select private.guards_student(student.id))
    )
  order by slot.weekday, slot.local_start_time
$$;

revoke execute on function public.get_visible_schedule() from public, anon;
grant execute on function public.get_visible_schedule() to authenticated;
grant select, insert, update, delete on public.guardians, public.student_guardians to service_role;

insert into supabase_migrations.schema_migrations(version, statements, name) values ('20261020090000', array[]::text[], 'secure_weekly_schedules') on conflict (version) do nothing;
-- END MIGRATION 20261020090000_secure_weekly_schedules.sql
-- BEGIN MIGRATION 20261020110000_add_teacher_zoom_settings.sql
create table public.teacher_zoom_settings (
  teacher_id uuid primary key references public.teachers(id) on delete cascade,
  join_url text not null check (
    char_length(join_url) between 12 and 2048
    and join_url ~* '^https://(([a-z0-9-]+\.)*zoom\.us|zoom\.com|([a-z0-9-]+\.)*zoomgov\.com)(/|$)'
  ),
  meeting_id text check (meeting_id is null or char_length(btrim(meeting_id)) between 1 and 100),
  passcode text check (passcode is null or char_length(passcode) between 1 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger teacher_zoom_settings_set_updated_at before update on public.teacher_zoom_settings
for each row execute function public.set_updated_at();

create or replace function public.audit_teacher_zoom_settings()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.audit_logs(user_id,action,table_name,record_id,before,after,ip)
  values (
    (select auth.uid()), tg_op, 'teacher_zoom_settings', new.teacher_id::text,
    case when tg_op = 'UPDATE' then jsonb_build_object('configured', old.join_url is not null) end,
    jsonb_build_object('configured', new.join_url is not null), inet_client_addr()
  );
  return new;
end;
$$;
revoke execute on function public.audit_teacher_zoom_settings() from public, anon, authenticated, service_role;
create trigger teacher_zoom_settings_audit after insert or update on public.teacher_zoom_settings
for each row execute function public.audit_teacher_zoom_settings();

alter table public.teacher_zoom_settings enable row level security;
revoke all on public.teacher_zoom_settings from public, anon, authenticated;
grant select, insert, update on public.teacher_zoom_settings to authenticated;
grant select, insert, update, delete on public.teacher_zoom_settings to service_role;

create policy teacher_zoom_settings_admin_read on public.teacher_zoom_settings for select to authenticated
using ((select public.is_admin()));
create policy teacher_zoom_settings_admin_update on public.teacher_zoom_settings for update to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));
create policy teacher_zoom_settings_teacher_read on public.teacher_zoom_settings for select to authenticated
using (teacher_id = (select private.current_teacher_id()));
create policy teacher_zoom_settings_teacher_insert on public.teacher_zoom_settings for insert to authenticated
with check (teacher_id = (select private.current_teacher_id()));
create policy teacher_zoom_settings_teacher_update on public.teacher_zoom_settings for update to authenticated
using (teacher_id = (select private.current_teacher_id()))
with check (teacher_id = (select private.current_teacher_id()));

insert into supabase_migrations.schema_migrations(version, statements, name) values ('20261020110000', array[]::text[], 'add_teacher_zoom_settings') on conflict (version) do nothing;
-- END MIGRATION 20261020110000_add_teacher_zoom_settings.sql
-- BEGIN MIGRATION 20261020130000_create_sessions.sql
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

insert into supabase_migrations.schema_migrations(version, statements, name) values ('20261020130000', array[]::text[], 'create_sessions') on conflict (version) do nothing;
-- END MIGRATION 20261020130000_create_sessions.sql
-- BEGIN MIGRATION 20261020150000_generate_sessions.sql
create extension if not exists pg_cron;

create type public.credit_reason as enum ('grant', 'consume', 'refund', 'adjust', 'expire', 'proration');

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete restrict,
  status public.subscription_status not null default 'trial',
  start_date date not null,
  current_period_start date not null,
  current_period_end date not null,
  paused_until date,
  sessions_per_period integer not null check (sessions_per_period > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (current_period_end >= current_period_start),
  check (current_period_start >= start_date)
);

create unique index subscriptions_one_current_per_student_idx
on public.subscriptions (student_id)
where status in ('trial', 'active', 'paused');
create index subscriptions_student_period_idx
on public.subscriptions (student_id, current_period_start, current_period_end);

create table public.session_credit_ledger (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.subscriptions(id) on delete restrict,
  delta integer not null check (delta <> 0),
  reason public.credit_reason not null,
  session_id uuid references public.sessions(id) on delete restrict,
  note text check (note is null or char_length(btrim(note)) between 2 and 500),
  created_by uuid references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  check ((reason = 'consume' and delta < 0 and session_id is not null) or reason <> 'consume')
);

create unique index session_credit_ledger_consume_once_idx
on public.session_credit_ledger (session_id)
where reason = 'consume';
create index session_credit_ledger_subscription_created_idx
on public.session_credit_ledger (subscription_id, created_at);

create view public.subscription_balance
with (security_invoker = true, security_barrier = true)
as
select
  subscription_id,
  coalesce(sum(delta), 0)::integer as sessions_remaining
from public.session_credit_ledger
group by subscription_id;

create table public.job_runs (
  id bigint generated always as identity primary key,
  job_name text not null check (char_length(btrim(job_name)) between 2 and 100),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  result text not null default 'running' check (result in ('running', 'succeeded', 'failed')),
  affected_rows integer check (affected_rows is null or affected_rows >= 0),
  details jsonb not null default '{}'::jsonb,
  check (finished_at is null or finished_at >= started_at)
);

create index job_runs_name_started_idx on public.job_runs (job_name, started_at desc);

alter table public.schedule_slots
add column ambiguous_time_resolution text
check (ambiguous_time_resolution in ('earlier', 'later'));

create or replace function private.resolve_schedule_wall_clock(
  p_local_date date,
  p_local_time time,
  p_timezone text,
  p_ambiguous_resolution text default null
)
returns timestamptz
language plpgsql
stable
set search_path = ''
as $$
declare
  local_timestamp timestamp := p_local_date + p_local_time;
  postgres_choice timestamptz := (p_local_date + p_local_time) at time zone p_timezone;
  possible_instants timestamptz[];
begin
  if p_ambiguous_resolution is not null and p_ambiguous_resolution not in ('earlier', 'later') then
    raise exception using errcode = '22023', message = 'invalid_ambiguous_time_resolution';
  end if;

  select array_agg(candidate.instant order by candidate.instant)
  into possible_instants
  from (
    select distinct
      (
        local_timestamp
        - pg_catalog.make_interval(
          secs => extract(epoch from ((probe.instant at time zone p_timezone) - (probe.instant at time zone 'UTC')))::integer
        )
      ) at time zone 'UTC' as instant
    from (
      values
        (postgres_choice - interval '2 days'),
        (postgres_choice),
        (postgres_choice + interval '2 days')
    ) as probe(instant)
  ) as candidate
  where candidate.instant at time zone p_timezone = local_timestamp;

  if coalesce(array_length(possible_instants, 1), 0) = 0 then
    raise exception using errcode = '22023', message = 'nonexistent_local_time';
  end if;

  if array_length(possible_instants, 1) > 1 then
    if p_ambiguous_resolution is null then
      raise exception using errcode = '22023', message = 'ambiguous_local_time';
    end if;
    if p_ambiguous_resolution = 'later' then
      return possible_instants[array_length(possible_instants, 1)];
    end if;
  end if;

  return possible_instants[1];
end;
$$;
revoke execute on function private.resolve_schedule_wall_clock(date, time, text, text) from public, anon, authenticated, service_role;

create trigger subscriptions_set_updated_at
before update on public.subscriptions
for each row execute function public.set_updated_at();
create trigger subscriptions_audit
after insert or update or delete on public.subscriptions
for each row execute function public.audit_row();
create trigger session_credit_ledger_audit
after insert on public.session_credit_ledger
for each row execute function public.audit_row();

create or replace function public.prevent_session_credit_ledger_mutation()
returns trigger language plpgsql set search_path = ''
as $$
begin
  raise exception using errcode = 'P0001', message = 'credit_ledger_immutable';
end;
$$;
revoke execute on function public.prevent_session_credit_ledger_mutation() from public, anon, authenticated, service_role;

create trigger session_credit_ledger_immutable
before update or delete on public.session_credit_ledger
for each row execute function public.prevent_session_credit_ledger_mutation();

alter table public.subscriptions enable row level security;
alter table public.session_credit_ledger enable row level security;
alter table public.job_runs enable row level security;

revoke all on public.subscriptions from public, anon, authenticated;
revoke all on public.session_credit_ledger from public, anon, authenticated;
revoke all on public.subscription_balance from public, anon, authenticated;
revoke all on public.job_runs from public, anon, authenticated;

grant select, insert, update, delete on public.subscriptions to authenticated;
grant select, insert on public.session_credit_ledger to authenticated;
grant select on public.subscription_balance to authenticated;
grant select on public.job_runs to authenticated;
grant select, insert, update, delete on public.subscriptions to service_role;
grant select, insert, update, delete on public.session_credit_ledger to service_role;
grant select on public.subscription_balance to service_role;
grant select, insert, update, delete on public.job_runs to service_role;
grant usage, select on sequence public.job_runs_id_seq to service_role;

create policy subscriptions_admin_all on public.subscriptions for all to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));
create policy subscriptions_student_read on public.subscriptions for select to authenticated
using (
  exists (
    select 1 from public.students as student
    where student.id = subscriptions.student_id and student.profile_id = (select auth.uid())
  )
);
create policy subscriptions_parent_read on public.subscriptions for select to authenticated
using ((select private.guards_student(student_id)));

create policy session_credit_ledger_admin_read on public.session_credit_ledger for select to authenticated
using ((select public.is_admin()));
create policy session_credit_ledger_admin_insert on public.session_credit_ledger for insert to authenticated
with check ((select public.is_admin()));
create policy session_credit_ledger_student_read on public.session_credit_ledger for select to authenticated
using (
  exists (
    select 1
    from public.subscriptions as subscription
    join public.students as student on student.id = subscription.student_id
    where subscription.id = session_credit_ledger.subscription_id
      and student.profile_id = (select auth.uid())
  )
);
create policy session_credit_ledger_parent_read on public.session_credit_ledger for select to authenticated
using (
  exists (
    select 1 from public.subscriptions as subscription
    where subscription.id = session_credit_ledger.subscription_id
      and (select private.guards_student(subscription.student_id))
  )
);
create policy job_runs_admin_read on public.job_runs for select to authenticated
using ((select public.is_admin()));

create or replace function public.generate_sessions(
  p_window_start date default current_date,
  p_horizon_days integer default 28
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  generated_count integer := 0;
  current_run_id bigint;
begin
  if p_window_start is null or p_horizon_days is null or p_horizon_days < 1 or p_horizon_days > 366 then
    raise exception using errcode = '22023', message = 'invalid_generation_window';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('public.generate_sessions'));

  insert into public.job_runs (job_name)
  values ('generate_sessions')
  returning id into current_run_id;

  with eligible_subscriptions as (
    select
      subscription.id,
      subscription.student_id,
      subscription.current_period_start,
      subscription.current_period_end,
      coalesce(balance.sessions_remaining, 0) as credit_balance,
      (
        select count(*)::integer
        from public.sessions as existing_session
        join public.schedule_slots as existing_slot on existing_slot.id = existing_session.slot_id
        where existing_session.student_id = subscription.student_id
          and existing_session.status <> 'cancelled'
          and (existing_session.scheduled_at at time zone existing_slot.anchor_timezone)::date
            between subscription.current_period_start and subscription.current_period_end
      ) as reserved_sessions
    from public.subscriptions as subscription
    left join public.subscription_balance as balance on balance.subscription_id = subscription.id
    where subscription.status = 'active'
  ),
  candidate_occurrences as (
    select
      subscription.id as subscription_id,
      assignment.id as assignment_id,
      assignment.student_id,
      assignment.teacher_id,
      slot.id as slot_id,
      slot.duration_min,
      occurrence.local_date,
      private.resolve_schedule_wall_clock(
        occurrence.local_date,
        slot.local_start_time,
        slot.anchor_timezone,
        slot.ambiguous_time_resolution
      ) as scheduled_at,
      greatest(subscription.credit_balance - subscription.reserved_sessions, 0) as available_credits
    from public.schedule_slots as slot
    join public.teacher_assignments as assignment on assignment.id = slot.assignment_id
    join eligible_subscriptions as subscription on subscription.student_id = assignment.student_id
    cross join lateral (
      select generated_date::date as local_date
      from pg_catalog.generate_series(
        p_window_start::timestamp,
        (p_window_start + p_horizon_days - 1)::timestamp,
        interval '1 day'
      ) as generated_date
    ) as occurrence
    where slot.is_active
      and assignment.status = 'active'
      and occurrence.local_date between assignment.start_date and coalesce(assignment.end_date, 'infinity'::date)
      and occurrence.local_date between subscription.current_period_start and subscription.current_period_end
      and extract(dow from occurrence.local_date)::smallint = slot.weekday
      and subscription.credit_balance > subscription.reserved_sessions
  ),
  missing_occurrences as (
    select
      candidate.*,
      row_number() over (
        partition by candidate.subscription_id
        order by candidate.scheduled_at, candidate.slot_id
      ) as credit_ordinal
    from candidate_occurrences as candidate
    where not exists (
      select 1 from public.sessions as existing_session
      where existing_session.slot_id = candidate.slot_id
        and existing_session.scheduled_at = candidate.scheduled_at
    )
  )
  insert into public.sessions (
    assignment_id,
    student_id,
    teacher_id,
    original_teacher_id,
    slot_id,
    kind,
    scheduled_at,
    duration_min
  )
  select
    occurrence.assignment_id,
    occurrence.student_id,
    occurrence.teacher_id,
    occurrence.teacher_id,
    occurrence.slot_id,
    'regular',
    occurrence.scheduled_at,
    occurrence.duration_min
  from missing_occurrences as occurrence
  where occurrence.credit_ordinal <= occurrence.available_credits
  order by occurrence.scheduled_at, occurrence.slot_id
  on conflict (slot_id, scheduled_at) where slot_id is not null do nothing;

  get diagnostics generated_count = row_count;

  update public.job_runs
  set finished_at = pg_catalog.clock_timestamp(), result = 'succeeded', affected_rows = generated_count
  where id = current_run_id;

  return generated_count;
end;
$$;

revoke execute on function public.generate_sessions(date, integer) from public, anon, authenticated;
grant execute on function public.generate_sessions(date, integer) to service_role;

select cron.schedule(
  'generate-sessions-daily',
  '0 2 * * *',
  $$select public.generate_sessions()$$
);

insert into supabase_migrations.schema_migrations(version, statements, name) values ('20261020150000', array[]::text[], 'generate_sessions') on conflict (version) do nothing;
-- END MIGRATION 20261020150000_generate_sessions.sql
-- BEGIN MIGRATION 20261020170000_secure_session_join.sql
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

insert into supabase_migrations.schema_migrations(version, statements, name) values ('20261020170000', array[]::text[], 'secure_session_join') on conflict (version) do nothing;
-- END MIGRATION 20261020170000_secure_session_join.sql
-- BEGIN MIGRATION 20261020190000_add_realtime_notifications.sql
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

insert into supabase_migrations.schema_migrations(version, statements, name) values ('20261020190000', array[]::text[], 'add_realtime_notifications') on conflict (version) do nothing;
-- END MIGRATION 20261020190000_add_realtime_notifications.sql
-- BEGIN MIGRATION 20261020210000_add_attendance_effects.sql
alter table public.subscriptions
add column policy_snapshot jsonb not null default jsonb_build_object(
  'cancel_notice_hours', 12,
  'max_makeups_per_period', 2,
  'makeup_valid_days', 30,
  'student_no_show_consumes_credit', true,
  'student_no_show_pays_teacher', true
);

alter table public.subscriptions
add constraint subscriptions_policy_snapshot_valid check (
  jsonb_typeof(policy_snapshot) = 'object'
  and jsonb_typeof(policy_snapshot -> 'cancel_notice_hours') = 'number'
  and (policy_snapshot ->> 'cancel_notice_hours')::integer >= 0
  and jsonb_typeof(policy_snapshot -> 'max_makeups_per_period') = 'number'
  and (policy_snapshot ->> 'max_makeups_per_period')::integer >= 0
  and jsonb_typeof(policy_snapshot -> 'makeup_valid_days') = 'number'
  and (policy_snapshot ->> 'makeup_valid_days')::integer > 0
  and jsonb_typeof(policy_snapshot -> 'student_no_show_consumes_credit') = 'boolean'
  and jsonb_typeof(policy_snapshot -> 'student_no_show_pays_teacher') = 'boolean'
);

create table public.attendance (
  session_id uuid primary key references public.sessions(id) on delete restrict,
  status public.attendance_status not null,
  student_joined_at timestamptz,
  teacher_joined_at timestamptz,
  minutes integer check (minutes is null or minutes between 0 and 240),
  student_notice_at timestamptz,
  recorded_by uuid not null references public.profiles(id) on delete restrict,
  recorded_at timestamptz not null default now(),
  locked_at timestamptz,
  updated_at timestamptz not null default now()
);

create index attendance_recorded_by_idx on public.attendance (recorded_by);
create index attendance_status_recorded_idx on public.attendance (status, recorded_at desc);

create table public.teacher_rates (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.teachers(id) on delete restrict,
  track_id uuid references public.tracks(id) on delete restrict,
  duration_min integer check (duration_min is null or duration_min between 10 and 120),
  rate_per_session numeric(12,2) not null check (rate_per_session >= 0),
  currency character(3) not null check (currency ~ '^[A-Z]{3}$'),
  valid_from date not null,
  created_by uuid references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique nulls not distinct (teacher_id, track_id, duration_min, valid_from)
);

create index teacher_rates_lookup_idx
on public.teacher_rates (teacher_id, valid_from desc, track_id, duration_min);
create index teacher_rates_track_id_idx on public.teacher_rates (track_id) where track_id is not null;
create index teacher_rates_created_by_idx on public.teacher_rates (created_by) where created_by is not null;

create table public.teacher_payout_items (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null unique references public.sessions(id) on delete restrict,
  teacher_id uuid not null references public.teachers(id) on delete restrict,
  amount numeric(12,2) not null check (amount >= 0),
  currency character(3) not null check (currency ~ '^[A-Z]{3}$'),
  rate_snapshot numeric(12,2) not null check (rate_snapshot >= 0),
  kind text not null check (kind in ('session', 'makeup', 'substitute', 'no_show')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index teacher_payout_items_teacher_created_idx
on public.teacher_payout_items (teacher_id, created_at desc);

create table public.makeup_entitlements (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.subscriptions(id) on delete restrict,
  student_id uuid not null references public.students(id) on delete restrict,
  source_session_id uuid not null unique references public.sessions(id) on delete restrict,
  outside_period_cap boolean not null default false,
  expires_at timestamptz not null,
  used_by_session_id uuid unique references public.sessions(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expires_at > created_at)
);

create index makeup_entitlements_subscription_available_idx
on public.makeup_entitlements (subscription_id, expires_at)
where used_by_session_id is null;
create index makeup_entitlements_student_available_idx
on public.makeup_entitlements (student_id, expires_at)
where used_by_session_id is null;

create trigger attendance_set_updated_at
before update on public.attendance
for each row execute function public.set_updated_at();
create trigger teacher_rates_set_updated_at
before update on public.teacher_rates
for each row execute function public.set_updated_at();
create trigger teacher_payout_items_set_updated_at
before update on public.teacher_payout_items
for each row execute function public.set_updated_at();
create trigger makeup_entitlements_set_updated_at
before update on public.makeup_entitlements
for each row execute function public.set_updated_at();

create trigger attendance_audit
after insert or update on public.attendance
for each row execute function public.audit_row();
create trigger teacher_rates_audit
after insert or update or delete on public.teacher_rates
for each row execute function public.audit_row();
create trigger teacher_payout_items_audit
after insert on public.teacher_payout_items
for each row execute function public.audit_row();
create trigger makeup_entitlements_audit
after insert or update on public.makeup_entitlements
for each row execute function public.audit_row();

create or replace function public.prevent_teacher_payout_item_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception using errcode = 'P0001', message = 'teacher_payout_item_immutable';
end;
$$;

revoke execute on function public.prevent_teacher_payout_item_mutation() from public, anon, authenticated, service_role;

create trigger teacher_payout_items_immutable
before update or delete on public.teacher_payout_items
for each row execute function public.prevent_teacher_payout_item_mutation();

alter table public.attendance enable row level security;
alter table public.teacher_rates enable row level security;
alter table public.teacher_payout_items enable row level security;
alter table public.makeup_entitlements enable row level security;

revoke all on public.attendance from public, anon, authenticated;
revoke all on public.teacher_rates from public, anon, authenticated;
revoke all on public.teacher_payout_items from public, anon, authenticated;
revoke all on public.makeup_entitlements from public, anon, authenticated;

grant select on public.attendance to authenticated;
grant select, insert, update, delete on public.teacher_rates to authenticated;
grant select on public.teacher_payout_items to authenticated;
grant select on public.makeup_entitlements to authenticated;
grant select, insert, update, delete on public.attendance to service_role;
grant select, insert, update, delete on public.teacher_rates to service_role;
grant select, insert, update, delete on public.teacher_payout_items to service_role;
grant select, insert, update, delete on public.makeup_entitlements to service_role;

create policy attendance_admin_read on public.attendance for select to authenticated
using ((select public.is_admin()));
create policy attendance_teacher_read on public.attendance for select to authenticated
using (
  exists (
    select 1 from public.sessions as session
    where session.id = attendance.session_id
      and session.teacher_id = (select private.current_teacher_id())
  )
);
create policy attendance_student_read on public.attendance for select to authenticated
using (
  exists (
    select 1
    from public.sessions as session
    join public.students as student on student.id = session.student_id
    where session.id = attendance.session_id
      and student.profile_id = (select auth.uid())
  )
);
create policy attendance_parent_read on public.attendance for select to authenticated
using (
  exists (
    select 1 from public.sessions as session
    where session.id = attendance.session_id
      and (select private.guards_student(session.student_id))
  )
);

create policy teacher_rates_admin_all on public.teacher_rates for all to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));
create policy teacher_rates_teacher_read on public.teacher_rates for select to authenticated
using (teacher_id = (select private.current_teacher_id()));

create policy teacher_payout_items_admin_read on public.teacher_payout_items for select to authenticated
using ((select public.is_admin()));
create policy teacher_payout_items_teacher_read on public.teacher_payout_items for select to authenticated
using (teacher_id = (select private.current_teacher_id()));

create policy makeup_entitlements_admin_read on public.makeup_entitlements for select to authenticated
using ((select public.is_admin()));
create policy makeup_entitlements_teacher_read on public.makeup_entitlements for select to authenticated
using (
  exists (
    select 1 from public.sessions as session
    where session.id = makeup_entitlements.source_session_id
      and session.teacher_id = (select private.current_teacher_id())
  )
);
create policy makeup_entitlements_student_read on public.makeup_entitlements for select to authenticated
using (
  exists (
    select 1 from public.students as student
    where student.id = makeup_entitlements.student_id
      and student.profile_id = (select auth.uid())
  )
);
create policy makeup_entitlements_parent_read on public.makeup_entitlements for select to authenticated
using ((select private.guards_student(student_id)));

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
    where entitlement.subscription_id = subscription_row.id
      and not entitlement.outside_period_cap
      and entitlement.created_at::date between subscription_row.current_period_start and subscription_row.current_period_end;

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

revoke execute on function private.apply_attendance_effects(uuid) from public, anon, authenticated, service_role;

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

  if not (select public.is_admin())
    and session_row.teacher_id is distinct from (select private.current_teacher_id()) then
    raise exception using errcode = '42501', message = 'attendance_forbidden';
  end if;

  if p_minutes is not null and p_minutes not between 0 and 240 then
    raise exception using errcode = '22023', message = 'invalid_attendance_minutes';
  end if;

  select * into existing_attendance
  from public.attendance
  where session_id = p_session_id;

  if existing_attendance.session_id is not null then
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
    status,
    student_joined_at,
    teacher_joined_at,
    minutes,
    student_notice_at,
    recorded_by
  )
  values (
    p_session_id,
    p_status,
    p_student_joined_at,
    p_teacher_joined_at,
    p_minutes,
    p_student_notice_at,
    actor_id
  )
  returning * into saved_attendance;

  perform private.apply_attendance_effects(p_session_id);

  return saved_attendance;
end;
$$;

revoke execute on function public.record_attendance(uuid, public.attendance_status, timestamptz, timestamptz, integer, timestamptz)
from public, anon, service_role;
grant execute on function public.record_attendance(uuid, public.attendance_status, timestamptz, timestamptz, integer, timestamptz)
to authenticated;

insert into supabase_migrations.schema_migrations(version, statements, name) values ('20261020210000', array[]::text[], 'add_attendance_effects') on conflict (version) do nothing;
-- END MIGRATION 20261020210000_add_attendance_effects.sql
-- BEGIN MIGRATION 20261020230000_add_session_adjustments.sql
alter table public.sessions
add column rescheduled_from uuid references public.sessions(id) on delete restrict;

grant select (rescheduled_from) on public.sessions to authenticated;

create unique index sessions_rescheduled_from_once_idx
on public.sessions (rescheduled_from)
where rescheduled_from is not null;

create unique index sessions_makeup_source_once_idx
on public.sessions (makeup_of)
where kind = 'makeup' and makeup_of is not null;

revoke insert, update, delete on public.sessions from authenticated;

create or replace function public.assign_session_substitute(
  p_session_id uuid,
  p_substitute_teacher_id uuid,
  p_scope text
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  anchor_session public.sessions%rowtype;
  assignment_track_id uuid;
  changed_count integer := 0;
  changed_session record;
begin
  if not (select public.is_admin()) then
    raise exception using errcode = '42501', message = 'admin_mfa_required';
  end if;

  if p_scope not in ('session', 'week') then
    raise exception using errcode = '22023', message = 'invalid_substitute_scope';
  end if;

  select session.* into anchor_session
  from public.sessions as session
  where session.id = p_session_id
  for update;

  if anchor_session.id is null or anchor_session.status <> 'scheduled' then
    raise exception using errcode = 'P0001', message = 'session_not_adjustable';
  end if;

  if anchor_session.assignment_id is null then
    raise exception using errcode = 'P0001', message = 'session_assignment_required';
  end if;

  select assignment.track_id into assignment_track_id
  from public.teacher_assignments as assignment
  where assignment.id = anchor_session.assignment_id;

  if not exists (
    select 1
    from public.teachers as teacher
    join public.teacher_tracks as teacher_track on teacher_track.teacher_id = teacher.id
    where teacher.id = p_substitute_teacher_id
      and teacher.status = 'active'
      and teacher_track.track_id = assignment_track_id
  ) then
    raise exception using errcode = 'P0001', message = 'teacher_not_eligible';
  end if;

  for changed_session in
    update public.sessions as session
    set teacher_id = p_substitute_teacher_id,
        original_teacher_id = coalesce(session.original_teacher_id, session.teacher_id)
    where session.status = 'scheduled'
      and (
        (p_scope = 'session' and session.id = anchor_session.id)
        or (
          p_scope = 'week'
          and session.assignment_id = anchor_session.assignment_id
          and session.scheduled_at >= anchor_session.scheduled_at
          and session.scheduled_at < anchor_session.scheduled_at + interval '7 days'
        )
      )
    returning session.id, session.student_id
  loop
    changed_count := changed_count + 1;
    perform private.notify_session_parties(
      changed_session.student_id,
      'schedule_changed',
      pg_catalog.jsonb_build_object(
        'session_id', changed_session.id,
        'change', 'substitute'
      )
    );
  end loop;

  if changed_count = 0 then
    raise exception using errcode = 'P0001', message = 'session_not_adjustable';
  end if;

  return changed_count;
end;
$$;

create or replace function public.create_makeup_session(
  p_entitlement_id uuid,
  p_scheduled_at timestamptz,
  p_teacher_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  entitlement public.makeup_entitlements%rowtype;
  source_session public.sessions%rowtype;
  assignment_row public.teacher_assignments%rowtype;
  selected_teacher_id uuid;
  created_session_id uuid;
  updated_count integer;
begin
  if not (select public.is_admin()) then
    raise exception using errcode = '42501', message = 'admin_mfa_required';
  end if;

  if p_scheduled_at <= statement_timestamp() then
    raise exception using errcode = '22023', message = 'session_time_must_be_future';
  end if;

  select item.* into entitlement
  from public.makeup_entitlements as item
  where item.id = p_entitlement_id
  for update;

  if entitlement.id is null
    or entitlement.used_by_session_id is not null
    or entitlement.expires_at < statement_timestamp() then
    raise exception using errcode = 'P0001', message = 'makeup_entitlement_unavailable';
  end if;

  select session.* into source_session
  from public.sessions as session
  where session.id = entitlement.source_session_id
  for update;

  if source_session.id is null
    or source_session.student_id <> entitlement.student_id
    or source_session.assignment_id is null then
    raise exception using errcode = 'P0001', message = 'makeup_source_invalid';
  end if;

  select assignment.* into assignment_row
  from public.teacher_assignments as assignment
  where assignment.id = source_session.assignment_id;

  selected_teacher_id := coalesce(
    p_teacher_id,
    source_session.original_teacher_id,
    source_session.teacher_id
  );

  if not exists (
    select 1
    from public.teachers as teacher
    join public.teacher_tracks as teacher_track on teacher_track.teacher_id = teacher.id
    where teacher.id = selected_teacher_id
      and teacher.status = 'active'
      and teacher_track.track_id = assignment_row.track_id
  ) then
    raise exception using errcode = 'P0001', message = 'teacher_not_eligible';
  end if;

  insert into public.sessions (
    assignment_id,
    student_id,
    teacher_id,
    original_teacher_id,
    kind,
    makeup_of,
    scheduled_at,
    duration_min
  )
  values (
    source_session.assignment_id,
    source_session.student_id,
    selected_teacher_id,
    case
      when selected_teacher_id <> assignment_row.teacher_id then assignment_row.teacher_id
      else null
    end,
    'makeup',
    source_session.id,
    p_scheduled_at,
    source_session.duration_min
  )
  returning id into created_session_id;

  update public.makeup_entitlements
  set used_by_session_id = created_session_id
  where id = entitlement.id and used_by_session_id is null;
  get diagnostics updated_count = row_count;

  if updated_count <> 1 then
    raise exception using errcode = 'P0001', message = 'makeup_entitlement_unavailable';
  end if;

  perform private.notify_session_parties(
    source_session.student_id,
    'schedule_changed',
    pg_catalog.jsonb_build_object(
      'session_id', created_session_id,
      'source_session_id', source_session.id,
      'change', 'makeup'
    )
  );

  return created_session_id;
end;
$$;

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
  set status = 'rescheduled'
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
    duration_min,
    zoom_override_url,
    zoom_meeting_id,
    zoom_passcode
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
    source_session.duration_min,
    source_session.zoom_override_url,
    source_session.zoom_meeting_id,
    source_session.zoom_passcode
  )
  returning id into replacement_id;

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

revoke execute on function public.assign_session_substitute(uuid, uuid, text) from public, anon, service_role;
revoke execute on function public.create_makeup_session(uuid, timestamptz, uuid) from public, anon, service_role;
revoke execute on function public.reschedule_session(uuid, timestamptz) from public, anon, service_role;

grant execute on function public.assign_session_substitute(uuid, uuid, text) to authenticated;
grant execute on function public.create_makeup_session(uuid, timestamptz, uuid) to authenticated;
grant execute on function public.reschedule_session(uuid, timestamptz) to authenticated;

insert into supabase_migrations.schema_migrations(version, statements, name) values ('20261020230000', array[]::text[], 'add_session_adjustments') on conflict (version) do nothing;
-- END MIGRATION 20261020230000_add_session_adjustments.sql
-- BEGIN MIGRATION 20261020250000_add_attendance_controls.sql
alter table public.app_settings
drop constraint app_settings_public_shape;

alter table public.app_settings
add constraint app_settings_public_shape check (
  (
    key = 'academy_profile'
    and value ?& array['name_ar', 'name_en', 'description_ar', 'description_en', 'logo_url']
    and value - array['name_ar', 'name_en', 'description_ar', 'description_en', 'logo_url'] = '{}'::jsonb
    and jsonb_typeof(value -> 'name_ar') = 'string'
    and jsonb_typeof(value -> 'name_en') = 'string'
    and jsonb_typeof(value -> 'description_ar') = 'string'
    and jsonb_typeof(value -> 'description_en') = 'string'
    and (value -> 'logo_url' = 'null'::jsonb or jsonb_typeof(value -> 'logo_url') = 'string')
    and value ->> 'name_ar' = btrim(value ->> 'name_ar')
    and value ->> 'name_en' = btrim(value ->> 'name_en')
    and value ->> 'description_ar' = btrim(value ->> 'description_ar')
    and value ->> 'description_en' = btrim(value ->> 'description_en')
    and char_length(btrim(value ->> 'name_ar')) between 2 and 120
    and char_length(btrim(value ->> 'name_en')) between 2 and 120
    and char_length(btrim(value ->> 'description_ar')) between 2 and 500
    and char_length(btrim(value ->> 'description_en')) between 2 and 500
    and (
      value ->> 'logo_url' is null
      or (
        char_length(value ->> 'logo_url') between 1 and 2048
        and value ->> 'logo_url' like '/%'
        and value ->> 'logo_url' not like '//%'
        and value ->> 'logo_url' !~ '[^A-Za-z0-9_./-]'
        and not (value ->> 'logo_url' ~ '(^|/)\.\.(/|$)')
      )
    )
  )
  or (
    key = 'support_hours'
    and value ?& array['ar', 'en']
    and value - array['ar', 'en'] = '{}'::jsonb
    and jsonb_typeof(value -> 'ar') = 'string'
    and jsonb_typeof(value -> 'en') = 'string'
    and value ->> 'ar' = btrim(value ->> 'ar')
    and value ->> 'en' = btrim(value ->> 'en')
    and char_length(btrim(value ->> 'ar')) between 2 and 500
    and char_length(btrim(value ->> 'en')) between 2 and 500
  )
  or (
    key = 'attendance_policy'
    and value ?& array[
      'attendance_lock_hours',
      'late_tolerance_min',
      'teacher_absence_alert_threshold',
      'teacher_absence_window_days'
    ]
    and value - array[
      'attendance_lock_hours',
      'late_tolerance_min',
      'teacher_absence_alert_threshold',
      'teacher_absence_window_days'
    ] = '{}'::jsonb
    and jsonb_typeof(value -> 'attendance_lock_hours') = 'number'
    and (value ->> 'attendance_lock_hours')::integer between 1 and 87600
    and jsonb_typeof(value -> 'late_tolerance_min') = 'number'
    and (value ->> 'late_tolerance_min')::integer between 1 and 120
    and jsonb_typeof(value -> 'teacher_absence_alert_threshold') = 'number'
    and (value ->> 'teacher_absence_alert_threshold')::integer between 1 and 100
    and jsonb_typeof(value -> 'teacher_absence_window_days') = 'number'
    and (value ->> 'teacher_absence_window_days')::integer between 1 and 365
  )
  or key not in ('academy_profile', 'support_hours', 'attendance_policy')
);

alter table public.app_settings disable trigger app_settings_audit;

insert into public.app_settings (key, value)
values (
  'attendance_policy',
  jsonb_build_object(
    'attendance_lock_hours', 48,
    'late_tolerance_min', 10,
    'teacher_absence_alert_threshold', 3,
    'teacher_absence_window_days', 30
  )
)
on conflict (key) do nothing;

alter table public.app_settings enable trigger app_settings_audit;

create table public.session_alerts (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete restrict,
  teacher_id uuid not null references public.teachers(id) on delete restrict,
  student_id uuid not null references public.students(id) on delete restrict,
  type text not null check (type in ('teacher_late', 'teacher_absence_threshold')),
  dedupe_key text not null unique check (char_length(dedupe_key) between 10 and 180),
  detected_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb check (
    jsonb_typeof(metadata) = 'object'
    and octet_length(metadata::text) <= 4096
  ),
  created_at timestamptz not null default now()
);

create index session_alerts_teacher_detected_idx
on public.session_alerts (teacher_id, detected_at desc);
create index session_alerts_student_detected_idx
on public.session_alerts (student_id, detected_at desc);

create trigger session_alerts_audit
after insert on public.session_alerts
for each row execute function public.audit_row();

alter table public.session_alerts enable row level security;
revoke all on table public.session_alerts from public, anon, authenticated;
grant select on table public.session_alerts to authenticated;

create policy session_alerts_admin_read
on public.session_alerts
for select to authenticated
using ((select public.is_admin()));

create or replace function private.detect_teacher_lateness(
  p_now timestamptz default statement_timestamp()
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  policy_value jsonb;
  tolerance_min integer;
  candidate record;
  inserted_alert_id uuid;
  admin_profile record;
  created_count integer := 0;
begin
  select setting.value into policy_value
  from public.app_settings as setting
  where setting.key = 'attendance_policy';

  tolerance_min := coalesce((policy_value ->> 'late_tolerance_min')::integer, 10);

  for candidate in
    select session.id, session.teacher_id, session.student_id, session.scheduled_at
    from public.sessions as session
    left join public.attendance as attendance on attendance.session_id = session.id
    where session.status = 'scheduled'
      and session.scheduled_at + pg_catalog.make_interval(mins => tolerance_min) <= p_now
      and session.ends_at > p_now
      and attendance.session_id is null
  loop
    inserted_alert_id := null;
    insert into public.session_alerts (
      session_id, teacher_id, student_id, type, dedupe_key, detected_at, metadata
    )
    values (
      candidate.id,
      candidate.teacher_id,
      candidate.student_id,
      'teacher_late',
      'teacher_late:' || candidate.id::text,
      p_now,
      pg_catalog.jsonb_build_object(
        'scheduled_at', candidate.scheduled_at,
        'late_tolerance_min', tolerance_min
      )
    )
    on conflict (dedupe_key) do nothing
    returning id into inserted_alert_id;

    if inserted_alert_id is not null then
      created_count := created_count + 1;
      perform private.notify_session_parties(
        candidate.student_id,
        'teacher_late',
        pg_catalog.jsonb_build_object('session_id', candidate.id)
      );

      for admin_profile in
        select profile.id
        from public.profiles as profile
        where profile.role = 'admin' and profile.is_active
      loop
        perform private.enqueue_notification(
          admin_profile.id,
          'teacher_late',
          pg_catalog.jsonb_build_object(
            'session_id', candidate.id,
            'teacher_id', candidate.teacher_id
          )
        );
      end loop;
    end if;
  end loop;

  return created_count;
end;
$$;

revoke execute on function private.detect_teacher_lateness(timestamptz)
from public, anon, authenticated, service_role;

select cron.schedule(
  'detect-teacher-lateness',
  '*/5 * * * *',
  $job$select private.detect_teacher_lateness()$job$
);

create or replace function private.alert_teacher_absence_threshold()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  session_row public.sessions%rowtype;
  policy_value jsonb;
  threshold_count integer;
  window_days integer;
  absence_count integer;
  inserted_alert_id uuid;
  admin_profile record;
  period_key text;
begin
  if new.status not in ('teacher_absent', 'cancelled_teacher') then
    return new;
  end if;

  select * into session_row
  from public.sessions
  where id = new.session_id;

  select setting.value into policy_value
  from public.app_settings as setting
  where setting.key = 'attendance_policy';

  threshold_count := coalesce((policy_value ->> 'teacher_absence_alert_threshold')::integer, 3);
  window_days := coalesce((policy_value ->> 'teacher_absence_window_days')::integer, 30);

  select count(*)::integer into absence_count
  from public.attendance as attendance
  join public.sessions as session on session.id = attendance.session_id
  where session.teacher_id = session_row.teacher_id
    and attendance.status in ('teacher_absent', 'cancelled_teacher')
    and session.scheduled_at >= statement_timestamp() - pg_catalog.make_interval(days => window_days);

  if absence_count < threshold_count then
    return new;
  end if;

  period_key := pg_catalog.to_char(statement_timestamp() at time zone 'UTC', 'YYYY-MM');
  insert into public.session_alerts (
    session_id, teacher_id, student_id, type, dedupe_key, metadata
  )
  values (
    new.session_id,
    session_row.teacher_id,
    session_row.student_id,
    'teacher_absence_threshold',
    'teacher_absence_threshold:' || session_row.teacher_id::text || ':' || period_key,
    pg_catalog.jsonb_build_object(
      'absence_count', absence_count,
      'threshold', threshold_count,
      'window_days', window_days
    )
  )
  on conflict (dedupe_key) do nothing
  returning id into inserted_alert_id;

  if inserted_alert_id is not null then
    for admin_profile in
      select profile.id
      from public.profiles as profile
      where profile.role = 'admin' and profile.is_active
    loop
      perform private.enqueue_notification(
        admin_profile.id,
        'teacher_absence_threshold',
        pg_catalog.jsonb_build_object(
          'session_id', new.session_id,
          'teacher_id', session_row.teacher_id,
          'absence_count', absence_count,
          'window_days', window_days
        )
      );
    end loop;
  end if;

  return new;
end;
$$;

revoke execute on function private.alert_teacher_absence_threshold()
from public, anon, authenticated, service_role;

create trigger attendance_alert_teacher_absence_threshold
after insert on public.attendance
for each row execute function private.alert_teacher_absence_threshold();

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
  where session_id = p_session_id;

  if existing_attendance.session_id is not null then
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
    p_status,
    p_student_joined_at,
    p_teacher_joined_at,
    p_minutes,
    p_student_notice_at,
    actor_id,
    attendance_deadline
  )
  returning * into saved_attendance;

  perform private.apply_attendance_effects(p_session_id);

  return saved_attendance;
end;
$$;

revoke execute on function public.record_attendance(uuid, public.attendance_status, timestamptz, timestamptz, integer, timestamptz)
from public, anon, service_role;
grant execute on function public.record_attendance(uuid, public.attendance_status, timestamptz, timestamptz, integer, timestamptz)
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
    select
      session.id,
      session.student_id,
      session.teacher_id,
      attendance.status as attendance_status
    from public.sessions as session
    left join public.attendance as attendance on attendance.session_id = session.id
    where session.scheduled_at >= instant_start
      and session.scheduled_at < instant_end
      and session.status not in ('cancelled', 'rescheduled')
  ), student_rows as (
    select
      'student'::text as row_type,
      student.id as row_id,
      student.full_name as row_name,
      count(*) filter (where period.attendance_status not in ('teacher_absent', 'cancelled_teacher', 'cancelled_admin')) as row_scheduled,
      count(*) filter (where period.attendance_status in ('present', 'late')) as row_attended,
      count(*) filter (where period.attendance_status in ('student_absent', 'student_excused')) as row_absent
    from period_sessions as period
    join public.students as student on student.id = period.student_id
    group by student.id, student.full_name
  ), teacher_rows as (
    select
      'teacher'::text as row_type,
      teacher.id as row_id,
      profile.full_name as row_name,
      count(*) filter (where period.attendance_status <> 'cancelled_admin' or period.attendance_status is null) as row_scheduled,
      count(*) filter (where period.attendance_status in ('present', 'late', 'student_absent', 'student_excused')) as row_attended,
      count(*) filter (where period.attendance_status in ('teacher_absent', 'cancelled_teacher')) as row_absent
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

insert into supabase_migrations.schema_migrations(version, statements, name) values ('20261020250000', array[]::text[], 'add_attendance_controls') on conflict (version) do nothing;
-- END MIGRATION 20261020250000_add_attendance_controls.sql
-- BEGIN MIGRATION 20261020270000_add_calendar_exports.sql
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

insert into supabase_migrations.schema_migrations(version, statements, name) values ('20261020270000', array[]::text[], 'add_calendar_exports') on conflict (version) do nothing;
-- END MIGRATION 20261020270000_add_calendar_exports.sql
