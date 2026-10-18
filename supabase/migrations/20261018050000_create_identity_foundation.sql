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
