create table public.content_templates (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('student_report', 'admin_message', 'announcement')),
  name_ar text not null check (char_length(btrim(name_ar)) between 2 and 120),
  name_en text check (name_en is null or char_length(btrim(name_en)) between 2 and 120),
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  created_by uuid not null references public.profiles(id) on delete restrict,
  updated_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.content_template_versions (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.content_templates(id) on delete restrict,
  version_no integer not null check (version_no > 0),
  locale text not null check (locale in ('ar', 'en')),
  subject_template text check (
    subject_template is null or char_length(btrim(subject_template)) between 2 and 200
  ),
  body_template text not null check (char_length(btrim(body_template)) between 2 and 6000),
  variables_schema jsonb not null check (jsonb_typeof(variables_schema) = 'object'),
  created_by uuid not null references public.profiles(id) on delete restrict,
  published_by uuid references public.profiles(id) on delete restrict,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  unique (template_id, version_no, locale),
  check (
    (published_at is null and published_by is null)
    or (published_at is not null and published_by is not null)
  )
);

create index content_templates_kind_status_idx
on public.content_templates (kind, status, updated_at desc);
create index content_template_versions_current_idx
on public.content_template_versions (template_id, version_no desc, locale);
create index content_template_versions_published_idx
on public.content_template_versions (template_id, version_no desc)
where published_at is not null;

alter table public.reports
  add constraint reports_content_template_version_fkey
  foreign key (content_template_version_id)
  references public.content_template_versions(id) on delete restrict;

create or replace function private.content_template_schema(p_kind text)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select case p_kind
    when 'student_report' then '{
      "student_name":{"type":"string"},
      "teacher_name":{"type":"string"},
      "period_start":{"type":"date"},
      "period_end":{"type":"date"},
      "attendance_rate":{"type":"number","fallback":"—"},
      "evaluation_average":{"type":"number","fallback":"—"},
      "mastered_pages":{"type":"number","fallback":"0"},
      "recommendation":{"type":"string","fallback":""}
    }'::jsonb
    when 'admin_message' then '{
      "recipient_name":{"type":"string"},
      "academy_name":{"type":"string","fallback":"أكاديمية نور الوحي"},
      "action_url":{"type":"url","fallback":""},
      "reference_no":{"type":"string","fallback":""}
    }'::jsonb
    when 'announcement' then '{
      "recipient_name":{"type":"string","fallback":""},
      "academy_name":{"type":"string","fallback":"أكاديمية نور الوحي"},
      "country":{"type":"string","fallback":""},
      "role":{"type":"string","fallback":""}
    }'::jsonb
  end
$$;

create or replace function private.content_template_text_valid(p_text text, p_schema jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    p_text is not null
    and regexp_replace(p_text, '\{\{[a-z][a-z0-9_]*\}\}', '', 'g') !~ '[{}]'
    and not exists (
      select 1
      from regexp_matches(p_text, '\{\{([a-z][a-z0-9_]*)\}\}', 'g') as found(captures)
      where not (p_schema ? found.captures[1])
    ),
    false
  )
$$;

create or replace function private.validate_content_template_version()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  template_kind text;
  expected_schema jsonb;
begin
  select template.kind into template_kind
  from public.content_templates as template
  where template.id = new.template_id;
  expected_schema := private.content_template_schema(template_kind);
  if expected_schema is null or new.variables_schema is distinct from expected_schema then
    raise exception using errcode = '23514', message = 'content_template_schema_invalid';
  end if;
  if not private.content_template_text_valid(new.body_template, expected_schema)
    or (new.subject_template is not null
      and not private.content_template_text_valid(new.subject_template, expected_schema)) then
    raise exception using errcode = '23514', message = 'content_template_variable_invalid';
  end if;
  if template_kind in ('admin_message', 'announcement') and new.subject_template is null then
    raise exception using errcode = '23514', message = 'content_template_subject_required';
  end if;
  return new;
end;
$$;

create or replace function private.protect_published_content_template_version()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.published_at is not null then
    raise exception using errcode = '55000', message = 'published_content_template_immutable';
  end if;
  return new;
end;
$$;

revoke all on function private.content_template_schema(text) from public, anon, authenticated, service_role;
revoke all on function private.content_template_text_valid(text, jsonb) from public, anon, authenticated, service_role;
revoke all on function private.validate_content_template_version() from public, anon, authenticated, service_role;
revoke all on function private.protect_published_content_template_version() from public, anon, authenticated, service_role;

create trigger content_templates_set_updated_at
before update on public.content_templates
for each row execute function public.set_updated_at();
create trigger content_templates_audit
after insert or update or delete on public.content_templates
for each row execute function public.audit_row();
create trigger content_template_versions_validate
before insert or update on public.content_template_versions
for each row execute function private.validate_content_template_version();
create trigger content_template_versions_protect_published
before update or delete on public.content_template_versions
for each row when (old.published_at is not null)
execute function private.protect_published_content_template_version();
create trigger content_template_versions_audit
after insert or update or delete on public.content_template_versions
for each row execute function public.audit_row();

alter table public.content_templates enable row level security;
alter table public.content_template_versions enable row level security;
revoke all on public.content_templates, public.content_template_versions
from public, anon, authenticated;
grant select, insert, update on public.content_templates, public.content_template_versions
to authenticated;
grant select, insert, update, delete on public.content_templates, public.content_template_versions
to service_role;

create policy content_templates_admin_all
on public.content_templates for all to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));
create policy content_template_versions_admin_all
on public.content_template_versions for all to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));
create policy content_templates_teacher_report_read
on public.content_templates for select to authenticated
using (kind = 'student_report' and status = 'published' and (select public.auth_role()) = 'teacher');
create policy content_template_versions_teacher_report_read
on public.content_template_versions for select to authenticated
using (
  published_at is not null
  and (select public.auth_role()) = 'teacher'
  and exists (
    select 1 from public.content_templates as template
    where template.id = content_template_versions.template_id
      and template.kind = 'student_report' and template.status = 'published'
  )
);

create or replace function public.save_content_template(
  p_kind text,
  p_name_ar text,
  p_name_en text,
  p_subject_ar text,
  p_body_ar text,
  p_subject_en text,
  p_body_en text,
  p_template uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
set statement_timeout = '5s'
as $$
declare
  saved_id uuid;
  next_version integer;
  draft_version integer;
  actor uuid := (select auth.uid());
  schema_value jsonb := private.content_template_schema(p_kind);
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'admin_mfa_required';
  end if;
  if schema_value is null
    or char_length(btrim(p_name_ar)) not between 2 and 120
    or char_length(btrim(p_body_ar)) not between 2 and 6000
    or char_length(btrim(p_body_en)) not between 2 and 6000 then
    raise exception using errcode = '22023', message = 'content_template_input_invalid';
  end if;

  if p_template is null then
    insert into public.content_templates (kind, name_ar, name_en, created_by, updated_by)
    values (p_kind, btrim(p_name_ar), nullif(btrim(p_name_en), ''), actor, actor)
    returning id into saved_id;
    draft_version := 1;
  else
    select template.id into saved_id
    from public.content_templates as template
    where template.id = p_template and template.kind = p_kind and template.status <> 'archived'
    for update;
    if saved_id is null then
      raise exception using errcode = 'P0002', message = 'content_template_not_found';
    end if;
    update public.content_templates
    set name_ar = btrim(p_name_ar), name_en = nullif(btrim(p_name_en), ''), updated_by = actor
    where id = saved_id;
    select max(version.version_no) filter (where version.published_at is null),
      coalesce(max(version.version_no), 0) + 1
    into draft_version, next_version
    from public.content_template_versions as version
    where version.template_id = saved_id;
    draft_version := coalesce(draft_version, next_version);
  end if;

  insert into public.content_template_versions (
    template_id, version_no, locale, subject_template, body_template,
    variables_schema, created_by
  ) values
    (saved_id, draft_version, 'ar', nullif(btrim(p_subject_ar), ''), btrim(p_body_ar), schema_value, actor),
    (saved_id, draft_version, 'en', nullif(btrim(p_subject_en), ''), btrim(p_body_en), schema_value, actor)
  on conflict (template_id, version_no, locale) do update
  set subject_template = excluded.subject_template,
    body_template = excluded.body_template,
    variables_schema = excluded.variables_schema
  where content_template_versions.published_at is null;

  return saved_id;
end;
$$;

create or replace function public.publish_content_template(p_template uuid)
returns integer
language plpgsql
security definer
set search_path = ''
set statement_timeout = '5s'
as $$
declare
  version_number integer;
  actor uuid := (select auth.uid());
  published_count integer;
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'admin_mfa_required';
  end if;
  perform 1 from public.content_templates where id = p_template and status <> 'archived' for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'content_template_not_found';
  end if;
  select max(version_no) into version_number
  from public.content_template_versions
  where template_id = p_template and published_at is null;
  if version_number is null or (
    select count(*) from public.content_template_versions
    where template_id = p_template and version_no = version_number and published_at is null
  ) <> 2 then
    raise exception using errcode = '55000', message = 'content_template_locales_incomplete';
  end if;
  update public.content_template_versions
  set published_by = actor, published_at = pg_catalog.clock_timestamp()
  where template_id = p_template and version_no = version_number and published_at is null;
  get diagnostics published_count = row_count;
  update public.content_templates set status = 'published', updated_by = actor where id = p_template;
  return published_count;
end;
$$;

create or replace function public.archive_content_template(p_template uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'admin_mfa_required';
  end if;
  update public.content_templates
  set status = 'archived', updated_by = (select auth.uid())
  where id = p_template and status <> 'archived';
  if not found then
    raise exception using errcode = 'P0002', message = 'content_template_not_found';
  end if;
end;
$$;

create or replace function public.render_content_template(
  p_version uuid,
  p_values jsonb,
  p_locale text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set statement_timeout = '5s'
as $$
declare
  version_row public.content_template_versions%rowtype;
  template_kind text;
  allowed jsonb;
  rendered_subject text;
  rendered_body text;
  variable record;
  replacement text;
  missing text[] := array[]::text[];
begin
  if p_locale not in ('ar', 'en') or jsonb_typeof(p_values) <> 'object' then
    raise exception using errcode = '22023', message = 'content_template_render_input_invalid';
  end if;
  select version.* into version_row
  from public.content_template_versions as version
  where version.id = p_version and version.locale = p_locale;
  if version_row.id is null then
    raise exception using errcode = 'P0002', message = 'content_template_version_not_found';
  end if;
  select template.kind into template_kind
  from public.content_templates as template where template.id = version_row.template_id;
  if not public.is_admin() and not (
    (select public.auth_role()) = 'teacher'
    and template_kind = 'student_report' and version_row.published_at is not null
  ) then
    raise exception using errcode = '42501', message = 'content_template_render_forbidden';
  end if;
  allowed := version_row.variables_schema;
  if p_values - array(select jsonb_object_keys(allowed)) <> '{}'::jsonb then
    raise exception using errcode = '22023', message = 'content_template_values_unknown';
  end if;
  rendered_subject := version_row.subject_template;
  rendered_body := version_row.body_template;
  for variable in select key, value from jsonb_each(allowed) order by key loop
    replacement := case
      when p_values ? variable.key and jsonb_typeof(p_values -> variable.key) in ('string', 'number', 'boolean')
        then left(p_values ->> variable.key, 2000)
      when variable.value ? 'fallback' then variable.value ->> 'fallback'
      else null
    end;
    if replacement is null then
      missing := array_append(missing, variable.key);
      replacement := '';
    end if;
    replacement := regexp_replace(replacement, '[\u0000-\u0008\u000B\u000C\u000E-\u001F]', '', 'g');
    rendered_subject := replace(rendered_subject, '{{' || variable.key || '}}', replacement);
    rendered_body := replace(rendered_body, '{{' || variable.key || '}}', replacement);
  end loop;
  return jsonb_build_object(
    'subject', rendered_subject,
    'body', rendered_body,
    'missing', to_jsonb(missing),
    'version_id', version_row.id,
    'version_no', version_row.version_no,
    'locale', version_row.locale
  );
end;
$$;

revoke all on function public.save_content_template(text, text, text, text, text, text, text, uuid)
from public, anon, authenticated, service_role;
revoke all on function public.publish_content_template(uuid)
from public, anon, authenticated, service_role;
revoke all on function public.archive_content_template(uuid)
from public, anon, authenticated, service_role;
revoke all on function public.render_content_template(uuid, jsonb, text)
from public, anon, authenticated, service_role;
grant execute on function public.save_content_template(text, text, text, text, text, text, text, uuid)
to authenticated;
grant execute on function public.publish_content_template(uuid) to authenticated;
grant execute on function public.archive_content_template(uuid) to authenticated;
grant execute on function public.render_content_template(uuid, jsonb, text) to authenticated;

comment on table public.content_template_versions is
'P10-T05 deterministic localized content template versions; published rows are immutable.';
