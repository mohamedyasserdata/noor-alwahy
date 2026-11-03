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
