create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  title_ar text not null check (char_length(btrim(title_ar)) between 2 and 160),
  title_en text check (title_en is null or char_length(btrim(title_en)) between 2 and 160),
  body_ar text not null check (char_length(btrim(body_ar)) between 2 and 4000),
  body_en text check (body_en is null or char_length(btrim(body_en)) between 2 and 4000),
  audience jsonb not null default '{"all":true}'::jsonb,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  published_at timestamptz,
  published_by uuid references public.profiles(id) on delete restrict,
  created_by uuid not null references public.profiles(id) on delete restrict,
  updated_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at),
  check (
    (status = 'draft' and published_at is null and published_by is null)
    or (status in ('published', 'archived') and published_at is not null and published_by is not null)
  )
);

create table public.announcement_deliveries (
  announcement_id uuid not null references public.announcements(id) on delete restrict,
  user_id uuid not null references public.profiles(id) on delete cascade,
  notification_id uuid not null unique references public.notifications(id) on delete cascade,
  delivered_at timestamptz not null default now(),
  primary key (announcement_id, user_id)
);

create index announcements_status_window_idx
on public.announcements (status, starts_at desc, ends_at);
create index announcement_deliveries_user_idx
on public.announcement_deliveries (user_id, delivered_at desc);

create trigger announcements_set_updated_at
before update on public.announcements
for each row execute function public.set_updated_at();
create trigger announcements_audit
after insert or update or delete on public.announcements
for each row execute function public.audit_row();

create or replace function private.announcement_audience_valid(target jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    jsonb_typeof(target) = 'object'
    and target - 'all' - 'roles' - 'countries' - 'level_ids' - 'track_ids' = '{}'::jsonb
    and (not (target ? 'all') or jsonb_typeof(target -> 'all') = 'boolean')
    and (not (target ? 'roles') or (
      jsonb_typeof(target -> 'roles') = 'array'
      and jsonb_array_length(target -> 'roles') between 1 and 4
      and not exists (
        select 1 from jsonb_array_elements_text(target -> 'roles') as value
        where value not in ('admin', 'teacher', 'student', 'parent')
      )
    ))
    and (not (target ? 'countries') or (
      jsonb_typeof(target -> 'countries') = 'array'
      and jsonb_array_length(target -> 'countries') between 1 and 50
      and not exists (
        select 1 from jsonb_array_elements_text(target -> 'countries') as value
        where value !~ '^[A-Z]{2}$'
      )
    ))
    and (not (target ? 'level_ids') or (
      jsonb_typeof(target -> 'level_ids') = 'array'
      and jsonb_array_length(target -> 'level_ids') between 1 and 100
      and not exists (
        select 1 from jsonb_array_elements_text(target -> 'level_ids') as value
        where value !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      )
    ))
    and (not (target ? 'track_ids') or (
      jsonb_typeof(target -> 'track_ids') = 'array'
      and jsonb_array_length(target -> 'track_ids') between 1 and 100
      and not exists (
        select 1 from jsonb_array_elements_text(target -> 'track_ids') as value
        where value !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      )
    ))
    and (
      target ->> 'all' = 'true'
      or target ? 'roles'
      or target ? 'countries'
      or target ? 'level_ids'
      or target ? 'track_ids'
    ),
    false
  )
$$;

alter table public.announcements
add constraint announcements_audience_valid
check (private.announcement_audience_valid(audience));

create or replace function private.protect_published_announcement()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status in ('published', 'archived') and (
    new.title_ar is distinct from old.title_ar
    or new.title_en is distinct from old.title_en
    or new.body_ar is distinct from old.body_ar
    or new.body_en is distinct from old.body_en
    or new.audience is distinct from old.audience
    or new.starts_at is distinct from old.starts_at
    or new.ends_at is distinct from old.ends_at
    or new.published_at is distinct from old.published_at
    or new.published_by is distinct from old.published_by
    or new.created_by is distinct from old.created_by
  ) then
    raise exception using errcode = '55000', message = 'published_announcement_immutable';
  end if;

  if old.status = 'published' and new.status not in ('published', 'archived') then
    raise exception using errcode = '55000', message = 'announcement_transition_invalid';
  end if;

  if old.status = 'archived' and new.status <> 'archived' then
    raise exception using errcode = '55000', message = 'announcement_transition_invalid';
  end if;
  return new;
end;
$$;

create trigger announcements_protect_published
before update on public.announcements
for each row execute function private.protect_published_announcement();

create or replace function private.enqueue_announcement_notification(
  target_user_id uuid,
  notification_payload jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  stored_prefs jsonb;
  notification_id uuid;
begin
  select preference.prefs into stored_prefs
  from public.notification_prefs as preference
  where preference.user_id = target_user_id;

  if coalesce(stored_prefs ->> 'in_app', 'true') = 'false'
    or coalesce(stored_prefs ->> 'announcement', 'true') = 'false' then
    return null;
  end if;

  insert into public.notifications (user_id, type, payload)
  values (target_user_id, 'announcement', notification_payload)
  returning id into notification_id;
  return notification_id;
end;
$$;

create or replace function public.save_admin_announcement(
  p_title_ar text,
  p_title_en text,
  p_body_ar text,
  p_body_en text,
  p_audience jsonb,
  p_starts_at timestamptz,
  p_ends_at timestamptz default null,
  p_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  saved_id uuid;
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'admin_mfa_required';
  end if;
  if char_length(btrim(p_title_ar)) not between 2 and 160
    or char_length(btrim(p_body_ar)) not between 2 and 4000
    or (nullif(btrim(p_title_en), '') is not null and char_length(btrim(p_title_en)) not between 2 and 160)
    or (nullif(btrim(p_body_en), '') is not null and char_length(btrim(p_body_en)) not between 2 and 4000) then
    raise exception using errcode = '22023', message = 'announcement_content_invalid';
  end if;
  if not private.announcement_audience_valid(p_audience) then
    raise exception using errcode = '22023', message = 'announcement_audience_invalid';
  end if;
  if p_starts_at is null or (p_ends_at is not null and p_ends_at <= p_starts_at) then
    raise exception using errcode = '22023', message = 'announcement_window_invalid';
  end if;

  if p_id is null then
    insert into public.announcements (
      title_ar, title_en, body_ar, body_en, audience, starts_at, ends_at, created_by, updated_by
    ) values (
      btrim(p_title_ar), nullif(btrim(p_title_en), ''), btrim(p_body_ar),
      nullif(btrim(p_body_en), ''), p_audience, p_starts_at, p_ends_at,
      (select auth.uid()), (select auth.uid())
    ) returning id into saved_id;
  else
    update public.announcements
    set title_ar = btrim(p_title_ar),
        title_en = nullif(btrim(p_title_en), ''),
        body_ar = btrim(p_body_ar),
        body_en = nullif(btrim(p_body_en), ''),
        audience = p_audience,
        starts_at = p_starts_at,
        ends_at = p_ends_at,
        updated_by = (select auth.uid())
    where id = p_id and status = 'draft'
    returning id into saved_id;
    if saved_id is null then
      raise exception using errcode = '55000', message = 'announcement_not_editable';
    end if;
  end if;
  return saved_id;
end;
$$;

create or replace function public.publish_admin_announcement(p_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  managed public.announcements%rowtype;
  recipient record;
  notification_id uuid;
  delivered integer := 0;
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'admin_mfa_required';
  end if;

  select * into managed
  from public.announcements
  where id = p_id
  for update;
  if managed.id is null or managed.status <> 'draft' then
    raise exception using errcode = '55000', message = 'announcement_not_publishable';
  end if;
  if managed.starts_at > pg_catalog.now() then
    raise exception using errcode = '55000', message = 'announcement_not_started';
  end if;
  if managed.ends_at is not null and managed.ends_at <= pg_catalog.now() then
    raise exception using errcode = '55000', message = 'announcement_expired';
  end if;

  for recipient in
    select profile.id
    from public.profiles as profile
    where profile.is_active
      and (
        managed.audience ->> 'all' = 'true'
        or (
          (not (managed.audience ? 'roles') or (managed.audience -> 'roles') ? profile.role::text)
          and (
            not (managed.audience ? 'countries')
            or (managed.audience -> 'countries') ? profile.country_code
            or exists (
              select 1 from public.students as student
              where student.profile_id = profile.id
                and (managed.audience -> 'countries') ? student.country_code
            )
            or exists (
              select 1
              from public.guardians as guardian
              join public.student_guardians as link on link.guardian_id = guardian.id
              join public.students as student on student.id = link.student_id
              where guardian.profile_id = profile.id
                and (managed.audience -> 'countries') ? student.country_code
            )
          )
          and (
            not (managed.audience ? 'level_ids')
            or exists (
              select 1 from public.students as student
              where student.profile_id = profile.id
                and (managed.audience -> 'level_ids') ? student.level_id::text
            )
            or exists (
              select 1
              from public.guardians as guardian
              join public.student_guardians as link on link.guardian_id = guardian.id
              join public.students as student on student.id = link.student_id
              where guardian.profile_id = profile.id
                and (managed.audience -> 'level_ids') ? student.level_id::text
            )
          )
          and (
            not (managed.audience ? 'track_ids')
            or exists (
              select 1
              from public.students as student
              join public.teacher_assignments as assignment on assignment.student_id = student.id
              where student.profile_id = profile.id
                and assignment.status in ('active', 'paused')
                and (managed.audience -> 'track_ids') ? assignment.track_id::text
            )
            or exists (
              select 1
              from public.guardians as guardian
              join public.student_guardians as link on link.guardian_id = guardian.id
              join public.teacher_assignments as assignment on assignment.student_id = link.student_id
              where guardian.profile_id = profile.id
                and assignment.status in ('active', 'paused')
                and (managed.audience -> 'track_ids') ? assignment.track_id::text
            )
            or exists (
              select 1
              from public.teachers as teacher
              join public.teacher_tracks as teacher_track on teacher_track.teacher_id = teacher.id
              where teacher.profile_id = profile.id
                and (managed.audience -> 'track_ids') ? teacher_track.track_id::text
            )
          )
        )
      )
  loop
    notification_id := private.enqueue_announcement_notification(
      recipient.id,
      jsonb_build_object(
        'announcement_id', managed.id,
        'title_ar', managed.title_ar,
        'title_en', managed.title_en,
        'body_ar', managed.body_ar,
        'body_en', managed.body_en,
        'ends_at', managed.ends_at
      )
    );
    if notification_id is not null then
      insert into public.announcement_deliveries (announcement_id, user_id, notification_id)
      values (managed.id, recipient.id, notification_id)
      on conflict (announcement_id, user_id) do nothing;
      delivered := delivered + 1;
    end if;
  end loop;

  update public.announcements
  set status = 'published',
      published_at = pg_catalog.clock_timestamp(),
      published_by = (select auth.uid()),
      updated_by = (select auth.uid())
  where id = managed.id;
  return delivered;
end;
$$;

create or replace function public.archive_admin_announcement(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'admin_mfa_required';
  end if;
  update public.announcements
  set status = 'archived', updated_by = (select auth.uid())
  where id = p_id and status = 'published';
  if not found then
    raise exception using errcode = '55000', message = 'announcement_not_archivable';
  end if;
end;
$$;

alter table public.announcements enable row level security;
alter table public.announcement_deliveries enable row level security;
revoke all on public.announcements, public.announcement_deliveries from public, anon, authenticated;
grant select on public.announcements, public.announcement_deliveries to authenticated;
grant select, insert, update, delete on public.announcements, public.announcement_deliveries to service_role;

create policy announcements_admin_read on public.announcements
for select to authenticated using ((select public.is_admin()));
create policy announcements_recipient_read on public.announcements
for select to authenticated using (
  status = 'published'
  and starts_at <= pg_catalog.now()
  and (ends_at is null or ends_at > pg_catalog.now())
  and exists (
    select 1 from public.announcement_deliveries as delivery
    where delivery.announcement_id = announcements.id
      and delivery.user_id = (select auth.uid())
  )
);
create policy announcement_deliveries_admin_read on public.announcement_deliveries
for select to authenticated using ((select public.is_admin()));
create policy announcement_deliveries_read_own on public.announcement_deliveries
for select to authenticated using (user_id = (select auth.uid()));

revoke execute on function private.announcement_audience_valid(jsonb) from public, anon, authenticated, service_role;
revoke execute on function private.protect_published_announcement() from public, anon, authenticated, service_role;
revoke execute on function private.enqueue_announcement_notification(uuid, jsonb) from public, anon, authenticated, service_role;
revoke execute on function public.save_admin_announcement(text, text, text, text, jsonb, timestamptz, timestamptz, uuid) from public, anon;
revoke execute on function public.publish_admin_announcement(uuid) from public, anon;
revoke execute on function public.archive_admin_announcement(uuid) from public, anon;
grant execute on function public.save_admin_announcement(text, text, text, text, jsonb, timestamptz, timestamptz, uuid) to authenticated, service_role;
grant execute on function public.publish_admin_announcement(uuid) to authenticated, service_role;
grant execute on function public.archive_admin_announcement(uuid) to authenticated, service_role;
