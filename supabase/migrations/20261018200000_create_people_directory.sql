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
