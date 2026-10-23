insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'admin-exports',
  'admin-exports',
  false,
  20971520,
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
on conflict (id) do update
set public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table public.export_jobs (
  id uuid primary key default gen_random_uuid(),
  requested_by uuid not null references public.profiles(id) on delete restrict,
  report_type text not null check (
    report_type in ('students', 'sessions', 'finance', 'interventions')
  ),
  format text not null check (format in ('pdf', 'xlsx')),
  filters_snapshot jsonb not null check (jsonb_typeof(filters_snapshot) = 'object'),
  selected_columns text[] not null,
  locale text not null check (locale in ('ar', 'en')),
  timezone text not null check (char_length(btrim(timezone)) between 1 and 100),
  status text not null default 'queued' check (
    status in ('queued', 'processing', 'completed', 'failed', 'expired')
  ),
  attempts smallint not null default 0 check (attempts between 0 and 3),
  next_attempt_at timestamptz not null default now(),
  storage_path text unique check (
    storage_path is null
    or (
      char_length(storage_path) between 20 and 500
      and storage_path !~ '^[a-z]+://'
      and storage_path !~ '(^|/)\.\.(/|$)'
    )
  ),
  file_sha256 text check (file_sha256 is null or file_sha256 ~ '^[a-f0-9]{64}$'),
  row_count integer check (row_count is null or row_count >= 0),
  error_code text check (
    error_code is null or error_code ~ '^[a-z][a-z0-9_]{2,79}$'
  ),
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  expires_at timestamptz,
  check (cardinality(selected_columns) between 1 and 20),
  check (array_position(selected_columns, null) is null),
  check (
    (status = 'queued'
      and started_at is null and finished_at is null and storage_path is null
      and file_sha256 is null and row_count is null and error_code is null and expires_at is null)
    or (status = 'processing'
      and started_at is not null and finished_at is null and storage_path is null
      and file_sha256 is null and row_count is null and error_code is null and expires_at is null)
    or (status = 'completed'
      and started_at is not null and finished_at is not null and storage_path is not null
      and file_sha256 is not null and row_count is not null and error_code is null
      and expires_at is not null and expires_at > finished_at)
    or (status = 'failed'
      and started_at is not null and finished_at is not null and storage_path is null
      and file_sha256 is null and row_count is null and error_code is not null and expires_at is null)
    or (status = 'expired'
      and started_at is not null and finished_at is not null and storage_path is null
      and file_sha256 is not null and row_count is not null and error_code is null
      and expires_at is not null)
  )
);

create index export_jobs_requester_created_idx
on public.export_jobs (requested_by, created_at desc, id);
create index export_jobs_worker_queue_idx
on public.export_jobs (next_attempt_at, created_at, id)
where status = 'queued';
create index export_jobs_expiry_idx
on public.export_jobs (expires_at, id)
where status = 'completed';

create or replace function private.admin_export_columns(p_report_type text)
returns text[]
language sql
immutable
set search_path = ''
as $$
  select case p_report_type
    when 'students' then array[
      'student_no', 'full_name', 'country', 'status', 'track', 'teacher',
      'subscription_status', 'sessions', 'attendance_rate', 'evaluation_average'
    ]::text[]
    when 'sessions' then array[
      'scheduled_at', 'student', 'teacher', 'status', 'attendance_status',
      'duration_min', 'track', 'country'
    ]::text[]
    when 'finance' then array[
      'invoice_no', 'student', 'country', 'currency', 'total', 'paid',
      'outstanding', 'status', 'due_date', 'created_at'
    ]::text[]
    when 'interventions' then array[
      'rule_type', 'subject_type', 'subject_id', 'priority', 'status',
      'reason_code', 'recommended_action', 'first_detected_at',
      'last_detected_at', 'detection_count'
    ]::text[]
  end
$$;

create or replace function private.validate_export_job()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  allowed_columns text[] := private.admin_export_columns(new.report_type);
  allowed_filter_keys constant text[] := array[
    'from', 'to', 'country', 'track', 'teacher', 'status', 'sort', 'direction'
  ];
begin
  if allowed_columns is null
    or not new.selected_columns <@ allowed_columns
    or cardinality(new.selected_columns) <> cardinality(array(select distinct unnest(new.selected_columns))) then
    raise exception using errcode = '23514', message = 'export_columns_invalid';
  end if;
  if exists (
    select 1 from jsonb_object_keys(new.filters_snapshot) as filter_key
    where filter_key <> all(allowed_filter_keys)
  ) then
    raise exception using errcode = '23514', message = 'export_filters_invalid';
  end if;
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = new.timezone) then
    raise exception using errcode = '22023', message = 'export_timezone_invalid';
  end if;
  return new;
end;
$$;

revoke all on function private.admin_export_columns(text)
from public, anon, authenticated, service_role;
revoke all on function private.validate_export_job()
from public, anon, authenticated, service_role;

create trigger export_jobs_validate
before insert or update of report_type, filters_snapshot, selected_columns, timezone
on public.export_jobs
for each row execute function private.validate_export_job();
create trigger export_jobs_audit
after insert or update on public.export_jobs
for each row execute function public.audit_row();

alter table public.export_jobs enable row level security;
revoke all on public.export_jobs from public, anon, authenticated;
grant select on public.export_jobs to authenticated;
grant select, insert, update on public.export_jobs to service_role;

create policy export_jobs_admin_read_own
on public.export_jobs for select to authenticated
using ((select public.is_admin()) and requested_by = (select auth.uid()));

create policy admin_exports_owner_read
on storage.objects for select to authenticated
using (
  bucket_id = 'admin-exports'
  and (select public.is_admin())
  and exists (
    select 1 from public.export_jobs as export_job
    where export_job.storage_path = storage.objects.name
      and export_job.requested_by = (select auth.uid())
      and export_job.status = 'completed'
      and export_job.expires_at > pg_catalog.now()
  )
);

create or replace function public.queue_admin_export(
  p_report_type text,
  p_format text,
  p_filters jsonb,
  p_columns text[],
  p_locale text,
  p_timezone text
)
returns uuid
language plpgsql
security definer
set search_path = ''
set statement_timeout = '5s'
as $$
declare
  queued_id uuid;
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'admin_mfa_required';
  end if;
  if p_report_type is null or p_format is null or p_filters is null
    or p_columns is null or p_locale is null or p_timezone is null then
    raise exception using errcode = '22023', message = 'export_input_invalid';
  end if;
  if (p_filters ->> 'from') is null or (p_filters ->> 'to') is null
    or not pg_catalog.pg_input_is_valid(p_filters ->> 'from', 'date')
    or not pg_catalog.pg_input_is_valid(p_filters ->> 'to', 'date')
    or (p_filters ->> 'from')::date > (p_filters ->> 'to')::date
    or (p_filters ->> 'to')::date - (p_filters ->> 'from')::date > 366 then
    raise exception using errcode = '22023', message = 'export_period_invalid';
  end if;

  insert into public.export_jobs (
    requested_by, report_type, format, filters_snapshot,
    selected_columns, locale, timezone
  ) values (
    (select auth.uid()), p_report_type, p_format, p_filters,
    p_columns, p_locale, p_timezone
  )
  returning id into queued_id;
  return queued_id;
end;
$$;

revoke all on function public.queue_admin_export(text, text, jsonb, text[], text, text)
from public, anon, authenticated, service_role;
grant execute on function public.queue_admin_export(text, text, jsonb, text[], text, text)
to authenticated;

create or replace function public.expire_admin_export_jobs(
  p_at timestamptz default pg_catalog.now()
)
returns text[]
language plpgsql
security definer
set search_path = ''
set statement_timeout = '10s'
as $$
declare
  expired_paths text[];
begin
  if current_user not in ('postgres', 'service_role') then
    raise exception using errcode = '42501', message = 'export_worker_forbidden';
  end if;
  select array_agg(storage_path order by id)
  into expired_paths
  from public.export_jobs
  where status = 'completed' and expires_at <= p_at;

  update public.export_jobs
  set status = 'expired', storage_path = null
  where status = 'completed' and expires_at <= p_at;
  return coalesce(expired_paths, array[]::text[]);
end;
$$;

revoke all on function public.expire_admin_export_jobs(timestamptz)
from public, anon, authenticated, service_role;
grant execute on function public.expire_admin_export_jobs(timestamptz) to service_role;

comment on table public.export_jobs is
'Private P10 report export queue. Filters and selected columns are immutable snapshots for reproducible output.';
