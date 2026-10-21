create sequence public.certificate_serial_seq;
revoke all on sequence public.certificate_serial_seq from public, anon, authenticated;
grant usage, select on sequence public.certificate_serial_seq to service_role;

create table public.certificate_templates (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('memorization','excellence','attendance','ijazah','juz','other')),
  name_ar text not null check (char_length(btrim(name_ar)) between 2 and 120),
  name_en text check (name_en is null or char_length(btrim(name_en)) between 2 and 120),
  is_active boolean not null default true,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.certificate_template_versions (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.certificate_templates(id) on delete restrict,
  version integer not null check (version > 0),
  status text not null default 'draft' check (status in ('draft','published','archived')),
  title_ar text not null check (char_length(btrim(title_ar)) between 2 and 180),
  title_en text check (title_en is null or char_length(btrim(title_en)) between 2 and 180),
  body_ar text not null check (char_length(btrim(body_ar)) between 10 and 1200),
  body_en text check (body_en is null or char_length(btrim(body_en)) between 10 and 1200),
  logo_path text check (logo_path is null or logo_path ~ '^certificates/logos/[a-zA-Z0-9._/-]{1,180}$'),
  seal_path text check (seal_path is null or seal_path ~ '^certificates/seals/[a-zA-Z0-9._/-]{1,180}$'),
  signatures jsonb not null default '[]'::jsonb check (jsonb_typeof(signatures) = 'array' and jsonb_array_length(signatures) <= 3),
  theme jsonb not null default '{"style":"geometric","primary":"#102b50","accent":"#d3aa45"}'::jsonb check (jsonb_typeof(theme) = 'object'),
  created_by uuid not null references public.profiles(id) on delete restrict,
  published_by uuid references public.profiles(id) on delete restrict,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(template_id, version),
  check ((status = 'published' and published_by is not null and published_at is not null) or status <> 'published')
);
create unique index certificate_one_draft_idx on public.certificate_template_versions(template_id) where status = 'draft';
create index certificate_versions_template_idx on public.certificate_template_versions(template_id, version desc);

create table public.certificates (
  id uuid primary key default gen_random_uuid(),
  template_version_id uuid not null references public.certificate_template_versions(id) on delete restrict,
  student_id uuid not null references public.students(id) on delete restrict,
  kind text not null check (kind in ('memorization','excellence','attendance','ijazah','juz','other')),
  serial_no text not null unique check (serial_no ~ '^NAW-[0-9]{4}-[0-9]{8}$'),
  verify_code text not null unique check (char_length(verify_code) >= 32),
  locale text not null default 'ar' check (locale in ('ar','en')),
  payload_snapshot jsonb not null check (jsonb_typeof(payload_snapshot) = 'object'),
  template_snapshot jsonb not null check (jsonb_typeof(template_snapshot) = 'object'),
  idempotency_key text not null unique check (char_length(idempotency_key) between 8 and 180),
  issued_by uuid not null references public.profiles(id) on delete restrict,
  issued_at timestamptz not null default now(),
  pdf_path text,
  pdf_sha256 text check (pdf_sha256 is null or pdf_sha256 ~ '^[a-f0-9]{64}$'),
  revoked_at timestamptz,
  revoked_by uuid references public.profiles(id) on delete restrict,
  revoke_reason text,
  created_at timestamptz not null default now(),
  check ((revoked_at is null and revoked_by is null and revoke_reason is null) or (revoked_at is not null and revoked_by is not null and char_length(btrim(revoke_reason)) between 5 and 500))
);
create index certificates_student_issued_idx on public.certificates(student_id, issued_at desc);
create index certificates_status_idx on public.certificates(revoked_at, issued_at desc);

create table public.certificate_batches (
  id uuid primary key default gen_random_uuid(),
  template_version_id uuid not null references public.certificate_template_versions(id) on delete restrict,
  locale text not null check (locale in ('ar','en')),
  achievement text not null check (char_length(btrim(achievement)) between 2 and 500),
  status text not null default 'queued' check (status in ('queued','processing','completed','partial','failed')),
  idempotency_key text not null unique check (char_length(idempotency_key) between 8 and 180),
  total_count integer not null check (total_count between 1 and 500),
  completed_count integer not null default 0 check (completed_count >= 0),
  failed_count integer not null default 0 check (failed_count >= 0),
  created_by uuid not null references public.profiles(id) on delete restrict,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (completed_count + failed_count <= total_count)
);

create table public.certificate_batch_items (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.certificate_batches(id) on delete restrict,
  student_id uuid not null references public.students(id) on delete restrict,
  status text not null default 'queued' check (status in ('queued','processing','completed','failed')),
  certificate_id uuid references public.certificates(id) on delete restrict,
  attempts integer not null default 0 check (attempts between 0 and 5),
  error_code text,
  updated_at timestamptz not null default now(),
  unique(batch_id, student_id),
  check ((status = 'completed' and certificate_id is not null and error_code is null) or status <> 'completed')
);
create index certificate_batch_items_queue_idx on public.certificate_batch_items(batch_id, status, updated_at);

create or replace function private.validate_certificate_template_version()
returns trigger language plpgsql set search_path = '' as $$
declare rendered text; theme_key text; signature jsonb;
begin
  if tg_op = 'UPDATE' and old.status in ('published','archived') then
    raise exception using errcode='P0001', message='published_certificate_template_immutable';
  end if;
  rendered := replace(replace(replace(replace(new.body_ar,'{{student_name}}',''),'{{achievement}}',''),'{{issued_on}}',''),'{{serial_no}}','');
  if rendered ~ '\{\{[^}]+\}\}' then raise exception using errcode='23514',message='certificate_variable_not_allowed'; end if;
  if new.body_en is not null then
    rendered := replace(replace(replace(replace(new.body_en,'{{student_name}}',''),'{{achievement}}',''),'{{issued_on}}',''),'{{serial_no}}','');
    if rendered ~ '\{\{[^}]+\}\}' then raise exception using errcode='23514',message='certificate_variable_not_allowed'; end if;
  end if;
  for theme_key in select jsonb_object_keys(new.theme) loop
    if theme_key not in ('style','primary','accent','border','pattern') then raise exception using errcode='23514',message='certificate_theme_key_not_allowed'; end if;
  end loop;
  if coalesce(new.theme->>'style','') not in ('geometric','arabesque','minimal','illuminated') then raise exception using errcode='23514',message='certificate_style_invalid'; end if;
  if coalesce(new.theme->>'primary','') !~ '^#[0-9a-fA-F]{6}$' or coalesce(new.theme->>'accent','') !~ '^#[0-9a-fA-F]{6}$' then raise exception using errcode='23514',message='certificate_color_invalid'; end if;
  for signature in select value from jsonb_array_elements(new.signatures) loop
    if jsonb_typeof(signature) <> 'object' or not (signature ? 'name' and signature ? 'title')
      or char_length(signature->>'name') not between 2 and 100 or char_length(signature->>'title') not between 2 and 100
      or exists(select 1 from jsonb_object_keys(signature) as key where key not in ('name','title','image_path')) then
      raise exception using errcode='23514',message='certificate_signature_invalid';
    end if;
    if signature ? 'image_path' and (signature->>'image_path') !~ '^certificates/signatures/[a-zA-Z0-9._/-]{1,180}$' then raise exception using errcode='23514',message='certificate_signature_path_invalid'; end if;
  end loop;
  return new;
end;
$$;
revoke execute on function private.validate_certificate_template_version() from public,anon,authenticated,service_role;
create trigger certificate_template_versions_validate before insert or update on public.certificate_template_versions for each row execute function private.validate_certificate_template_version();

create or replace function private.guard_certificate_update()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.id is distinct from old.id or new.template_version_id is distinct from old.template_version_id
    or new.student_id is distinct from old.student_id or new.kind is distinct from old.kind
    or new.serial_no is distinct from old.serial_no or new.verify_code is distinct from old.verify_code
    or new.locale is distinct from old.locale or new.payload_snapshot is distinct from old.payload_snapshot
    or new.template_snapshot is distinct from old.template_snapshot or new.idempotency_key is distinct from old.idempotency_key
    or new.issued_by is distinct from old.issued_by or new.issued_at is distinct from old.issued_at
    or (old.pdf_sha256 is not null and new.pdf_sha256 is distinct from old.pdf_sha256)
    or (old.pdf_path is not null and new.pdf_path is distinct from old.pdf_path) then
    raise exception using errcode='P0001',message='issued_certificate_immutable';
  end if;
  return new;
end;
$$;
revoke execute on function private.guard_certificate_update() from public,anon,authenticated,service_role;
create trigger certificates_guard_update before update on public.certificates for each row execute function private.guard_certificate_update();

create or replace function public.publish_certificate_template(p_version uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception using errcode='42501',message='admin_mfa_required'; end if;
  update public.certificate_template_versions set status='published',published_by=(select auth.uid()),published_at=now()
  where id=p_version and status='draft';
  if not found then raise exception using errcode='P0001',message='certificate_template_not_publishable'; end if;
end;
$$;
revoke execute on function public.publish_certificate_template(uuid) from public,anon;
grant execute on function public.publish_certificate_template(uuid) to authenticated,service_role;

create or replace function public.clone_certificate_template_version(p_version uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare source public.certificate_template_versions%rowtype; result uuid;
begin
  if not public.is_admin() then raise exception using errcode='42501',message='admin_mfa_required'; end if;
  select * into source from public.certificate_template_versions where id=p_version and status in ('published','archived');
  if source.id is null then raise exception using errcode='P0001',message='certificate_template_not_cloneable'; end if;
  insert into public.certificate_template_versions(template_id,version,title_ar,title_en,body_ar,body_en,logo_path,seal_path,signatures,theme,created_by)
  select source.template_id,max(version)+1,source.title_ar,source.title_en,source.body_ar,source.body_en,source.logo_path,source.seal_path,source.signatures,source.theme,(select auth.uid())
  from public.certificate_template_versions where template_id=source.template_id returning id into result;
  return result;
end;
$$;
revoke execute on function public.clone_certificate_template_version(uuid) from public,anon;
grant execute on function public.clone_certificate_template_version(uuid) to authenticated,service_role;

create or replace function public.issue_certificate(p_version uuid,p_student uuid,p_locale text,p_achievement text,p_idempotency_key text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare version_row public.certificate_template_versions%rowtype; template_row public.certificate_templates%rowtype; student_name text; result uuid; serial text; code text;
begin
  if not public.is_admin() then raise exception using errcode='42501',message='admin_mfa_required'; end if;
  if p_locale not in ('ar','en') or char_length(btrim(p_achievement)) not between 2 and 500 or char_length(p_idempotency_key) not between 8 and 180 then raise exception using errcode='22023',message='certificate_issue_invalid'; end if;
  select id into result from public.certificates where idempotency_key=p_idempotency_key;
  if result is not null then return result; end if;
  select * into version_row from public.certificate_template_versions where id=p_version and status='published';
  if version_row.id is null then raise exception using errcode='P0001',message='certificate_template_not_published'; end if;
  select * into template_row from public.certificate_templates where id=version_row.template_id and is_active;
  select full_name into student_name from public.students where id=p_student and status='active';
  if template_row.id is null or student_name is null then raise exception using errcode='P0001',message='certificate_subject_unavailable'; end if;
  serial := 'NAW-'||extract(year from current_date)::integer||'-'||lpad(nextval('public.certificate_serial_seq')::text,8,'0');
  code := encode(gen_random_bytes(24),'hex');
  insert into public.certificates(template_version_id,student_id,kind,serial_no,verify_code,locale,payload_snapshot,template_snapshot,idempotency_key,issued_by)
  values(version_row.id,p_student,template_row.kind,serial,code,p_locale,
    jsonb_build_object('student_name',student_name,'achievement',btrim(p_achievement),'issued_on',current_date,'serial_no',serial),
    to_jsonb(version_row)-array['created_by','published_by'],p_idempotency_key,(select auth.uid())) returning id into result;
  perform private.notify_session_parties(p_student,'certificate_issued',jsonb_build_object('certificate_id',result,'kind',template_row.kind));
  return result;
end;
$$;
revoke execute on function public.issue_certificate(uuid,uuid,text,text,text) from public,anon;
grant execute on function public.issue_certificate(uuid,uuid,text,text,text) to authenticated,service_role;

create or replace function public.enqueue_certificate_batch(p_version uuid,p_students uuid[],p_locale text,p_achievement text,p_idempotency_key text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare result uuid; distinct_count integer;
begin
  if not public.is_admin() then raise exception using errcode='42501',message='admin_mfa_required'; end if;
  select id into result from public.certificate_batches where idempotency_key=p_idempotency_key;
  if result is not null then return result; end if;
  select count(distinct value) into distinct_count from unnest(p_students) as student_id(value);
  if distinct_count < 1 or distinct_count > 500 or p_locale not in ('ar','en') or char_length(btrim(p_achievement)) not between 2 and 500 then raise exception using errcode='22023',message='certificate_batch_invalid'; end if;
  if not exists(select 1 from public.certificate_template_versions where id=p_version and status='published') then raise exception using errcode='P0001',message='certificate_template_not_published'; end if;
  insert into public.certificate_batches(template_version_id,locale,achievement,idempotency_key,total_count,created_by)
  values(p_version,p_locale,btrim(p_achievement),p_idempotency_key,distinct_count,(select auth.uid())) returning id into result;
  insert into public.certificate_batch_items(batch_id,student_id) select result,value from (select distinct unnest(p_students) as value) as students;
  return result;
end;
$$;
revoke execute on function public.enqueue_certificate_batch(uuid,uuid[],text,text,text) from public,anon;
grant execute on function public.enqueue_certificate_batch(uuid,uuid[],text,text,text) to authenticated,service_role;

create or replace function public.process_certificate_batch(p_batch uuid,p_limit integer default 10)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare batch public.certificate_batches%rowtype; item record; issued uuid; completed integer; failed integer;
begin
  if not public.is_admin() then raise exception using errcode='42501',message='admin_mfa_required'; end if;
  if p_limit not between 1 and 25 then raise exception using errcode='22023',message='certificate_batch_limit_invalid'; end if;
  select * into batch from public.certificate_batches where id=p_batch for update;
  if batch.id is null or batch.status not in ('queued','processing','partial','failed') then raise exception using errcode='P0001',message='certificate_batch_not_processable'; end if;
  update public.certificate_batches set status='processing',started_at=coalesce(started_at,now()) where id=p_batch;
  for item in select id,student_id,attempts from public.certificate_batch_items where batch_id=p_batch and status in ('queued','failed') and attempts<5 order by updated_at for update skip locked limit p_limit loop
    begin
      update public.certificate_batch_items set status='processing',attempts=attempts+1,error_code=null where id=item.id;
      issued := public.issue_certificate(batch.template_version_id,item.student_id,batch.locale,batch.achievement,batch.idempotency_key||':'||item.student_id);
      update public.certificate_batch_items set status='completed',certificate_id=issued,error_code=null where id=item.id;
    exception when others then
      update public.certificate_batch_items set status='failed',attempts=attempts+1,error_code=left(sqlstate||':'||sqlerrm,180) where id=item.id;
    end;
  end loop;
  select count(*) filter(where status='completed'),count(*) filter(where status='failed') into completed,failed from public.certificate_batch_items where batch_id=p_batch;
  update public.certificate_batches set completed_count=completed,failed_count=failed,
    status=case when completed=total_count then 'completed' when completed+failed=total_count then case when completed>0 then 'partial' else 'failed' end else 'queued' end,
    finished_at=case when completed+failed=total_count then now() else null end where id=p_batch;
  return jsonb_build_object('completed',completed,'failed',failed,'remaining',batch.total_count-completed-failed);
end;
$$;
revoke execute on function public.process_certificate_batch(uuid,integer) from public,anon;
grant execute on function public.process_certificate_batch(uuid,integer) to authenticated,service_role;

create trigger certificate_templates_updated before update on public.certificate_templates for each row execute function public.set_updated_at();
create trigger certificate_template_versions_updated before update on public.certificate_template_versions for each row execute function public.set_updated_at();
create trigger certificate_batches_updated before update on public.certificate_batches for each row execute function public.set_updated_at();
create trigger certificate_batch_items_updated before update on public.certificate_batch_items for each row execute function public.set_updated_at();
create trigger certificate_templates_audit after insert or update or delete on public.certificate_templates for each row execute function public.audit_row();
create trigger certificate_template_versions_audit after insert or update or delete on public.certificate_template_versions for each row execute function public.audit_row();
create trigger certificates_audit after insert or update on public.certificates for each row execute function public.audit_row();
create trigger certificate_batches_audit after insert or update on public.certificate_batches for each row execute function public.audit_row();

alter table public.certificate_templates enable row level security;
alter table public.certificate_template_versions enable row level security;
alter table public.certificates enable row level security;
alter table public.certificate_batches enable row level security;
alter table public.certificate_batch_items enable row level security;
revoke all on public.certificate_templates,public.certificate_template_versions,public.certificates,public.certificate_batches,public.certificate_batch_items from public,anon,authenticated;
grant select,insert,update on public.certificate_templates,public.certificate_template_versions to authenticated;
grant select on public.certificates,public.certificate_batches,public.certificate_batch_items to authenticated;
grant select,insert,update,delete on public.certificate_templates,public.certificate_template_versions,public.certificates,public.certificate_batches,public.certificate_batch_items to service_role;
create policy certificate_templates_admin_all on public.certificate_templates for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy certificate_versions_admin_all on public.certificate_template_versions for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy certificates_admin_read on public.certificates for select to authenticated using ((select public.is_admin()));
create policy certificates_student_read on public.certificates for select to authenticated using (exists(select 1 from public.students where id=certificates.student_id and profile_id=(select auth.uid())));
create policy certificates_parent_read on public.certificates for select to authenticated using ((select private.guards_student(student_id)));
create policy certificate_batches_admin_read on public.certificate_batches for select to authenticated using ((select public.is_admin()));
create policy certificate_batch_items_admin_read on public.certificate_batch_items for select to authenticated using ((select public.is_admin()));
