-- Generated staging deployment bundle. Source of truth remains supabase/migrations/.
-- BEGIN MIGRATION 20261022090000_create_exams.sql
create table public.exams (
  id uuid primary key default gen_random_uuid(),
  title_ar text not null check (char_length(btrim(title_ar)) between 2 and 200),
  title_en text check (title_en is null or char_length(btrim(title_en)) between 2 and 200),
  kind text not null check (kind in ('monthly','term','final','juz')),
  session_type public.session_type_t not null default 'new_memo',
  track_id uuid references public.tracks(id) on delete restrict,
  max_score numeric(6,2) not null check (max_score > 0 and max_score <= 10000),
  weight numeric(5,2) not null default 1 check (weight > 0 and weight <= 100),
  held_on date not null,
  status text not null default 'draft' check (status in ('draft','open','closed')),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index exams_track_date_idx on public.exams(track_id, held_on desc);

create table public.exam_results (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams(id) on delete restrict,
  student_id uuid not null references public.students(id) on delete restrict,
  scores jsonb not null check (jsonb_typeof(scores) = 'object'),
  errors jsonb not null default '{"major":0,"minor":0,"prompts":0,"forgot":0}'::jsonb check (jsonb_typeof(errors) = 'object'),
  percentage numeric(6,2) not null default 0 check (percentage between 0 and 100),
  total numeric(8,2) not null default 0 check (total >= 0),
  rating smallint not null default 1 check (rating between 1 and 5),
  grade text not null default 'repeat' check (grade in ('repeat','pass','good','very_good','excellent')),
  settings_snapshot jsonb not null default '{}'::jsonb check (jsonb_typeof(settings_snapshot) = 'object'),
  entered_by uuid not null references public.profiles(id) on delete restrict,
  is_locked boolean not null default false,
  locked_by uuid references public.profiles(id) on delete restrict,
  locked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(exam_id, student_id),
  check ((is_locked and locked_by is not null and locked_at is not null) or (not is_locked and locked_by is null and locked_at is null))
);
create index exam_results_student_idx on public.exam_results(student_id, created_at desc);

create or replace function private.prepare_exam_result()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare exam_row public.exams%rowtype; settings_row public.eval_settings%rowtype;
  score_entry record; score_value numeric; criterion_weight numeric; weighted_sum numeric := 0; total_weight numeric := 0;
  deduction numeric; computed numeric; thresholds numeric[]; snapshot_weights jsonb := '{}'::jsonb;
  major_count integer; minor_count integer; prompt_count integer; forgot_count integer;
begin
  if tg_op = 'UPDATE' and old.is_locked then raise exception using errcode = 'P0001', message = 'exam_result_locked'; end if;
  select * into exam_row from public.exams where id = new.exam_id;
  if exam_row.id is null or exam_row.status <> 'open' then raise exception using errcode = 'P0001', message = 'exam_not_open'; end if;
  if new.scores = '{}'::jsonb then raise exception using errcode = '23514', message = 'exam_scores_required'; end if;
  select * into settings_row from public.eval_settings where session_type = exam_row.session_type;
  for score_entry in select key, value from jsonb_each(new.scores) loop
    if jsonb_typeof(score_entry.value) <> 'number' then raise exception using errcode = '23514', message = 'exam_score_invalid'; end if;
    score_value := (score_entry.value #>> '{}')::numeric;
    if score_value <> trunc(score_value) or score_value < 1 or score_value > 5 then raise exception using errcode = '23514', message = 'exam_score_out_of_range'; end if;
    select weight.weight into criterion_weight from public.eval_weights as weight
    join public.eval_criteria as criterion on criterion.code = weight.criterion_code
    where weight.session_type = exam_row.session_type and weight.criterion_code = score_entry.key and exam_row.session_type = any(criterion.applies_to);
    if criterion_weight is null then raise exception using errcode = '23514', message = 'exam_criterion_not_applicable'; end if;
    weighted_sum := weighted_sum + score_value * criterion_weight; total_weight := total_weight + criterion_weight;
    snapshot_weights := snapshot_weights || jsonb_build_object(score_entry.key, criterion_weight);
  end loop;
  if total_weight <= 0 then raise exception using errcode = '23514', message = 'exam_weights_invalid'; end if;
  major_count := coalesce((new.errors ->> 'major')::integer,0); minor_count := coalesce((new.errors ->> 'minor')::integer,0);
  prompt_count := coalesce((new.errors ->> 'prompts')::integer,0); forgot_count := coalesce((new.errors ->> 'forgot')::integer,0);
  if least(major_count,minor_count,prompt_count,forgot_count) < 0 then raise exception using errcode = '23514', message = 'exam_errors_invalid'; end if;
  deduction := major_count*settings_row.d_major + minor_count*settings_row.d_minor + prompt_count*settings_row.d_prompt + forgot_count*settings_row.d_forgot;
  computed := greatest(0, least(100, (weighted_sum / total_weight) * 20 - deduction));
  thresholds := array(select (value #>> '{}')::numeric from jsonb_array_elements(settings_row.rating_thresholds));
  new.percentage := round(computed,2); new.total := round(computed / 100 * exam_row.max_score,2);
  new.rating := case when computed >= thresholds[5] then 5 when computed >= thresholds[4] then 4 when computed >= thresholds[3] then 3 when computed >= thresholds[2] then 2 else 1 end;
  new.grade := case new.rating when 5 then 'excellent' when 4 then 'very_good' when 3 then 'good' when 2 then 'pass' else 'repeat' end;
  new.settings_snapshot := jsonb_build_object('session_type',exam_row.session_type,'max_score',exam_row.max_score,'weights',snapshot_weights,'deductions',jsonb_build_object('major',settings_row.d_major,'minor',settings_row.d_minor,'prompt',settings_row.d_prompt,'forgot',settings_row.d_forgot),'rating_thresholds',settings_row.rating_thresholds);
  return new;
end;
$$;
revoke execute on function private.prepare_exam_result() from public, anon, authenticated, service_role;
create trigger exam_results_prepare before insert or update of scores, errors on public.exam_results for each row execute function private.prepare_exam_result();
create trigger exams_updated before update on public.exams for each row execute function public.set_updated_at();
create trigger exam_results_updated before update on public.exam_results for each row execute function public.set_updated_at();
create trigger exams_audit after insert or update or delete on public.exams for each row execute function public.audit_row();
create trigger exam_results_audit after insert or update on public.exam_results for each row execute function public.audit_row();

create or replace function private.guard_exam_status()
returns trigger language plpgsql set search_path = '' as $$
begin
  if old.status is distinct from new.status and not (
    (old.status='draft' and new.status='open') or (old.status='open' and new.status='closed')
  ) then raise exception using errcode='P0001',message='invalid_exam_transition'; end if;
  return new;
end;
$$;
revoke execute on function private.guard_exam_status() from public,anon,authenticated,service_role;
create trigger exams_guard_status before update of status on public.exams for each row execute function private.guard_exam_status();

create or replace function public.save_exam_result(p_exam uuid, p_student uuid, p_scores jsonb, p_errors jsonb)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare exam_row public.exams%rowtype; result uuid; current_teacher uuid := (select private.current_teacher_id()); actor uuid := (select auth.uid());
begin
  if actor is null then raise exception using errcode = '42501', message = 'authentication_required'; end if;
  select * into exam_row from public.exams where id = p_exam;
  if exam_row.id is null or exam_row.status <> 'open' then raise exception using errcode = 'P0001', message = 'exam_not_open'; end if;
  if not public.is_admin() and (current_teacher is null or not exists (
    select 1 from public.teacher_assignments as assignment where assignment.teacher_id = current_teacher and assignment.student_id = p_student
      and assignment.status = 'active' and (exam_row.track_id is null or assignment.track_id = exam_row.track_id)
  )) then raise exception using errcode = '42501', message = 'exam_student_forbidden'; end if;
  insert into public.exam_results(exam_id,student_id,scores,errors,entered_by)
  values (p_exam,p_student,p_scores,p_errors,actor)
  on conflict(exam_id,student_id) do update set scores=excluded.scores,errors=excluded.errors,entered_by=actor
  returning id into result;
  return result;
end;
$$;
revoke execute on function public.save_exam_result(uuid,uuid,jsonb,jsonb) from public, anon;
grant execute on function public.save_exam_result(uuid,uuid,jsonb,jsonb) to authenticated, service_role;

create or replace function public.lock_exam_result(p_result uuid)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception using errcode = '42501', message = 'admin_mfa_required'; end if;
  update public.exam_results set is_locked=true,locked_by=(select auth.uid()),locked_at=now() where id=p_result and not is_locked;
  if not found then raise exception using errcode = 'P0001', message = 'exam_result_not_lockable'; end if;
end;
$$;
revoke execute on function public.lock_exam_result(uuid) from public, anon;
grant execute on function public.lock_exam_result(uuid) to authenticated, service_role;

alter table public.exams enable row level security; alter table public.exam_results enable row level security;
revoke all on public.exams,public.exam_results from public,anon,authenticated;
grant select,insert,update,delete on public.exams to authenticated; grant select on public.exam_results to authenticated;
grant select,insert,update,delete on public.exams,public.exam_results to service_role;
create policy exams_admin_all on public.exams for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy exams_authenticated_read on public.exams for select to authenticated using (status <> 'draft' or (select public.is_admin()));
create policy exam_results_admin_read on public.exam_results for select to authenticated using ((select public.is_admin()));
create policy exam_results_teacher_read on public.exam_results for select to authenticated using (exists(select 1 from public.teacher_assignments where teacher_id=(select private.current_teacher_id()) and student_id=exam_results.student_id and status='active'));
create policy exam_results_student_read on public.exam_results for select to authenticated using (is_locked and exists(select 1 from public.students where id=exam_results.student_id and profile_id=(select auth.uid())));
create policy exam_results_parent_read on public.exam_results for select to authenticated using (is_locked and (select private.guards_student(student_id)));

insert into supabase_migrations.schema_migrations(version, statements, name) values ('20261022090000', array[]::text[], 'create_exams') on conflict (version) do nothing;
-- END MIGRATION 20261022090000_create_exams.sql
-- BEGIN MIGRATION 20261022110000_create_certificate_system.sql
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

insert into supabase_migrations.schema_migrations(version, statements, name) values ('20261022110000', array[]::text[], 'create_certificate_system') on conflict (version) do nothing;
-- END MIGRATION 20261022110000_create_certificate_system.sql
-- BEGIN MIGRATION 20261022120000_add_certificate_editor_rpc.sql
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('certificate-assets','certificate-assets',false,2097152,array['image/png','image/jpeg','image/webp'])
on conflict(id) do nothing;

create policy certificate_assets_admin_read on storage.objects for select to authenticated
using (bucket_id='certificate-assets' and (select public.is_admin()));
create policy certificate_assets_admin_insert on storage.objects for insert to authenticated
with check (bucket_id='certificate-assets' and (select public.is_admin()));
create policy certificate_assets_admin_update on storage.objects for update to authenticated
using (bucket_id='certificate-assets' and (select public.is_admin()))
with check (bucket_id='certificate-assets' and (select public.is_admin()));
create policy certificate_assets_admin_delete on storage.objects for delete to authenticated
using (bucket_id='certificate-assets' and (select public.is_admin()));

create or replace function public.create_certificate_template(
  p_kind text,p_name_ar text,p_name_en text,p_title_ar text,p_title_en text,
  p_body_ar text,p_body_en text,p_logo_path text,p_seal_path text,p_signatures jsonb,p_theme jsonb
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare template uuid; version uuid;
begin
  if not public.is_admin() then raise exception using errcode='42501',message='admin_mfa_required'; end if;
  insert into public.certificate_templates(kind,name_ar,name_en,created_by)
  values(p_kind,btrim(p_name_ar),nullif(btrim(p_name_en),''),(select auth.uid())) returning id into template;
  insert into public.certificate_template_versions(template_id,version,title_ar,title_en,body_ar,body_en,logo_path,seal_path,signatures,theme,created_by)
  values(template,1,btrim(p_title_ar),nullif(btrim(p_title_en),''),btrim(p_body_ar),nullif(btrim(p_body_en),''),nullif(p_logo_path,''),nullif(p_seal_path,''),coalesce(p_signatures,'[]'::jsonb),p_theme,(select auth.uid())) returning id into version;
  return version;
end;
$$;
revoke execute on function public.create_certificate_template(text,text,text,text,text,text,text,text,text,jsonb,jsonb) from public,anon;
grant execute on function public.create_certificate_template(text,text,text,text,text,text,text,text,text,jsonb,jsonb) to authenticated,service_role;

create or replace function public.update_certificate_template_draft(
  p_version uuid,p_kind text,p_name_ar text,p_name_en text,p_title_ar text,p_title_en text,
  p_body_ar text,p_body_en text,p_logo_path text,p_seal_path text,p_signatures jsonb,p_theme jsonb
)
returns void language plpgsql security definer set search_path = '' as $$
declare template uuid;
begin
  if not public.is_admin() then raise exception using errcode='42501',message='admin_mfa_required'; end if;
  select template_id into template from public.certificate_template_versions where id=p_version and status='draft' for update;
  if template is null then raise exception using errcode='P0001',message='certificate_template_not_editable'; end if;
  update public.certificate_templates set kind=p_kind,name_ar=btrim(p_name_ar),name_en=nullif(btrim(p_name_en),'') where id=template;
  update public.certificate_template_versions set title_ar=btrim(p_title_ar),title_en=nullif(btrim(p_title_en),''),body_ar=btrim(p_body_ar),body_en=nullif(btrim(p_body_en),''),logo_path=nullif(p_logo_path,''),seal_path=nullif(p_seal_path,''),signatures=coalesce(p_signatures,'[]'::jsonb),theme=p_theme where id=p_version;
end;
$$;
revoke execute on function public.update_certificate_template_draft(uuid,text,text,text,text,text,text,text,text,text,jsonb,jsonb) from public,anon;
grant execute on function public.update_certificate_template_draft(uuid,text,text,text,text,text,text,text,text,text,jsonb,jsonb) to authenticated,service_role;

insert into supabase_migrations.schema_migrations(version, statements, name) values ('20261022120000', array[]::text[], 'add_certificate_editor_rpc') on conflict (version) do nothing;
-- END MIGRATION 20261022120000_add_certificate_editor_rpc.sql
-- BEGIN MIGRATION 20261022130000_add_certificate_verification.sql
create table private.certificate_verification_limits (
  requester_hash text not null,
  window_start timestamptz not null,
  attempts integer not null default 1 check (attempts between 1 and 1000),
  primary key(requester_hash,window_start)
);
revoke all on private.certificate_verification_limits from public,anon,authenticated,service_role;

create or replace function public.verify_certificate(p_code text)
returns table(valid boolean,status text,student_name text,certificate_kind text,issued_on date,serial_no text)
language plpgsql security definer set search_path = '' as $$
declare headers jsonb; requester text; requester_digest text; bucket timestamptz; current_attempts integer; row record;
begin
  if p_code is null or char_length(p_code) not between 32 and 128 or p_code !~ '^[a-zA-Z0-9_-]+$' then
    return query select false,'not_found'::text,null::text,null::text,null::date,null::text;
    return;
  end if;
  begin headers := coalesce(current_setting('request.headers',true),'{}')::jsonb; exception when others then headers := '{}'::jsonb; end;
  requester := coalesce(headers->>'cf-connecting-ip',headers->>'x-real-ip',split_part(coalesce(headers->>'x-forwarded-for','unknown'),',',1),'unknown')||':'||coalesce(headers->>'user-agent','unknown');
  requester_digest := encode(digest(requester,'sha256'),'hex');
  bucket := date_bin(interval '10 minutes',clock_timestamp(),timestamptz '2020-01-01 00:00:00+00');
  insert into private.certificate_verification_limits(requester_hash,window_start,attempts) values(requester_digest,bucket,1)
  on conflict(requester_hash,window_start) do update set attempts=private.certificate_verification_limits.attempts+1 returning attempts into current_attempts;
  if current_attempts > 15 then raise exception using errcode='P0001',message='certificate_verification_rate_limited'; end if;
  select certificate.serial_no,certificate.kind,certificate.issued_at,certificate.revoked_at,student.full_name into row
  from public.certificates as certificate join public.students as student on student.id=certificate.student_id
  where certificate.verify_code=p_code;
  if row.serial_no is null then return query select false,'not_found'::text,null::text,null::text,null::date,null::text; return; end if;
  return query select row.revoked_at is null,case when row.revoked_at is null then 'valid' else 'revoked' end,
    split_part(row.full_name,' ',1)||case when position(' ' in row.full_name)>0 then ' '||left(regexp_replace(row.full_name,'^.*\s','','g'),1)||'.' else '' end,
    row.kind::text,row.issued_at::date,row.serial_no::text;
end;
$$;
revoke execute on function public.verify_certificate(text) from public;
grant execute on function public.verify_certificate(text) to anon,authenticated,service_role;

create or replace function public.revoke_certificate(p_certificate uuid,p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception using errcode='42501',message='admin_mfa_required'; end if;
  if char_length(btrim(p_reason)) not between 5 and 500 then raise exception using errcode='22023',message='certificate_revoke_reason_invalid'; end if;
  update public.certificates set revoked_at=now(),revoked_by=(select auth.uid()),revoke_reason=btrim(p_reason)
  where id=p_certificate and revoked_at is null;
  if not found then raise exception using errcode='P0001',message='certificate_not_revocable'; end if;
end;
$$;
revoke execute on function public.revoke_certificate(uuid,text) from public,anon;
grant execute on function public.revoke_certificate(uuid,text) to authenticated,service_role;

create index certificate_verification_limits_window_idx on private.certificate_verification_limits(window_start);

insert into supabase_migrations.schema_migrations(version, statements, name) values ('20261022130000', array[]::text[], 'add_certificate_verification') on conflict (version) do nothing;
-- END MIGRATION 20261022130000_add_certificate_verification.sql
-- BEGIN MIGRATION 20261022150000_create_admin_dashboard_metrics.sql
create view public.admin_attendance_daily with (security_invoker=true,security_barrier=true) as
select session.scheduled_at::date as day,session.teacher_id,
  count(*) filter(where attendance.status not in ('cancelled_teacher','cancelled_admin','teacher_absent'))::integer as eligible,
  count(*) filter(where attendance.status in ('present','late'))::integer as attended
from public.sessions as session join public.attendance as attendance on attendance.session_id=session.id
group by session.scheduled_at::date,session.teacher_id;

create view public.admin_finance_monthly with (security_invoker=true,security_barrier=true) as
select month,currency,sum(revenue)::numeric(14,2) as revenue,sum(expense)::numeric(14,2) as expense
from (
  select date_trunc('month',payment.confirmed_at)::date as month,payment.currency,
    sum(case when payment.kind='refund' then -payment.amount else payment.amount end) as revenue,0::numeric as expense
  from public.payments as payment where payment.status='confirmed' group by 1,2
  union all
  select date_trunc('month',expense.incurred_on)::date,expense.currency,0::numeric,sum(expense.amount)
  from public.expenses as expense where expense.status='recorded' group by 1,2
) as ledger group by month,currency;

create view public.admin_student_distribution with (security_invoker=true,security_barrier=true) as
select student.country_code,student.timezone,student.level_id,count(*)::integer as students
from public.students as student where student.status='active'
group by student.country_code,student.timezone,student.level_id;

create view public.admin_teacher_commitment with (security_invoker=true,security_barrier=true) as
select teacher.id as teacher_id,profile.full_name,
  coalesce(sum(daily.attended),0)::integer as attended,coalesce(sum(daily.eligible),0)::integer as eligible,
  case when coalesce(sum(daily.eligible),0)=0 then null else round(sum(daily.attended)::numeric/sum(daily.eligible)*100,2) end as commitment_pct
from public.teachers as teacher join public.profiles as profile on profile.id=teacher.profile_id
left join public.admin_attendance_daily as daily on daily.teacher_id=teacher.id
where teacher.status='active' group by teacher.id,profile.full_name;

revoke all on public.admin_attendance_daily,public.admin_finance_monthly,public.admin_student_distribution,public.admin_teacher_commitment from public,anon,authenticated;
grant select on public.admin_attendance_daily,public.admin_finance_monthly,public.admin_student_distribution,public.admin_teacher_commitment to service_role;

create or replace function public.get_admin_dashboard(p_from date default current_date-interval '90 days',p_to date default current_date,p_country text default null,p_currency text default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
  if not public.is_admin() then raise exception using errcode='42501',message='admin_mfa_required'; end if;
  if p_from is null or p_to is null or p_from>p_to or p_to-p_from>730 then raise exception using errcode='22023',message='dashboard_period_invalid'; end if;
  if p_country is not null and p_country !~ '^[A-Z]{2}$' then raise exception using errcode='22023',message='dashboard_country_invalid'; end if;
  if p_currency is not null and p_currency !~ '^[A-Z]{3}$' then raise exception using errcode='22023',message='dashboard_currency_invalid'; end if;
  select jsonb_build_object(
    'totals',jsonb_build_object(
      'students',(select count(*) from public.students s where s.status='active' and (p_country is null or s.country_code=p_country)),
      'teachers',(select count(*) from public.teachers t where t.status='active'),
      'active_subscriptions',(select count(*) from public.subscriptions sub join public.students s on s.id=sub.student_id where sub.status='active' and (p_country is null or s.country_code=p_country)),
      'new_applications',(select count(*) from public.applications a where a.created_at::date between p_from and p_to and (p_country is null or a.country_code=p_country)),
      'today_attendance',(select case when sum(d.eligible)=0 then null else round(sum(d.attended)::numeric/sum(d.eligible)*100,2) end from public.admin_attendance_daily d where d.day=current_date)
    ),
    'conversion_rate',(select case when count(*)=0 then null else round(count(*) filter(where a.status='accepted' and a.converted_student_id is not null)::numeric/count(*)*100,2) end from public.applications a where a.created_at::date between p_from and p_to and (p_country is null or a.country_code=p_country)),
    'churn_rate',(select case when count(*) filter(where sub.start_date<date_trunc('month',p_to)::date and sub.current_period_end>=date_trunc('month',p_to)::date)=0 then null else round(count(*) filter(where sub.status in ('expired','cancelled') and sub.updated_at::date between date_trunc('month',p_to)::date and p_to and not exists(select 1 from public.subscriptions renewal where renewal.student_id=sub.student_id and renewal.start_date between sub.current_period_end and sub.current_period_end+14))::numeric/count(*) filter(where sub.start_date<date_trunc('month',p_to)::date and sub.current_period_end>=date_trunc('month',p_to)::date)*100,2) end from public.subscriptions sub join public.students s on s.id=sub.student_id where (p_country is null or s.country_code=p_country)),
    'mrr',(select coalesce(jsonb_agg(jsonb_build_object('currency',x.currency,'amount',x.amount) order by x.currency),'[]'::jsonb) from (select sub.price_currency as currency,round(sum(sub.price_amount/case package.billing_period when 'yearly' then 12 when 'quarterly' then 3 else 1 end),2) as amount from public.subscriptions sub join public.packages package on package.id=sub.package_id join public.students s on s.id=sub.student_id where sub.status='active' and sub.price_currency is not null and (p_country is null or s.country_code=p_country) and (p_currency is null or sub.price_currency=p_currency) group by sub.price_currency) x),
    'overdue',(select coalesce(jsonb_agg(jsonb_build_object('currency',x.currency,'amount',x.amount) order by x.currency),'[]'::jsonb) from (select invoice.currency,sum(invoice.total-coalesce(paid.amount,0)) as amount from public.invoices invoice join public.students s on s.id=invoice.student_id left join lateral(select sum(case when payment.kind='refund' then -payment.amount else payment.amount end) amount from public.payments payment where payment.invoice_id=invoice.id and payment.status='confirmed') paid on true where invoice.status='overdue' and (p_country is null or s.country_code=p_country) and (p_currency is null or invoice.currency=p_currency) group by invoice.currency) x),
    'attendance',(select coalesce(jsonb_agg(jsonb_build_object('day',x.day,'rate',x.rate) order by x.day),'[]'::jsonb) from (select d.day,case when sum(d.eligible)=0 then null else round(sum(d.attended)::numeric/sum(d.eligible)*100,2) end rate from public.admin_attendance_daily d where d.day between p_from and p_to group by d.day) x),
    'finance',(select coalesce(jsonb_agg(jsonb_build_object('month',f.month,'currency',f.currency,'revenue',f.revenue,'expense',f.expense) order by f.month,f.currency),'[]'::jsonb) from public.admin_finance_monthly f where f.month between date_trunc('month',p_from)::date and p_to and (p_currency is null or f.currency=p_currency)),
    'levels',(select coalesce(jsonb_agg(jsonb_build_object('name_ar',x.name_ar,'name_en',x.name_en,'students',x.students) order by x.students desc),'[]'::jsonb) from (select coalesce(level.name_ar,'غير محدد') name_ar,coalesce(level.name_en,'Unassigned') name_en,count(*) students from public.students s left join public.levels level on level.id=s.level_id where s.status='active' and (p_country is null or s.country_code=p_country) group by level.name_ar,level.name_en) x),
    'teachers',(select coalesce(jsonb_agg(jsonb_build_object('id',x.teacher_id,'name',x.full_name,'rate',x.commitment_pct,'eligible',x.eligible) order by x.commitment_pct desc nulls last),'[]'::jsonb) from (select c.* from public.admin_teacher_commitment c limit 10) x),
    'packages',(select coalesce(jsonb_agg(jsonb_build_object('name_ar',x.name_ar,'name_en',x.name_en,'subscriptions',x.subscriptions) order by x.subscriptions desc),'[]'::jsonb) from (select package.name_ar,package.name_en,count(*) subscriptions from public.subscriptions sub join public.packages package on package.id=sub.package_id join public.students s on s.id=sub.student_id where sub.created_at::date between p_from and p_to and (p_country is null or s.country_code=p_country) group by package.id order by count(*) desc limit 8) x),
    'countries',(select coalesce(jsonb_agg(jsonb_build_object('country',x.country_code,'students',x.students) order by x.students desc),'[]'::jsonb) from (select s.country_code,count(*) students from public.students s where s.status='active' group by s.country_code) x),
    'currencies',(select coalesce(jsonb_agg(distinct invoice.currency),'[]'::jsonb) from public.invoices invoice),
    'recent_activity',(select coalesce(jsonb_agg(jsonb_build_object('action',x.action,'table',x.table_name,'record',x.record_id,'at',x.created_at) order by x.created_at desc),'[]'::jsonb) from (select log.action,log.table_name,log.record_id,log.created_at from public.audit_logs log order by log.created_at desc limit 12) x)
  ) into result;
  return result;
end;
$$;
revoke execute on function public.get_admin_dashboard(date,date,text,text) from public,anon;
grant execute on function public.get_admin_dashboard(date,date,text,text) to authenticated,service_role;

insert into supabase_migrations.schema_migrations(version, statements, name) values ('20261022150000', array[]::text[], 'create_admin_dashboard_metrics') on conflict (version) do nothing;
-- END MIGRATION 20261022150000_create_admin_dashboard_metrics.sql
-- BEGIN MIGRATION 20261022170000_add_student_risk_flags.sql
create view public.admin_student_risk_signals
with (security_invoker = true, security_barrier = true)
as
with attendance_window as (
  select
    session.student_id,
    count(*) filter (
      where attendance.status not in ('teacher_absent', 'cancelled_teacher', 'cancelled_admin')
    )::integer as eligible_sessions,
    count(*) filter (
      where attendance.status = 'student_absent'
    )::integer as absent_sessions,
    max(session.scheduled_at) filter (
      where attendance.status in ('present', 'late')
    ) as last_attended_at
  from public.sessions as session
  join public.attendance as attendance on attendance.session_id = session.id
  where session.scheduled_at >= pg_catalog.now() - interval '30 days'
    and session.scheduled_at <= pg_catalog.now()
  group by session.student_id
), evaluation_window as (
  select
    session.student_id,
    round(avg(evaluation.total_score), 2) as evaluation_average
  from public.sessions as session
  join public.session_evaluations as evaluation
    on evaluation.session_id = session.id
   and evaluation.is_locked
  where evaluation.locked_at >= pg_catalog.now() - interval '60 days'
  group by session.student_id
), overdue_reviews as (
  select progress.student_id, count(*)::integer as overdue_review_pages
  from public.memorization_progress as progress
  where progress.status in ('mastered', 'needs_review')
    and progress.next_review_due < current_date
  group by progress.student_id
), latest_report as (
  select report.student_id, max(report.period_end) as last_report_period_end
  from public.reports as report
  where report.status = 'visible'
  group by report.student_id
), current_subscription as (
  select distinct on (subscription.student_id)
    subscription.student_id,
    subscription.status,
    subscription.current_period_end
  from public.subscriptions as subscription
  order by
    subscription.student_id,
    (subscription.status in ('active', 'trial', 'paused')) desc,
    subscription.current_period_end desc,
    subscription.created_at desc
)
select
  student.id as student_id,
  student.student_no,
  student.full_name,
  student.country_code,
  student.level_id,
  level.name_ar as level_name_ar,
  level.name_en as level_name_en,
  coalesce(attendance.eligible_sessions, 0) as eligible_sessions,
  coalesce(attendance.absent_sessions, 0) as absent_sessions,
  case
    when coalesce(attendance.eligible_sessions, 0) = 0 then null
    else round(attendance.absent_sessions::numeric / attendance.eligible_sessions * 100, 2)
  end as absence_rate,
  attendance.last_attended_at,
  case
    when attendance.last_attended_at is null then null
    else (current_date - attendance.last_attended_at::date)::integer
  end as inactive_days,
  evaluation.evaluation_average,
  coalesce(review.overdue_review_pages, 0) as overdue_review_pages,
  report.last_report_period_end,
  subscription.status as subscription_status,
  subscription.current_period_end as subscription_period_end
from public.students as student
left join public.levels as level on level.id = student.level_id
left join attendance_window as attendance on attendance.student_id = student.id
left join evaluation_window as evaluation on evaluation.student_id = student.id
left join overdue_reviews as review on review.student_id = student.id
left join latest_report as report on report.student_id = student.id
left join current_subscription as subscription on subscription.student_id = student.id
where student.status = 'active';

revoke all on public.admin_student_risk_signals from public, anon, authenticated;
grant select on public.admin_student_risk_signals to service_role;

create or replace function public.get_admin_student_risk_flags(
  p_country text default null,
  p_limit integer default 100
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'admin_mfa_required';
  end if;

  if p_country is not null and p_country !~ '^[A-Z]{2}$' then
    raise exception using errcode = '22023', message = 'risk_country_invalid';
  end if;

  if p_limit is null or p_limit < 1 or p_limit > 200 then
    raise exception using errcode = '22023', message = 'risk_limit_invalid';
  end if;

  with scored as (
    select
      signal.*,
      (
        case
          when signal.absent_sessions >= 3 or signal.absence_rate >= 40 then 40
          when signal.absent_sessions >= 2 or signal.absence_rate >= 25 then 25
          else 0
        end
        + case
            when signal.inactive_days >= 30 then 30
            when signal.inactive_days >= 21 then 20
            else 0
          end
        + case
            when signal.overdue_review_pages >= 10 then 20
            when signal.overdue_review_pages >= 5 then 10
            else 0
          end
        + case
            when signal.evaluation_average < 50 then 20
            when signal.evaluation_average < 65 then 10
            else 0
          end
        + case
            when signal.subscription_status in ('expired', 'cancelled')
              or signal.subscription_period_end < current_date then 20
            else 0
          end
        + case
            when signal.last_report_period_end is null
              or signal.last_report_period_end < current_date - 45 then 10
            else 0
          end
      )::integer as risk_score
    from public.admin_student_risk_signals as signal
    where p_country is null or signal.country_code = p_country
  ), flagged as (
    select
      scored.*,
      case
        when scored.risk_score >= 60 then 'high'
        when scored.risk_score >= 35 then 'medium'
        else 'low'
      end as risk_level,
      (
        select coalesce(jsonb_agg(reason.value order by reason.priority), '[]'::jsonb)
        from (
          values
            (1, case when scored.absent_sessions >= 3 or scored.absence_rate >= 40 then 'attendance_critical'
                     when scored.absent_sessions >= 2 or scored.absence_rate >= 25 then 'attendance_warning' end),
            (2, case when scored.inactive_days >= 30 then 'inactive_30_days'
                     when scored.inactive_days >= 21 then 'inactive_21_days' end),
            (3, case when scored.overdue_review_pages >= 10 then 'reviews_critical'
                     when scored.overdue_review_pages >= 5 then 'reviews_warning' end),
            (4, case when scored.evaluation_average < 50 then 'evaluation_critical'
                     when scored.evaluation_average < 65 then 'evaluation_warning' end),
            (5, case when scored.subscription_status in ('expired', 'cancelled')
                       or scored.subscription_period_end < current_date then 'subscription_inactive' end),
            (6, case when scored.last_report_period_end is null
                       or scored.last_report_period_end < current_date - 45 then 'report_overdue' end)
        ) as reason(priority, value)
        where reason.value is not null
      ) as reasons
    from scored
    where scored.risk_score >= 25
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'student_id', row.student_id,
        'student_no', row.student_no,
        'full_name', row.full_name,
        'country', row.country_code,
        'level_name_ar', coalesce(row.level_name_ar, 'غير محدد'),
        'level_name_en', coalesce(row.level_name_en, 'Unassigned'),
        'risk_score', row.risk_score,
        'risk_level', row.risk_level,
        'reasons', row.reasons,
        'eligible_sessions', row.eligible_sessions,
        'absent_sessions', row.absent_sessions,
        'absence_rate', row.absence_rate,
        'inactive_days', row.inactive_days,
        'evaluation_average', row.evaluation_average,
        'overdue_review_pages', row.overdue_review_pages,
        'subscription_status', row.subscription_status,
        'subscription_period_end', row.subscription_period_end,
        'last_report_period_end', row.last_report_period_end
      )
      order by row.risk_score desc, row.full_name, row.student_id
    ),
    '[]'::jsonb
  )
  into result
  from (
    select *
    from flagged
    order by risk_score desc, full_name, student_id
    limit p_limit
  ) as row;

  return result;
end;
$$;

revoke execute on function public.get_admin_student_risk_flags(text, integer) from public, anon;
grant execute on function public.get_admin_student_risk_flags(text, integer) to authenticated, service_role;

insert into supabase_migrations.schema_migrations(version, statements, name) values ('20261022170000', array[]::text[], 'add_student_risk_flags') on conflict (version) do nothing;
-- END MIGRATION 20261022170000_add_student_risk_flags.sql
-- BEGIN MIGRATION 20261022190000_create_targeted_announcements.sql
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

insert into supabase_migrations.schema_migrations(version, statements, name) values ('20261022190000', array[]::text[], 'create_targeted_announcements') on conflict (version) do nothing;
-- END MIGRATION 20261022190000_create_targeted_announcements.sql
-- BEGIN MIGRATION 20261022210000_create_unified_admin_metrics.sql
-- P10-T01: one bounded, auditable metrics layer for the administration control centre.
-- The views are deliberately private to service_role; administrators consume only the
-- security-definer RPCs, which require the same AAL2 gate as the rest of the admin portal.

create index if not exists students_admin_metrics_idx
on public.students (country_code, status, level_id, id);

create index if not exists sessions_admin_metrics_idx
on public.sessions (scheduled_at, teacher_id, student_id, status);

create index if not exists session_evaluations_admin_metrics_idx
on public.session_evaluations (created_at, is_locked, session_id);

create index if not exists memorization_progress_admin_metrics_idx
on public.memorization_progress (status, next_review_due, student_id);

create index if not exists teacher_payouts_admin_metrics_idx
on public.teacher_payouts (period_start, period_end, currency, status, teacher_id);

create or replace view public.admin_operations_fact
with (security_invoker = true, security_barrier = true)
as
select
  session.id as session_id,
  session.student_id,
  session.teacher_id,
  coalesce(assignment.track_id, level.track_id) as track_id,
  student.country_code,
  student.status as student_status,
  session.scheduled_at,
  session.status as session_status,
  attendance.status as attendance_status,
  attendance.recorded_at as attendance_recorded_at,
  greatest(session.updated_at, coalesce(attendance.updated_at, session.updated_at)) as refreshed_at
from public.sessions as session
join public.students as student on student.id = session.student_id
left join public.levels as level on level.id = student.level_id
left join public.teacher_assignments as assignment on assignment.id = session.assignment_id
left join public.attendance as attendance on attendance.session_id = session.id;

create or replace view public.admin_learning_fact
with (security_invoker = true, security_barrier = true)
as
select
  evaluation.id as evaluation_id,
  session.student_id,
  session.teacher_id,
  coalesce(assignment.track_id, level.track_id) as track_id,
  student.country_code,
  student.status as student_status,
  evaluation.session_type,
  evaluation.pages,
  evaluation.total_score,
  evaluation.rating,
  evaluation.is_locked,
  evaluation.created_at,
  evaluation.updated_at as refreshed_at
from public.session_evaluations as evaluation
join public.sessions as session on session.id = evaluation.session_id
join public.students as student on student.id = session.student_id
left join public.levels as level on level.id = student.level_id
left join public.teacher_assignments as assignment on assignment.id = session.assignment_id;

create or replace view public.admin_finance_fact
with (security_invoker = true, security_barrier = true)
as
select
  'invoice'::text as entry_kind,
  invoice.id as entry_id,
  invoice.student_id,
  null::uuid as teacher_id,
  coalesce(assignment.track_id, level.track_id) as track_id,
  student.country_code,
  student.status as student_status,
  invoice.currency::text as currency,
  invoice.total as amount,
  invoice.status::text as status,
  invoice.created_at as occurred_at,
  invoice.updated_at as refreshed_at
from public.invoices as invoice
join public.students as student on student.id = invoice.student_id
left join public.levels as level on level.id = student.level_id
left join lateral (
  select current_assignment.track_id
  from public.teacher_assignments as current_assignment
  where current_assignment.student_id = student.id
    and current_assignment.status in ('active', 'paused')
  order by current_assignment.updated_at desc
  limit 1
) as assignment on true
union all
select
  'payment'::text,
  payment.id,
  invoice.student_id,
  null::uuid,
  coalesce(assignment.track_id, level.track_id),
  student.country_code,
  student.status,
  payment.currency::text,
  case when payment.kind = 'refund' then -payment.amount else payment.amount end,
  payment.status::text,
  coalesce(payment.confirmed_at, payment.created_at),
  coalesce(payment.confirmed_at, payment.created_at)
from public.payments as payment
join public.invoices as invoice on invoice.id = payment.invoice_id
join public.students as student on student.id = invoice.student_id
left join public.levels as level on level.id = student.level_id
left join lateral (
  select current_assignment.track_id
  from public.teacher_assignments as current_assignment
  where current_assignment.student_id = student.id
    and current_assignment.status in ('active', 'paused')
  order by current_assignment.updated_at desc
  limit 1
) as assignment on true
union all
select
  'payout'::text,
  payout.id,
  null::uuid,
  payout.teacher_id,
  teacher_track.track_id,
  null::char(2),
  null::public.student_status,
  payout.currency::text,
  payout.net,
  payout.status::text,
  coalesce(payout.paid_at, payout.approved_at, payout.created_at),
  payout.updated_at
from public.teacher_payouts as payout
left join lateral (
  select track.track_id
  from public.teacher_tracks as track
  where track.teacher_id = payout.teacher_id
  order by track.created_at
  limit 1
) as teacher_track on true;

revoke all on public.admin_operations_fact, public.admin_learning_fact, public.admin_finance_fact
from public, anon, authenticated;
grant select on public.admin_operations_fact, public.admin_learning_fact, public.admin_finance_fact
to service_role;

create or replace function private.assert_admin_metric_filters(
  p_from date,
  p_to date,
  p_country text,
  p_track uuid,
  p_teacher uuid,
  p_status text,
  p_timezone text
)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'admin_mfa_required';
  end if;
  if p_from is null or p_to is null or p_from > p_to or p_to - p_from > 730 then
    raise exception using errcode = '22023', message = 'admin_metrics_period_invalid';
  end if;
  if p_country is not null and p_country !~ '^[A-Z]{2}$' then
    raise exception using errcode = '22023', message = 'admin_metrics_country_invalid';
  end if;
  if p_status is not null and p_status not in ('active', 'dropped', 'graduated', 'suspended', 'archived') then
    raise exception using errcode = '22023', message = 'admin_metrics_status_invalid';
  end if;
  if p_timezone is null or not exists (
    select 1 from pg_catalog.pg_timezone_names where name = p_timezone
  ) then
    raise exception using errcode = '22023', message = 'admin_metrics_timezone_invalid';
  end if;
  if p_track is not null and not exists (select 1 from public.tracks where id = p_track) then
    raise exception using errcode = '22023', message = 'admin_metrics_track_invalid';
  end if;
  if p_teacher is not null and not exists (select 1 from public.teachers where id = p_teacher) then
    raise exception using errcode = '22023', message = 'admin_metrics_teacher_invalid';
  end if;
end;
$$;

revoke all on function private.assert_admin_metric_filters(date, date, text, uuid, uuid, text, text)
from public, anon, authenticated, service_role;

create or replace function public.get_admin_operations_metrics(
  p_from date,
  p_to date,
  p_country text default null,
  p_track uuid default null,
  p_teacher uuid default null,
  p_status text default null,
  p_timezone text default 'Africa/Cairo'
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
set statement_timeout = '5s'
as $$
declare
  period_start timestamptz;
  period_end timestamptz;
  result jsonb;
begin
  perform private.assert_admin_metric_filters(
    p_from, p_to, p_country, p_track, p_teacher, p_status, p_timezone
  );
  period_start := p_from::timestamp at time zone p_timezone;
  period_end := (p_to + 1)::timestamp at time zone p_timezone;

  with selected_students as (
    select student.id
    from public.students as student
    left join public.levels as level on level.id = student.level_id
    where (p_country is null or student.country_code = p_country)
      and (p_status is null or student.status::text = p_status)
      and (p_track is null or level.track_id = p_track or exists (
        select 1 from public.teacher_assignments as assignment
        where assignment.student_id = student.id and assignment.track_id = p_track
          and assignment.status in ('active', 'paused')
      ))
      and (p_teacher is null or exists (
        select 1 from public.teacher_assignments as assignment
        where assignment.student_id = student.id and assignment.teacher_id = p_teacher
          and assignment.status in ('active', 'paused')
      ))
  ), selected_sessions as (
    select fact.*
    from public.admin_operations_fact as fact
    where fact.scheduled_at >= period_start and fact.scheduled_at < period_end
      and fact.student_id in (select id from selected_students)
      and (p_track is null or fact.track_id = p_track)
      and (p_teacher is null or fact.teacher_id = p_teacher)
  ), attendance_rollup as (
    select
      count(*) filter (where attendance_status is not null
        and attendance_status not in ('cancelled_teacher', 'cancelled_admin', 'teacher_absent'))::integer as eligible,
      count(*) filter (where attendance_status in ('present', 'late'))::integer as attended
    from selected_sessions
  ), session_rollup as (
    select count(*)::integer as total,
      count(*) filter (where session_status = 'held')::integer as held,
      count(*) filter (where session_status = 'missed')::integer as missed,
      count(*) filter (where session_status = 'cancelled')::integer as cancelled
    from selected_sessions
  ), subscription_rollup as (
    select count(*) filter (where subscription.status = 'active')::integer as active,
      count(*)::integer as total
    from public.subscriptions as subscription
    where subscription.student_id in (select id from selected_students)
  )
  select jsonb_build_object(
    'source', 'operations',
    'generated_at', pg_catalog.clock_timestamp(),
    'refreshed_at', coalesce((select max(refreshed_at) from selected_sessions), pg_catalog.clock_timestamp()),
    'metrics', jsonb_build_object(
      'students', jsonb_build_object(
        'value', (select count(*) from selected_students),
        'denominator', (select count(*) from public.students),
        'unit', 'people', 'period', 'snapshot'
      ),
      'teachers', jsonb_build_object(
        'value', (select count(distinct teacher.id) from public.teachers as teacher
          left join public.teacher_tracks as teacher_track on teacher_track.teacher_id = teacher.id
          where teacher.status = 'active'
            and (p_teacher is null or teacher.id = p_teacher)
            and (p_track is null or teacher_track.track_id = p_track)),
        'denominator', (select count(*) from public.teachers),
        'unit', 'people', 'period', 'snapshot'
      ),
      'sessions', jsonb_build_object(
        'value', (select total from session_rollup),
        'denominator', (select total from session_rollup),
        'unit', 'sessions', 'period', 'range'
      ),
      'held_sessions', jsonb_build_object(
        'value', (select held from session_rollup),
        'denominator', (select total from session_rollup),
        'unit', 'sessions', 'period', 'range'
      ),
      'missed_sessions', jsonb_build_object(
        'value', (select missed from session_rollup),
        'denominator', (select total from session_rollup),
        'unit', 'sessions', 'period', 'range'
      ),
      'cancelled_sessions', jsonb_build_object(
        'value', (select cancelled from session_rollup),
        'denominator', (select total from session_rollup),
        'unit', 'sessions', 'period', 'range'
      ),
      'attendance_rate', jsonb_build_object(
        'value', (select case when eligible = 0 then null else round(attended::numeric / eligible * 100, 2) end from attendance_rollup),
        'numerator', (select attended from attendance_rollup),
        'denominator', (select eligible from attendance_rollup),
        'unit', 'percent', 'period', 'range'
      ),
      'active_subscriptions', jsonb_build_object(
        'value', (select active from subscription_rollup),
        'denominator', (select total from subscription_rollup),
        'unit', 'subscriptions', 'period', 'snapshot'
      )
    )
  ) into result;
  return result;
end;
$$;

create or replace function public.get_admin_learning_metrics(
  p_from date,
  p_to date,
  p_country text default null,
  p_track uuid default null,
  p_teacher uuid default null,
  p_status text default null,
  p_timezone text default 'Africa/Cairo'
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
set statement_timeout = '5s'
as $$
declare
  period_start timestamptz;
  period_end timestamptz;
  result jsonb;
begin
  perform private.assert_admin_metric_filters(
    p_from, p_to, p_country, p_track, p_teacher, p_status, p_timezone
  );
  period_start := p_from::timestamp at time zone p_timezone;
  period_end := (p_to + 1)::timestamp at time zone p_timezone;

  with selected_students as (
    select student.id
    from public.students as student
    left join public.levels as level on level.id = student.level_id
    where (p_country is null or student.country_code = p_country)
      and (p_status is null or student.status::text = p_status)
      and (p_track is null or level.track_id = p_track or exists (
        select 1 from public.teacher_assignments as assignment
        where assignment.student_id = student.id and assignment.track_id = p_track
          and assignment.status in ('active', 'paused')
      ))
      and (p_teacher is null or exists (
        select 1 from public.teacher_assignments as assignment
        where assignment.student_id = student.id and assignment.teacher_id = p_teacher
          and assignment.status in ('active', 'paused')
      ))
  ), selected_evaluations as (
    select fact.* from public.admin_learning_fact as fact
    where fact.created_at >= period_start and fact.created_at < period_end
      and fact.student_id in (select id from selected_students)
      and (p_track is null or fact.track_id = p_track)
      and (p_teacher is null or fact.teacher_id = p_teacher)
  ), progress_rollup as (
    select count(*) filter (where progress.status = 'mastered')::integer as mastered,
      count(*) filter (where progress.next_review_due <= p_to)::integer as due,
      count(*)::integer as tracked
    from public.memorization_progress as progress
    where progress.student_id in (select id from selected_students)
  ), evaluation_rollup as (
    select count(*) filter (where is_locked)::integer as locked,
      count(*)::integer as total,
      round(avg(total_score) filter (where is_locked), 2) as average
    from selected_evaluations
  ), report_rollup as (
    select count(*) filter (where report.status = 'visible' and report.made_visible_at >= period_start
      and report.made_visible_at < period_end)::integer as visible,
      count(*) filter (where report.status in ('draft', 'admin_review'))::integer as pending,
      count(*)::integer as total
    from public.reports as report
    where report.student_id in (select id from selected_students)
      and (p_teacher is null or report.teacher_id = p_teacher)
  )
  select jsonb_build_object(
    'source', 'learning',
    'generated_at', pg_catalog.clock_timestamp(),
    'refreshed_at', coalesce(
      greatest(
        (select max(refreshed_at) from selected_evaluations),
        (select max(updated_at) from public.memorization_progress where student_id in (select id from selected_students)),
        (select max(updated_at) from public.reports where student_id in (select id from selected_students))
      ),
      pg_catalog.clock_timestamp()
    ),
    'metrics', jsonb_build_object(
      'mastered_pages', jsonb_build_object(
        'value', (select mastered from progress_rollup), 'denominator', (select tracked from progress_rollup),
        'unit', 'pages', 'period', 'snapshot'
      ),
      'due_reviews', jsonb_build_object(
        'value', (select due from progress_rollup), 'denominator', (select tracked from progress_rollup),
        'unit', 'pages', 'period', 'snapshot'
      ),
      'evaluation_average', jsonb_build_object(
        'value', (select average from evaluation_rollup), 'denominator', (select locked from evaluation_rollup),
        'unit', 'score', 'period', 'range'
      ),
      'locked_evaluations', jsonb_build_object(
        'value', (select locked from evaluation_rollup), 'denominator', (select total from evaluation_rollup),
        'unit', 'evaluations', 'period', 'range'
      ),
      'visible_reports', jsonb_build_object(
        'value', (select visible from report_rollup), 'denominator', (select total from report_rollup),
        'unit', 'reports', 'period', 'range'
      ),
      'pending_reports', jsonb_build_object(
        'value', (select pending from report_rollup), 'denominator', (select total from report_rollup),
        'unit', 'reports', 'period', 'snapshot'
      )
    )
  ) into result;
  return result;
end;
$$;

create or replace function public.get_admin_finance_metrics(
  p_from date,
  p_to date,
  p_country text default null,
  p_track uuid default null,
  p_teacher uuid default null,
  p_status text default null,
  p_timezone text default 'Africa/Cairo'
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
set statement_timeout = '5s'
as $$
declare
  period_start timestamptz;
  period_end timestamptz;
  result jsonb;
begin
  perform private.assert_admin_metric_filters(
    p_from, p_to, p_country, p_track, p_teacher, p_status, p_timezone
  );
  period_start := p_from::timestamp at time zone p_timezone;
  period_end := (p_to + 1)::timestamp at time zone p_timezone;

  with selected_entries as (
    select fact.*
    from public.admin_finance_fact as fact
    where fact.occurred_at >= period_start and fact.occurred_at < period_end
      and (p_country is null or fact.country_code = p_country)
      and (p_track is null or fact.track_id = p_track)
      and (p_teacher is null or fact.teacher_id = p_teacher)
      and (p_status is null or fact.student_status::text = p_status)
  ), invoice_rollup as (
    select currency,
      count(*)::integer as invoices,
      coalesce(sum(amount), 0)::numeric(14, 2) as total,
      coalesce(sum(amount) filter (where status = 'overdue'), 0)::numeric(14, 2) as overdue
    from selected_entries where entry_kind = 'invoice' group by currency
  ), payment_rollup as (
    select currency,
      count(*) filter (where status = 'confirmed')::integer as confirmed,
      coalesce(sum(amount) filter (where status = 'confirmed'), 0)::numeric(14, 2) as net
    from selected_entries where entry_kind = 'payment' group by currency
  ), payout_rollup as (
    select currency,
      count(*)::integer as payouts,
      coalesce(sum(amount), 0)::numeric(14, 2) as total,
      coalesce(sum(amount) filter (where status in ('due', 'approved')), 0)::numeric(14, 2) as due
    from selected_entries where entry_kind = 'payout' group by currency
  )
  select jsonb_build_object(
    'source', 'finance',
    'generated_at', pg_catalog.clock_timestamp(),
    'refreshed_at', coalesce((select max(refreshed_at) from selected_entries), pg_catalog.clock_timestamp()),
    'currencies', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'currency', currencies.currency,
        'invoice_count', coalesce(invoice.invoices, 0),
        'invoiced', coalesce(invoice.total, 0),
        'overdue', coalesce(invoice.overdue, 0),
        'payment_count', coalesce(payment.confirmed, 0),
        'payments_net', coalesce(payment.net, 0),
        'payout_count', coalesce(payout.payouts, 0),
        'payouts_total', coalesce(payout.total, 0),
        'payouts_due', coalesce(payout.due, 0)
      ) order by currencies.currency), '[]'::jsonb)
      from (
        select currency from invoice_rollup union select currency from payment_rollup union select currency from payout_rollup
      ) as currencies
      left join invoice_rollup as invoice using (currency)
      left join payment_rollup as payment using (currency)
      left join payout_rollup as payout using (currency)
    )
  ) into result;
  return result;
end;
$$;

create or replace function public.get_admin_metric_filter_options()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
set statement_timeout = '3s'
as $$
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'admin_mfa_required';
  end if;
  return jsonb_build_object(
    'countries', (select coalesce(jsonb_agg(country order by country), '[]'::jsonb) from (
      select distinct student.country_code as country from public.students as student where student.country_code is not null
    ) as countries),
    'tracks', (select coalesce(jsonb_agg(jsonb_build_object(
      'id', track.id, 'name_ar', track.name_ar, 'name_en', track.name_en
    ) order by track.sort_order, track.name_ar), '[]'::jsonb) from public.tracks as track where track.is_active),
    'teachers', (select coalesce(jsonb_agg(jsonb_build_object(
      'id', teacher.id, 'name', profile.full_name
    ) order by profile.full_name), '[]'::jsonb)
      from public.teachers as teacher join public.profiles as profile on profile.id = teacher.profile_id
      where teacher.status = 'active'),
    'statuses', jsonb_build_array('active', 'dropped', 'graduated', 'suspended', 'archived')
  );
end;
$$;

revoke all on function public.get_admin_operations_metrics(date, date, text, uuid, uuid, text, text)
from public, anon;
revoke all on function public.get_admin_learning_metrics(date, date, text, uuid, uuid, text, text)
from public, anon;
revoke all on function public.get_admin_finance_metrics(date, date, text, uuid, uuid, text, text)
from public, anon;
revoke all on function public.get_admin_metric_filter_options() from public, anon;

grant execute on function public.get_admin_operations_metrics(date, date, text, uuid, uuid, text, text)
to authenticated, service_role;
grant execute on function public.get_admin_learning_metrics(date, date, text, uuid, uuid, text, text)
to authenticated, service_role;
grant execute on function public.get_admin_finance_metrics(date, date, text, uuid, uuid, text, text)
to authenticated, service_role;
grant execute on function public.get_admin_metric_filter_options()
to authenticated, service_role;

insert into supabase_migrations.schema_migrations(version, statements, name) values ('20261022210000', array[]::text[], 'create_unified_admin_metrics') on conflict (version) do nothing;
-- END MIGRATION 20261022210000_create_unified_admin_metrics.sql
-- BEGIN MIGRATION 20261022211000_fix_admin_finance_teacher_scope.sql
-- Preserve the selected teacher on student finance rows so the teacher filter has
-- identical meaning across operations, learning, and finance sources.
create or replace view public.admin_finance_fact
with (security_invoker = true, security_barrier = true)
as
select
  'invoice'::text as entry_kind,
  invoice.id as entry_id,
  invoice.student_id,
  assignment.teacher_id,
  coalesce(assignment.track_id, level.track_id) as track_id,
  student.country_code,
  student.status as student_status,
  invoice.currency::text as currency,
  invoice.total as amount,
  invoice.status::text as status,
  invoice.created_at as occurred_at,
  invoice.updated_at as refreshed_at
from public.invoices as invoice
join public.students as student on student.id = invoice.student_id
left join public.levels as level on level.id = student.level_id
left join lateral (
  select current_assignment.teacher_id, current_assignment.track_id
  from public.teacher_assignments as current_assignment
  where current_assignment.student_id = student.id
    and current_assignment.status in ('active', 'paused')
  order by current_assignment.updated_at desc
  limit 1
) as assignment on true
union all
select
  'payment'::text,
  payment.id,
  invoice.student_id,
  assignment.teacher_id,
  coalesce(assignment.track_id, level.track_id),
  student.country_code,
  student.status,
  payment.currency::text,
  case when payment.kind = 'refund' then -payment.amount else payment.amount end,
  payment.status::text,
  coalesce(payment.confirmed_at, payment.created_at),
  coalesce(payment.confirmed_at, payment.created_at)
from public.payments as payment
join public.invoices as invoice on invoice.id = payment.invoice_id
join public.students as student on student.id = invoice.student_id
left join public.levels as level on level.id = student.level_id
left join lateral (
  select current_assignment.teacher_id, current_assignment.track_id
  from public.teacher_assignments as current_assignment
  where current_assignment.student_id = student.id
    and current_assignment.status in ('active', 'paused')
  order by current_assignment.updated_at desc
  limit 1
) as assignment on true
union all
select
  'payout'::text,
  payout.id,
  null::uuid,
  payout.teacher_id,
  teacher_track.track_id,
  null::char(2),
  null::public.student_status,
  payout.currency::text,
  payout.net,
  payout.status::text,
  coalesce(payout.paid_at, payout.approved_at, payout.created_at),
  payout.updated_at
from public.teacher_payouts as payout
left join lateral (
  select track.track_id
  from public.teacher_tracks as track
  where track.teacher_id = payout.teacher_id
  order by track.created_at
  limit 1
) as teacher_track on true;

revoke all on public.admin_finance_fact from public, anon, authenticated;
grant select on public.admin_finance_fact to service_role;

insert into supabase_migrations.schema_migrations(version, statements, name) values ('20261022211000', array[]::text[], 'fix_admin_finance_teacher_scope') on conflict (version) do nothing;
-- END MIGRATION 20261022211000_fix_admin_finance_teacher_scope.sql
-- BEGIN MIGRATION 20261022212000_fix_admin_learning_metric_period.sql
-- PL/pgSQL treats the reports.period_start column and the original local variable as
-- ambiguous. Keep the period boundaries explicit so the function compiles on every
-- supported PostgreSQL configuration.
create or replace function public.get_admin_learning_metrics(
  p_from date,
  p_to date,
  p_country text default null,
  p_track uuid default null,
  p_teacher uuid default null,
  p_status text default null,
  p_timezone text default 'Africa/Cairo'
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
set statement_timeout = '5s'
as $$
declare
  range_start_at timestamptz;
  range_end_at timestamptz;
  result jsonb;
begin
  perform private.assert_admin_metric_filters(
    p_from, p_to, p_country, p_track, p_teacher, p_status, p_timezone
  );
  range_start_at := p_from::timestamp at time zone p_timezone;
  range_end_at := (p_to + 1)::timestamp at time zone p_timezone;

  with selected_students as (
    select student.id
    from public.students as student
    left join public.levels as level on level.id = student.level_id
    where (p_country is null or student.country_code = p_country)
      and (p_status is null or student.status::text = p_status)
      and (p_track is null or level.track_id = p_track or exists (
        select 1 from public.teacher_assignments as assignment
        where assignment.student_id = student.id and assignment.track_id = p_track
          and assignment.status in ('active', 'paused')
      ))
      and (p_teacher is null or exists (
        select 1 from public.teacher_assignments as assignment
        where assignment.student_id = student.id and assignment.teacher_id = p_teacher
          and assignment.status in ('active', 'paused')
      ))
  ), selected_evaluations as (
    select fact.* from public.admin_learning_fact as fact
    where fact.created_at >= range_start_at and fact.created_at < range_end_at
      and fact.student_id in (select id from selected_students)
      and (p_track is null or fact.track_id = p_track)
      and (p_teacher is null or fact.teacher_id = p_teacher)
  ), progress_rollup as (
    select count(*) filter (where progress.status = 'mastered')::integer as mastered,
      count(*) filter (where progress.next_review_due <= p_to)::integer as due,
      count(*)::integer as tracked
    from public.memorization_progress as progress
    where progress.student_id in (select id from selected_students)
  ), evaluation_rollup as (
    select count(*) filter (where is_locked)::integer as locked,
      count(*)::integer as total,
      round(avg(total_score) filter (where is_locked), 2) as average
    from selected_evaluations
  ), report_rollup as (
    select count(*) filter (where report.status = 'visible'
      and report.made_visible_at >= range_start_at
      and report.made_visible_at < range_end_at)::integer as visible,
      count(*) filter (where report.status in ('draft', 'admin_review'))::integer as pending,
      count(*)::integer as total
    from public.reports as report
    where report.student_id in (select id from selected_students)
      and (p_teacher is null or report.teacher_id = p_teacher)
  )
  select jsonb_build_object(
    'source', 'learning',
    'generated_at', pg_catalog.clock_timestamp(),
    'refreshed_at', coalesce(
      greatest(
        (select max(refreshed_at) from selected_evaluations),
        (select max(updated_at) from public.memorization_progress where student_id in (select id from selected_students)),
        (select max(updated_at) from public.reports where student_id in (select id from selected_students))
      ),
      pg_catalog.clock_timestamp()
    ),
    'metrics', jsonb_build_object(
      'mastered_pages', jsonb_build_object(
        'value', (select mastered from progress_rollup), 'denominator', (select tracked from progress_rollup),
        'unit', 'pages', 'period', 'snapshot'
      ),
      'due_reviews', jsonb_build_object(
        'value', (select due from progress_rollup), 'denominator', (select tracked from progress_rollup),
        'unit', 'pages', 'period', 'snapshot'
      ),
      'evaluation_average', jsonb_build_object(
        'value', (select average from evaluation_rollup), 'denominator', (select locked from evaluation_rollup),
        'unit', 'score', 'period', 'range'
      ),
      'locked_evaluations', jsonb_build_object(
        'value', (select locked from evaluation_rollup), 'denominator', (select total from evaluation_rollup),
        'unit', 'evaluations', 'period', 'range'
      ),
      'visible_reports', jsonb_build_object(
        'value', (select visible from report_rollup), 'denominator', (select total from report_rollup),
        'unit', 'reports', 'period', 'range'
      ),
      'pending_reports', jsonb_build_object(
        'value', (select pending from report_rollup), 'denominator', (select total from report_rollup),
        'unit', 'reports', 'period', 'snapshot'
      )
    )
  ) into result;
  return result;
end;
$$;

revoke all on function public.get_admin_learning_metrics(date, date, text, uuid, uuid, text, text)
from public, anon;
grant execute on function public.get_admin_learning_metrics(date, date, text, uuid, uuid, text, text)
to authenticated, service_role;

insert into supabase_migrations.schema_migrations(version, statements, name) values ('20261022212000', array[]::text[], 'fix_admin_learning_metric_period') on conflict (version) do nothing;
-- END MIGRATION 20261022212000_fix_admin_learning_metric_period.sql
-- BEGIN MIGRATION 20261023112010_create_intervention_rules.sql
create table public.intervention_rules (
  id uuid primary key default gen_random_uuid(),
  rule_type text not null unique,
  is_enabled boolean not null default true,
  priority smallint not null check (priority between 1 and 5),
  thresholds jsonb not null check (jsonb_typeof(thresholds) = 'object'),
  window_interval interval not null,
  cooldown_interval interval not null,
  action_code text not null,
  updated_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (window_interval between interval '1 hour' and interval '365 days'),
  check (cooldown_interval between interval '0 seconds' and interval '365 days')
);

create table public.intervention_cases (
  id uuid primary key default gen_random_uuid(),
  rule_id uuid not null references public.intervention_rules(id) on delete restrict,
  subject_type text not null check (
    subject_type in ('student', 'teacher', 'subscription', 'invoice', 'report')
  ),
  subject_id uuid not null,
  dedupe_key text not null check (char_length(dedupe_key) between 3 and 180),
  status text not null default 'open' check (
    status in ('open', 'acknowledged', 'resolved', 'dismissed')
  ),
  priority smallint not null check (priority between 1 and 5),
  reason_code text not null check (reason_code ~ '^[a-z][a-z0-9_]{2,79}$'),
  evidence jsonb not null check (jsonb_typeof(evidence) = 'object'),
  recommended_action text not null check (recommended_action ~ '^[a-z][a-z0-9_]{2,79}$'),
  first_detected_at timestamptz not null,
  last_detected_at timestamptz not null,
  detection_count integer not null default 1 check (detection_count > 0),
  escalated_at timestamptz,
  acknowledged_by uuid references public.profiles(id) on delete restrict,
  acknowledged_at timestamptz,
  resolved_by uuid references public.profiles(id) on delete restrict,
  resolved_at timestamptz,
  dismissed_by uuid references public.profiles(id) on delete restrict,
  dismissed_at timestamptz,
  disposition_reason text check (
    disposition_reason is null
    or char_length(btrim(disposition_reason)) between 2 and 500
  ),
  reopened_from_case_id uuid references public.intervention_cases(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (last_detected_at >= first_detected_at),
  check (escalated_at is null or escalated_at >= first_detected_at),
  check (
    (status = 'open'
      and acknowledged_by is null and acknowledged_at is null
      and resolved_by is null and resolved_at is null
      and dismissed_by is null and dismissed_at is null
      and disposition_reason is null)
    or (status = 'acknowledged'
      and acknowledged_by is not null and acknowledged_at is not null
      and resolved_by is null and resolved_at is null
      and dismissed_by is null and dismissed_at is null
      and disposition_reason is null)
    or (status = 'resolved'
      and resolved_at is not null
      and dismissed_by is null and dismissed_at is null)
    or (status = 'dismissed'
      and dismissed_by is not null and dismissed_at is not null
      and disposition_reason is not null)
  )
);

create index intervention_rules_enabled_idx
on public.intervention_rules (priority desc, rule_type)
where is_enabled;
create unique index intervention_cases_one_active_idx
on public.intervention_cases (dedupe_key)
where status in ('open', 'acknowledged');
create index intervention_cases_active_queue_idx
on public.intervention_cases (priority desc, first_detected_at, id)
where status in ('open', 'acknowledged');
create index intervention_cases_rule_history_idx
on public.intervention_cases (rule_id, last_detected_at desc, id);
create index intervention_cases_reopened_from_idx
on public.intervention_cases (reopened_from_case_id)
where reopened_from_case_id is not null;

create or replace function private.intervention_integer_between(
  p_value jsonb,
  p_key text,
  p_min integer,
  p_max integer
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case
    when jsonb_typeof(p_value -> p_key) <> 'number' then false
    when (p_value ->> p_key) !~ '^[0-9]+$' then false
    else (p_value ->> p_key)::integer between p_min and p_max
  end
$$;

create or replace function private.intervention_action_for_type(p_rule_type text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_rule_type
    when 'student_struggle' then 'review_student_progress'
    when 'student_absence' then 'contact_guardian'
    when 'teacher_late' then 'review_teacher_attendance'
    when 'renewal_due' then 'contact_payer'
    when 'payment_overdue' then 'review_invoice'
    when 'report_pending' then 'review_report'
    when 'credit_exhausted' then 'replenish_credit'
  end
$$;

create or replace function private.validate_intervention_rule()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  thresholds_valid boolean := false;
  expected_action text;
begin
  expected_action := private.intervention_action_for_type(new.rule_type);
  if expected_action is null then
    raise exception using errcode = '23514', message = 'intervention_rule_type_invalid';
  end if;

  if jsonb_typeof(new.thresholds) <> 'object' then
    raise exception using errcode = '23514', message = 'intervention_rule_thresholds_invalid';
  end if;

  thresholds_valid := case new.rule_type
    when 'student_struggle' then
      private.intervention_integer_between(new.thresholds, 'max_average', 0, 100)
      and private.intervention_integer_between(new.thresholds, 'min_evaluations', 1, 50)
      and new.thresholds - array['max_average', 'min_evaluations'] = '{}'::jsonb
    when 'student_absence' then
      private.intervention_integer_between(new.thresholds, 'min_absences', 1, 20)
      and new.thresholds - array['min_absences'] = '{}'::jsonb
    when 'teacher_late' then
      private.intervention_integer_between(new.thresholds, 'min_late_minutes', 1, 120)
      and private.intervention_integer_between(new.thresholds, 'min_occurrences', 1, 20)
      and new.thresholds - array['min_late_minutes', 'min_occurrences'] = '{}'::jsonb
    when 'renewal_due' then
      private.intervention_integer_between(new.thresholds, 'days_before', 1, 90)
      and new.thresholds - array['days_before'] = '{}'::jsonb
    when 'payment_overdue' then
      private.intervention_integer_between(new.thresholds, 'days_overdue', 1, 180)
      and new.thresholds - array['days_overdue'] = '{}'::jsonb
    when 'report_pending' then
      private.intervention_integer_between(new.thresholds, 'days_pending', 1, 90)
      and new.thresholds - array['days_pending'] = '{}'::jsonb
    when 'credit_exhausted' then
      private.intervention_integer_between(new.thresholds, 'max_remaining', 0, 10)
      and new.thresholds - array['max_remaining'] = '{}'::jsonb
    else false
  end;

  if not coalesce(thresholds_valid, false) then
    raise exception using errcode = '23514', message = 'intervention_rule_thresholds_invalid';
  end if;
  if new.window_interval not between interval '1 hour' and interval '365 days' then
    raise exception using errcode = '23514', message = 'intervention_rule_window_invalid';
  end if;
  if new.cooldown_interval not between interval '0 seconds' and interval '365 days' then
    raise exception using errcode = '23514', message = 'intervention_rule_cooldown_invalid';
  end if;

  new.action_code := expected_action;
  return new;
end;
$$;

revoke all on function private.intervention_integer_between(jsonb, text, integer, integer)
from public, anon, authenticated, service_role;
revoke all on function private.intervention_action_for_type(text)
from public, anon, authenticated, service_role;
revoke all on function private.validate_intervention_rule()
from public, anon, authenticated, service_role;

create trigger intervention_rules_validate
before insert or update on public.intervention_rules
for each row execute function private.validate_intervention_rule();
create trigger intervention_rules_set_updated_at
before update on public.intervention_rules
for each row execute function public.set_updated_at();
create trigger intervention_cases_set_updated_at
before update on public.intervention_cases
for each row execute function public.set_updated_at();
create trigger intervention_rules_audit
after insert or update or delete on public.intervention_rules
for each row execute function public.audit_row();
create trigger intervention_cases_audit
after insert or update or delete on public.intervention_cases
for each row execute function public.audit_row();

alter table public.intervention_rules enable row level security;
alter table public.intervention_cases enable row level security;

revoke all on public.intervention_rules, public.intervention_cases
from public, anon, authenticated;
grant select on public.intervention_rules, public.intervention_cases to authenticated;
grant select, insert, update, delete on public.intervention_rules, public.intervention_cases
to service_role;

create policy intervention_rules_admin_read
on public.intervention_rules for select to authenticated
using ((select public.is_admin()));
create policy intervention_cases_admin_read
on public.intervention_cases for select to authenticated
using ((select public.is_admin()));

create or replace function public.save_intervention_rule(
  p_rule_type text,
  p_priority smallint,
  p_thresholds jsonb,
  p_window_interval interval,
  p_cooldown_interval interval,
  p_is_enabled boolean default true,
  p_rule_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
set statement_timeout = '5s'
as $$
declare
  saved_id uuid;
  actor uuid := (select auth.uid());
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'admin_mfa_required';
  end if;
  if p_rule_type is null or p_priority is null or p_thresholds is null
    or p_window_interval is null or p_cooldown_interval is null or p_is_enabled is null then
    raise exception using errcode = '22023', message = 'intervention_rule_input_invalid';
  end if;

  if p_rule_id is null then
    insert into public.intervention_rules (
      rule_type, is_enabled, priority, thresholds, window_interval,
      cooldown_interval, action_code, updated_by
    ) values (
      p_rule_type, p_is_enabled, p_priority, p_thresholds, p_window_interval,
      p_cooldown_interval, coalesce(private.intervention_action_for_type(p_rule_type), ''), actor
    )
    returning id into saved_id;
  else
    update public.intervention_rules
    set is_enabled = p_is_enabled,
      priority = p_priority,
      thresholds = p_thresholds,
      window_interval = p_window_interval,
      cooldown_interval = p_cooldown_interval,
      updated_by = actor
    where id = p_rule_id and rule_type = p_rule_type
    returning id into saved_id;
    if saved_id is null then
      raise exception using errcode = 'P0002', message = 'intervention_rule_not_found';
    end if;
  end if;

  return saved_id;
end;
$$;

revoke all on function public.save_intervention_rule(text, smallint, jsonb, interval, interval, boolean, uuid)
from public, anon, authenticated, service_role;
grant execute on function public.save_intervention_rule(text, smallint, jsonb, interval, interval, boolean, uuid)
to authenticated;

create or replace function public.transition_intervention_case(
  p_case uuid,
  p_status text,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = ''
set statement_timeout = '5s'
as $$
declare
  case_row public.intervention_cases%rowtype;
  actor uuid := (select auth.uid());
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'admin_mfa_required';
  end if;
  if p_status not in ('acknowledged', 'resolved', 'dismissed')
    or (p_reason is not null and char_length(btrim(p_reason)) not between 2 and 500)
    or (p_status = 'dismissed' and p_reason is null) then
    raise exception using errcode = '22023', message = 'intervention_case_input_invalid';
  end if;

  select * into case_row
  from public.intervention_cases
  where id = p_case
  for update;
  if case_row.id is null then
    raise exception using errcode = 'P0002', message = 'intervention_case_not_found';
  end if;
  if not (
    (case_row.status = 'open' and p_status in ('acknowledged', 'resolved', 'dismissed'))
    or (case_row.status = 'acknowledged' and p_status in ('resolved', 'dismissed'))
  ) then
    raise exception using errcode = 'P0001', message = 'intervention_case_transition_invalid';
  end if;

  if p_status = 'acknowledged' then
    update public.intervention_cases
    set status = 'acknowledged', acknowledged_by = actor,
      acknowledged_at = pg_catalog.clock_timestamp()
    where id = p_case;
  elsif p_status = 'resolved' then
    update public.intervention_cases
    set status = 'resolved', resolved_by = actor,
      resolved_at = pg_catalog.clock_timestamp(), disposition_reason = p_reason
    where id = p_case;
  else
    update public.intervention_cases
    set status = 'dismissed', dismissed_by = actor,
      dismissed_at = pg_catalog.clock_timestamp(), disposition_reason = btrim(p_reason)
    where id = p_case;
  end if;
end;
$$;

revoke all on function public.transition_intervention_case(uuid, text, text)
from public, anon, authenticated, service_role;
grant execute on function public.transition_intervention_case(uuid, text, text)
to authenticated;

create or replace function private.upsert_intervention_candidate(
  p_rule public.intervention_rules,
  p_subject_type text,
  p_subject_id uuid,
  p_dedupe_key text,
  p_reason_code text,
  p_evidence jsonb,
  p_detected_at timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  active_case public.intervention_cases%rowtype;
  previous_case public.intervention_cases%rowtype;
  effective_priority smallint;
begin
  select * into active_case
  from public.intervention_cases
  where dedupe_key = p_dedupe_key and status in ('open', 'acknowledged')
  for update;

  if active_case.id is not null then
    effective_priority := least(
      5,
      p_rule.priority + greatest(
        floor(extract(epoch from (p_detected_at - active_case.first_detected_at))
          / greatest(extract(epoch from p_rule.window_interval), 1)),
        0
      )::integer
    )::smallint;
    if active_case.last_detected_at is distinct from p_detected_at then
      update public.intervention_cases
      set last_detected_at = p_detected_at,
        detection_count = detection_count + 1,
        evidence = p_evidence,
        priority = effective_priority,
        escalated_at = case
          when effective_priority > active_case.priority
            then coalesce(active_case.escalated_at, p_detected_at)
          else active_case.escalated_at
        end
      where id = active_case.id;
    end if;
    return true;
  end if;

  select * into previous_case
  from public.intervention_cases
  where dedupe_key = p_dedupe_key and status in ('resolved', 'dismissed')
  order by coalesce(resolved_at, dismissed_at, updated_at) desc, id
  limit 1
  for update;

  if previous_case.id is not null
    and p_detected_at < coalesce(previous_case.resolved_at, previous_case.dismissed_at, previous_case.updated_at)
      + p_rule.cooldown_interval then
    return true;
  end if;

  insert into public.intervention_cases (
    rule_id, subject_type, subject_id, dedupe_key, status, priority,
    reason_code, evidence, recommended_action, first_detected_at,
    last_detected_at, reopened_from_case_id
  ) values (
    p_rule.id, p_subject_type, p_subject_id, p_dedupe_key, 'open', p_rule.priority,
    p_reason_code, p_evidence, p_rule.action_code, p_detected_at,
    p_detected_at, previous_case.id
  );
  return true;
end;
$$;

revoke all on function private.upsert_intervention_candidate(
  public.intervention_rules, text, uuid, text, text, jsonb, timestamptz
) from public, anon, authenticated, service_role;

create or replace function public.evaluate_intervention_rules(
  p_at timestamptz default pg_catalog.now()
)
returns integer
language plpgsql
security definer
set search_path = ''
set statement_timeout = '30s'
as $$
declare
  rule_row public.intervention_rules%rowtype;
  candidate record;
  candidate_key text;
  detected_keys text[];
  detected_count integer := 0;
  current_run_id bigint;
begin
  if current_user not in ('postgres', 'service_role') then
    raise exception using errcode = '42501', message = 'intervention_evaluator_forbidden';
  end if;
  if p_at is null then
    raise exception using errcode = '22023', message = 'intervention_evaluation_time_invalid';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('public.evaluate_intervention_rules'));
  insert into public.job_runs(job_name, details)
  values ('evaluate_intervention_rules', jsonb_build_object('evaluated_at', p_at))
  returning id into current_run_id;

  for rule_row in
    select * from public.intervention_rules where is_enabled order by priority desc, rule_type, id
  loop
    detected_keys := array[]::text[];

    if rule_row.rule_type = 'student_absence' then
      for candidate in
        select session.student_id as subject_id,
          count(*)::integer as observed_count
        from public.sessions as session
        join public.attendance as attendance on attendance.session_id = session.id
        where attendance.status = 'student_absent'
          and session.scheduled_at > p_at - rule_row.window_interval
          and session.scheduled_at <= p_at
        group by session.student_id
        having count(*) >= (rule_row.thresholds ->> 'min_absences')::integer
      loop
        candidate_key := rule_row.rule_type || ':' || candidate.subject_id::text;
        detected_keys := array_append(detected_keys, candidate_key);
        perform private.upsert_intervention_candidate(
          rule_row, 'student', candidate.subject_id, candidate_key,
          'absence_threshold_reached',
          jsonb_build_object(
            'absences', candidate.observed_count,
            'minimum', (rule_row.thresholds ->> 'min_absences')::integer,
            'window_start', p_at - rule_row.window_interval,
            'window_end', p_at
          ),
          p_at
        );
        detected_count := detected_count + 1;
      end loop;
    elsif rule_row.rule_type = 'student_struggle' then
      for candidate in
        select session.student_id as subject_id,
          count(*)::integer as observed_count,
          round(avg(evaluation.total_score), 2) as observed_average
        from public.session_evaluations as evaluation
        join public.sessions as session on session.id = evaluation.session_id
        where evaluation.is_locked
          and evaluation.locked_at > p_at - rule_row.window_interval
          and evaluation.locked_at <= p_at
        group by session.student_id
        having count(*) >= (rule_row.thresholds ->> 'min_evaluations')::integer
          and avg(evaluation.total_score) <= (rule_row.thresholds ->> 'max_average')::numeric
      loop
        candidate_key := rule_row.rule_type || ':' || candidate.subject_id::text;
        detected_keys := array_append(detected_keys, candidate_key);
        perform private.upsert_intervention_candidate(
          rule_row, 'student', candidate.subject_id, candidate_key,
          'evaluation_average_below_threshold',
          jsonb_build_object(
            'evaluation_average', candidate.observed_average,
            'evaluations', candidate.observed_count,
            'maximum_average', (rule_row.thresholds ->> 'max_average')::integer,
            'minimum_evaluations', (rule_row.thresholds ->> 'min_evaluations')::integer,
            'window_start', p_at - rule_row.window_interval,
            'window_end', p_at
          ),
          p_at
        );
        detected_count := detected_count + 1;
      end loop;
    elsif rule_row.rule_type = 'teacher_late' then
      for candidate in
        select session.teacher_id as subject_id,
          count(*)::integer as observed_count,
          max(floor(extract(epoch from (attendance.teacher_joined_at - session.scheduled_at)) / 60))::integer
            as maximum_late_minutes
        from public.sessions as session
        join public.attendance as attendance on attendance.session_id = session.id
        where attendance.teacher_joined_at is not null
          and attendance.teacher_joined_at >= session.scheduled_at
            + pg_catalog.make_interval(mins => (rule_row.thresholds ->> 'min_late_minutes')::integer)
          and session.scheduled_at > p_at - rule_row.window_interval
          and session.scheduled_at <= p_at
        group by session.teacher_id
        having count(*) >= (rule_row.thresholds ->> 'min_occurrences')::integer
      loop
        candidate_key := rule_row.rule_type || ':' || candidate.subject_id::text;
        detected_keys := array_append(detected_keys, candidate_key);
        perform private.upsert_intervention_candidate(
          rule_row, 'teacher', candidate.subject_id, candidate_key,
          'teacher_lateness_threshold_reached',
          jsonb_build_object(
            'occurrences', candidate.observed_count,
            'maximum_late_minutes', candidate.maximum_late_minutes,
            'minimum_late_minutes', (rule_row.thresholds ->> 'min_late_minutes')::integer,
            'window_start', p_at - rule_row.window_interval,
            'window_end', p_at
          ),
          p_at
        );
        detected_count := detected_count + 1;
      end loop;
    elsif rule_row.rule_type = 'renewal_due' then
      for candidate in
        select subscription.id as subject_id, subscription.renew_date
        from public.subscriptions as subscription
        where subscription.status in ('trial', 'active', 'paused')
          and subscription.renew_date between p_at::date
            and p_at::date + (rule_row.thresholds ->> 'days_before')::integer
      loop
        candidate_key := rule_row.rule_type || ':' || candidate.subject_id::text;
        detected_keys := array_append(detected_keys, candidate_key);
        perform private.upsert_intervention_candidate(
          rule_row, 'subscription', candidate.subject_id, candidate_key,
          'subscription_renewal_due',
          jsonb_build_object(
            'renew_date', candidate.renew_date,
            'days_remaining', candidate.renew_date - p_at::date,
            'days_before', (rule_row.thresholds ->> 'days_before')::integer
          ),
          p_at
        );
        detected_count := detected_count + 1;
      end loop;
    elsif rule_row.rule_type = 'payment_overdue' then
      for candidate in
        select invoice.id as subject_id, invoice.due_date, invoice.status::text as invoice_status
        from public.invoices as invoice
        where invoice.status in ('issued', 'partially_paid', 'overdue')
          and invoice.due_date is not null
          and invoice.due_date <= p_at::date - (rule_row.thresholds ->> 'days_overdue')::integer
      loop
        candidate_key := rule_row.rule_type || ':' || candidate.subject_id::text;
        detected_keys := array_append(detected_keys, candidate_key);
        perform private.upsert_intervention_candidate(
          rule_row, 'invoice', candidate.subject_id, candidate_key,
          'invoice_payment_overdue',
          jsonb_build_object(
            'due_date', candidate.due_date,
            'invoice_status', candidate.invoice_status,
            'days_overdue', p_at::date - candidate.due_date
          ),
          p_at
        );
        detected_count := detected_count + 1;
      end loop;
    elsif rule_row.rule_type = 'report_pending' then
      for candidate in
        select report.id as subject_id, report.status::text as report_status, report.updated_at
        from public.reports as report
        where report.status::text in ('draft', 'submitted')
          and report.updated_at <= p_at
            - pg_catalog.make_interval(days => (rule_row.thresholds ->> 'days_pending')::integer)
      loop
        candidate_key := rule_row.rule_type || ':' || candidate.subject_id::text;
        detected_keys := array_append(detected_keys, candidate_key);
        perform private.upsert_intervention_candidate(
          rule_row, 'report', candidate.subject_id, candidate_key,
          'report_pending_too_long',
          jsonb_build_object(
            'report_status', candidate.report_status,
            'pending_since', candidate.updated_at,
            'days_pending', floor(extract(epoch from (p_at - candidate.updated_at)) / 86400)::integer
          ),
          p_at
        );
        detected_count := detected_count + 1;
      end loop;
    elsif rule_row.rule_type = 'credit_exhausted' then
      for candidate in
        select subscription.id as subject_id,
          coalesce(balance.sessions_remaining, 0)::integer as sessions_remaining
        from public.subscriptions as subscription
        left join public.subscription_balance as balance on balance.subscription_id = subscription.id
        where subscription.status in ('trial', 'active')
          and coalesce(balance.sessions_remaining, 0)
            <= (rule_row.thresholds ->> 'max_remaining')::integer
      loop
        candidate_key := rule_row.rule_type || ':' || candidate.subject_id::text;
        detected_keys := array_append(detected_keys, candidate_key);
        perform private.upsert_intervention_candidate(
          rule_row, 'subscription', candidate.subject_id, candidate_key,
          'session_credit_exhausted',
          jsonb_build_object(
            'sessions_remaining', candidate.sessions_remaining,
            'maximum_remaining', (rule_row.thresholds ->> 'max_remaining')::integer
          ),
          p_at
        );
        detected_count := detected_count + 1;
      end loop;
    end if;

    update public.intervention_cases
    set status = 'resolved', resolved_at = p_at, resolved_by = null,
      disposition_reason = 'condition_cleared'
    where rule_id = rule_row.id
      and status in ('open', 'acknowledged')
      and not (dedupe_key = any(detected_keys));
  end loop;

  update public.job_runs
  set finished_at = pg_catalog.clock_timestamp(), result = 'succeeded',
    affected_rows = detected_count,
    details = details || jsonb_build_object('detected_cases', detected_count)
  where id = current_run_id;

  return detected_count;
end;
$$;

revoke all on function public.evaluate_intervention_rules(timestamptz)
from public, anon, authenticated, service_role;
grant execute on function public.evaluate_intervention_rules(timestamptz)
to service_role;

select cron.schedule(
  'evaluate-interventions-hourly',
  '5 * * * *',
  $$select public.evaluate_intervention_rules()$$
)
where not exists (
  select 1 from cron.job where jobname = 'evaluate-interventions-hourly'
);

comment on table public.intervention_rules is
'P10 deterministic intervention registry; thresholds are validated per known rule type.';
comment on table public.intervention_cases is
'P10 explainable intervention history with one active case per deterministic dedupe key.';
comment on function public.evaluate_intervention_rules(timestamptz) is
'Evaluates enabled rules under a transaction advisory lock, deduplicates active cases, and preserves reopen history.';

insert into supabase_migrations.schema_migrations(version, statements, name) values ('20261023112010', array[]::text[], 'create_intervention_rules') on conflict (version) do nothing;
-- END MIGRATION 20261023112010_create_intervention_rules.sql
-- BEGIN MIGRATION 20261023113423_create_advanced_report_exports.sql
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

insert into supabase_migrations.schema_migrations(version, statements, name) values ('20261023113423', array[]::text[], 'create_advanced_report_exports') on conflict (version) do nothing;
-- END MIGRATION 20261023113423_create_advanced_report_exports.sql
-- BEGIN MIGRATION 20261023113617_add_advanced_report_query.sql
create or replace function public.get_admin_advanced_report(
  p_report_type text,
  p_from date,
  p_to date,
  p_country text default null,
  p_track uuid default null,
  p_teacher uuid default null,
  p_status text default null,
  p_sort text default null,
  p_direction text default 'asc',
  p_page integer default 1,
  p_page_size integer default 50,
  p_locale text default 'ar',
  p_timezone text default 'Africa/Cairo'
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
set statement_timeout = '15s'
as $$
declare
  allowed_sort text[];
  effective_sort text;
  rows_data jsonb := '[]'::jsonb;
  currency_totals jsonb := '[]'::jsonb;
  total_rows integer := 0;
  offset_rows integer;
  range_start timestamptz;
  range_end timestamptz;
begin
  if not public.is_admin() and (select auth.role()) <> 'service_role' then
    raise exception using errcode = '42501', message = 'admin_mfa_required';
  end if;
  if p_report_type not in ('students', 'sessions', 'finance', 'interventions')
    or p_from is null or p_to is null or p_from > p_to or p_to - p_from > 366
    or p_direction not in ('asc', 'desc')
    or p_page not between 1 and 100000
    or p_page_size not between 1 and 200
    or p_locale not in ('ar', 'en')
    or not exists (select 1 from pg_catalog.pg_timezone_names where name = p_timezone)
    or (p_country is not null and p_country !~ '^[A-Z]{2}$')
    or (p_status is not null and char_length(p_status) not between 2 and 40) then
    raise exception using errcode = '22023', message = 'advanced_report_input_invalid';
  end if;

  allowed_sort := case p_report_type
    when 'students' then array['student_no', 'full_name', 'country', 'status']
    when 'sessions' then array['scheduled_at', 'student', 'teacher', 'status']
    when 'finance' then array['invoice_no', 'student', 'currency', 'status', 'due_date', 'created_at']
    when 'interventions' then array['rule_type', 'subject_type', 'status', 'first_detected_at', 'last_detected_at']
  end;
  effective_sort := coalesce(p_sort, allowed_sort[1]);
  if effective_sort <> all(allowed_sort) then
    raise exception using errcode = '22023', message = 'advanced_report_sort_invalid';
  end if;

  offset_rows := (p_page - 1) * p_page_size;
  range_start := p_from::timestamp at time zone p_timezone;
  range_end := (p_to + 1)::timestamp at time zone p_timezone;

  if p_report_type = 'students' then
    with filtered as (
      select student.id,
        jsonb_build_object(
          'student_no', student.student_no,
          'full_name', student.full_name,
          'country', student.country_code,
          'status', student.status,
          'track', current_assignment.track_name,
          'teacher', current_assignment.teacher_name,
          'subscription_status', current_subscription.status,
          'sessions', coalesce(activity.sessions, 0),
          'attendance_rate', activity.attendance_rate,
          'evaluation_average', activity.evaluation_average
        ) as row_data,
        case effective_sort
          when 'student_no' then student.student_no
          when 'full_name' then student.full_name
          when 'country' then coalesce(student.country_code, '')
          when 'status' then student.status::text
        end as sort_value
      from public.students as student
      left join lateral (
        select assignment.teacher_id, assignment.track_id,
          teacher_profile.full_name as teacher_name,
          case when p_locale = 'ar' or track.name_en is null then track.name_ar else track.name_en end as track_name
        from public.teacher_assignments as assignment
        join public.teachers as teacher on teacher.id = assignment.teacher_id
        join public.profiles as teacher_profile on teacher_profile.id = teacher.profile_id
        join public.tracks as track on track.id = assignment.track_id
        where assignment.student_id = student.id
          and assignment.status in ('active', 'paused')
        order by (assignment.status = 'active') desc, assignment.created_at desc, assignment.id
        limit 1
      ) as current_assignment on true
      left join lateral (
        select subscription.status::text
        from public.subscriptions as subscription
        where subscription.student_id = student.id
        order by (subscription.status in ('trial', 'active', 'paused')) desc,
          subscription.current_period_end desc, subscription.id
        limit 1
      ) as current_subscription on true
      left join lateral (
        select count(distinct session.id)::integer as sessions,
          round(
            100.0 * count(attendance.session_id) filter (
              where attendance.status in ('present', 'late')
            ) / nullif(count(attendance.session_id) filter (
              where attendance.status not in (
                'cancelled_admin', 'cancelled_teacher', 'teacher_absent'
              )
            ), 0),
            2
          ) as attendance_rate,
          round(avg(evaluation.total_score) filter (where evaluation.is_locked), 2) as evaluation_average
        from public.sessions as session
        left join public.attendance as attendance on attendance.session_id = session.id
        left join public.session_evaluations as evaluation on evaluation.session_id = session.id
        where session.student_id = student.id
          and session.scheduled_at >= range_start and session.scheduled_at < range_end
      ) as activity on true
      where (p_country is null or student.country_code = p_country)
        and (p_track is null or current_assignment.track_id = p_track)
        and (p_teacher is null or current_assignment.teacher_id = p_teacher)
        and (p_status is null or student.status::text = p_status)
    ), numbered as (
      select row_data,
        row_number() over (
          order by
            case when p_direction = 'asc' then sort_value end asc nulls last,
            case when p_direction = 'desc' then sort_value end desc nulls last,
            id
        ) as row_order
      from filtered
    )
    select count(*)::integer,
      coalesce(jsonb_agg(row_data order by row_order)
        filter (where row_order > offset_rows and row_order <= offset_rows + p_page_size), '[]'::jsonb)
    into total_rows, rows_data
    from numbered;

  elsif p_report_type = 'sessions' then
    with filtered as (
      select session.id,
        jsonb_build_object(
          'scheduled_at', session.scheduled_at,
          'student', student.full_name,
          'teacher', teacher_profile.full_name,
          'status', session.status,
          'attendance_status', attendance.status,
          'duration_min', session.duration_min,
          'track', case when p_locale = 'ar' or track.name_en is null then track.name_ar else track.name_en end,
          'country', student.country_code
        ) as row_data,
        case effective_sort
          when 'scheduled_at' then session.scheduled_at::text
          when 'student' then student.full_name
          when 'teacher' then teacher_profile.full_name
          when 'status' then session.status::text
        end as sort_value
      from public.sessions as session
      join public.students as student on student.id = session.student_id
      join public.teachers as teacher on teacher.id = session.teacher_id
      join public.profiles as teacher_profile on teacher_profile.id = teacher.profile_id
      left join public.teacher_assignments as assignment on assignment.id = session.assignment_id
      left join public.tracks as track on track.id = assignment.track_id
      left join public.attendance as attendance on attendance.session_id = session.id
      where session.scheduled_at >= range_start and session.scheduled_at < range_end
        and (p_country is null or student.country_code = p_country)
        and (p_track is null or assignment.track_id = p_track)
        and (p_teacher is null or session.teacher_id = p_teacher)
        and (p_status is null or session.status::text = p_status)
    ), numbered as (
      select row_data,
        row_number() over (
          order by
            case when p_direction = 'asc' then sort_value end asc nulls last,
            case when p_direction = 'desc' then sort_value end desc nulls last,
            id
        ) as row_order
      from filtered
    )
    select count(*)::integer,
      coalesce(jsonb_agg(row_data order by row_order)
        filter (where row_order > offset_rows and row_order <= offset_rows + p_page_size), '[]'::jsonb)
    into total_rows, rows_data
    from numbered;

  elsif p_report_type = 'finance' then
    with invoice_payments as (
      select payment.invoice_id,
        coalesce(sum(case when payment.kind = 'payment' then payment.amount else -payment.amount end)
          filter (where payment.status = 'confirmed'), 0)::numeric(12,2) as paid
      from public.payments as payment
      group by payment.invoice_id
    ), filtered as (
      select invoice.id, invoice.currency,
        jsonb_build_object(
          'invoice_no', invoice.invoice_no,
          'student', student.full_name,
          'country', student.country_code,
          'currency', invoice.currency,
          'total', invoice.total,
          'paid', coalesce(invoice_payments.paid, 0),
          'outstanding', greatest(invoice.total - coalesce(invoice_payments.paid, 0), 0),
          'status', invoice.status,
          'due_date', invoice.due_date,
          'created_at', invoice.created_at
        ) as row_data,
        case effective_sort
          when 'invoice_no' then invoice.invoice_no
          when 'student' then student.full_name
          when 'currency' then invoice.currency
          when 'status' then invoice.status::text
          when 'due_date' then coalesce(invoice.due_date::text, '')
          when 'created_at' then invoice.created_at::text
        end as sort_value
      from public.invoices as invoice
      join public.students as student on student.id = invoice.student_id
      left join invoice_payments on invoice_payments.invoice_id = invoice.id
      left join lateral (
        select assignment.track_id, assignment.teacher_id
        from public.teacher_assignments as assignment
        where assignment.student_id = student.id and assignment.status in ('active', 'paused')
        order by (assignment.status = 'active') desc, assignment.created_at desc, assignment.id
        limit 1
      ) as current_assignment on true
      where invoice.created_at >= range_start and invoice.created_at < range_end
        and (p_country is null or student.country_code = p_country)
        and (p_track is null or current_assignment.track_id = p_track)
        and (p_teacher is null or current_assignment.teacher_id = p_teacher)
        and (p_status is null or invoice.status::text = p_status)
    ), numbered as (
      select row_data,
        row_number() over (
          order by
            case when p_direction = 'asc' then sort_value end asc nulls last,
            case when p_direction = 'desc' then sort_value end desc nulls last,
            id
        ) as row_order
      from filtered
    )
    select count(*)::integer,
      coalesce(jsonb_agg(row_data order by row_order)
        filter (where row_order > offset_rows and row_order <= offset_rows + p_page_size), '[]'::jsonb),
      coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'currency', currency,
            'total', currency_total,
            'paid', currency_paid,
            'outstanding', currency_outstanding
          ) order by currency
        )
        from (
          select currency,
            sum((row_data ->> 'total')::numeric) as currency_total,
            sum((row_data ->> 'paid')::numeric) as currency_paid,
            sum((row_data ->> 'outstanding')::numeric) as currency_outstanding
          from filtered
          group by currency
        ) as by_currency
      ), '[]'::jsonb)
    into total_rows, rows_data, currency_totals
    from numbered;

  else
    with filtered as (
      select intervention_case.id,
        jsonb_build_object(
          'rule_type', intervention_rule.rule_type,
          'subject_type', intervention_case.subject_type,
          'subject_id', intervention_case.subject_id,
          'priority', intervention_case.priority,
          'status', intervention_case.status,
          'reason_code', intervention_case.reason_code,
          'recommended_action', intervention_case.recommended_action,
          'first_detected_at', intervention_case.first_detected_at,
          'last_detected_at', intervention_case.last_detected_at,
          'detection_count', intervention_case.detection_count
        ) as row_data,
        case effective_sort
          when 'rule_type' then intervention_rule.rule_type
          when 'subject_type' then intervention_case.subject_type
          when 'status' then intervention_case.status
          when 'first_detected_at' then intervention_case.first_detected_at::text
          when 'last_detected_at' then intervention_case.last_detected_at::text
        end as sort_value
      from public.intervention_cases as intervention_case
      join public.intervention_rules as intervention_rule on intervention_rule.id = intervention_case.rule_id
      where intervention_case.first_detected_at >= range_start
        and intervention_case.first_detected_at < range_end
        and (p_status is null or intervention_case.status = p_status)
    ), numbered as (
      select row_data,
        row_number() over (
          order by
            case when p_direction = 'asc' then sort_value end asc nulls last,
            case when p_direction = 'desc' then sort_value end desc nulls last,
            id
        ) as row_order
      from filtered
    )
    select count(*)::integer,
      coalesce(jsonb_agg(row_data order by row_order)
        filter (where row_order > offset_rows and row_order <= offset_rows + p_page_size), '[]'::jsonb)
    into total_rows, rows_data
    from numbered;
  end if;

  return jsonb_build_object(
    'report_type', p_report_type,
    'page', p_page,
    'page_size', p_page_size,
    'total', total_rows,
    'rows', rows_data,
    'currency_totals', currency_totals,
    'filters', jsonb_strip_nulls(jsonb_build_object(
      'from', p_from,
      'to', p_to,
      'country', p_country,
      'track', p_track,
      'teacher', p_teacher,
      'status', p_status,
      'sort', effective_sort,
      'direction', p_direction,
      'timezone', p_timezone
    )),
    'refreshed_at', pg_catalog.clock_timestamp()
  );
end;
$$;

revoke all on function public.get_admin_advanced_report(
  text, date, date, text, uuid, uuid, text, text, text, integer, integer, text, text
) from public, anon, authenticated, service_role;
grant execute on function public.get_admin_advanced_report(
  text, date, date, text, uuid, uuid, text, text, text, integer, integer, text, text
) to authenticated, service_role;

comment on function public.get_admin_advanced_report(
  text, date, date, text, uuid, uuid, text, text, text, integer, integer, text, text
) is 'AAL2-only, paginated P10 report rows with server-side filters and deterministic whitelisted sorting.';

create or replace function public.retry_admin_export(p_job uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
set statement_timeout = '5s'
as $$
declare
  retried_id uuid;
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'admin_mfa_required';
  end if;
  update public.export_jobs
  set status = 'queued', attempts = 0, next_attempt_at = pg_catalog.now(),
    started_at = null, finished_at = null, error_code = null
  where id = p_job and requested_by = (select auth.uid()) and status = 'failed'
  returning id into retried_id;
  if retried_id is null then
    raise exception using errcode = 'P0002', message = 'export_job_not_retryable';
  end if;
  return retried_id;
end;
$$;

revoke all on function public.retry_admin_export(uuid)
from public, anon, authenticated, service_role;
grant execute on function public.retry_admin_export(uuid) to authenticated;

create or replace function public.claim_admin_export_job(p_job uuid)
returns public.export_jobs
language plpgsql
security definer
set search_path = ''
set statement_timeout = '5s'
as $$
declare
  claimed public.export_jobs%rowtype;
begin
  if (select auth.role()) <> 'service_role' then
    raise exception using errcode = '42501', message = 'export_worker_forbidden';
  end if;
  update public.export_jobs
  set status = 'processing', attempts = attempts + 1,
    started_at = pg_catalog.clock_timestamp()
  where id = p_job and status = 'queued' and attempts < 3
    and next_attempt_at <= pg_catalog.now()
  returning * into claimed;
  return claimed;
end;
$$;

revoke all on function public.claim_admin_export_job(uuid)
from public, anon, authenticated, service_role;
grant execute on function public.claim_admin_export_job(uuid) to service_role;

insert into supabase_migrations.schema_migrations(version, statements, name) values ('20261023113617', array[]::text[], 'add_advanced_report_query') on conflict (version) do nothing;
-- END MIGRATION 20261023113617_add_advanced_report_query.sql
-- BEGIN MIGRATION 20261023123000_add_intervention_center_notifications.sql
alter table public.notifications
  add column source_key text,
  add column in_app_visible boolean not null default true;

alter table public.notifications
  add constraint notifications_source_key_valid check (
    source_key is null or char_length(source_key) between 3 and 200
  );

create unique index notifications_source_once_idx
on public.notifications (user_id, type, source_key)
where source_key is not null;

create unique index notification_outbox_channel_once_idx
on public.notification_outbox (notification_id, channel);

drop policy notifications_read_own on public.notifications;
create policy notifications_read_own on public.notifications
for select to authenticated
using (user_id = (select auth.uid()) and in_app_visible);

create table public.intervention_notification_events (
  id bigint generated always as identity primary key,
  case_id uuid not null references public.intervention_cases(id) on delete cascade,
  event_key text not null check (event_key ~ '^(opened|escalated:[1-5])$'),
  priority smallint not null check (priority between 1 and 5),
  recipient_count integer not null check (recipient_count > 0),
  created_at timestamptz not null default now(),
  unique (case_id, event_key)
);

create index intervention_notification_events_case_idx
on public.intervention_notification_events (case_id, created_at desc);

alter table public.intervention_notification_events enable row level security;
revoke all on public.intervention_notification_events from public, anon, authenticated;
grant select on public.intervention_notification_events to authenticated;
grant select, insert, update, delete on public.intervention_notification_events to service_role;

create policy intervention_notification_events_admin_read
on public.intervention_notification_events for select to authenticated
using ((select public.is_admin()));

create or replace function public.get_intervention_center(
  p_status text default null,
  p_priority smallint default null,
  p_rule_type text default null,
  p_page integer default 1,
  p_page_size integer default 20
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set statement_timeout = '5s'
as $$
declare
  result jsonb;
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'admin_mfa_required';
  end if;
  if (p_status is not null and p_status not in ('open', 'acknowledged', 'resolved', 'dismissed'))
    or (p_priority is not null and p_priority not between 1 and 5)
    or (p_rule_type is not null and private.intervention_action_for_type(p_rule_type) is null)
    or p_page not between 1 and 100000
    or p_page_size not between 1 and 50 then
    raise exception using errcode = '22023', message = 'intervention_center_filters_invalid';
  end if;

  with filtered as (
    select intervention_case.*, intervention_rule.rule_type
    from public.intervention_cases as intervention_case
    join public.intervention_rules as intervention_rule on intervention_rule.id = intervention_case.rule_id
    where (p_status is null or intervention_case.status = p_status)
      and (p_priority is null or intervention_case.priority = p_priority)
      and (p_rule_type is null or intervention_rule.rule_type = p_rule_type)
  ), page_rows as (
    select filtered.*,
      case filtered.subject_type
        when 'student' then (select student.full_name from public.students as student where student.id = filtered.subject_id)
        when 'teacher' then (
          select profile.full_name from public.teachers as teacher
          join public.profiles as profile on profile.id = teacher.profile_id
          where teacher.id = filtered.subject_id
        )
        when 'subscription' then (
          select student.full_name from public.subscriptions as subscription
          join public.students as student on student.id = subscription.student_id
          where subscription.id = filtered.subject_id
        )
        when 'invoice' then (
          select student.full_name from public.invoices as invoice
          join public.students as student on student.id = invoice.student_id
          where invoice.id = filtered.subject_id
        )
        when 'report' then (
          select student.full_name from public.reports as report
          join public.students as student on student.id = report.student_id
          where report.id = filtered.subject_id
        )
      end as subject_name,
      case filtered.recommended_action
        when 'review_student_progress' then '/admin/students'
        when 'contact_guardian' then '/admin/students'
        when 'review_teacher_attendance' then '/admin/attendance'
        when 'contact_payer' then '/admin/subscriptions'
        when 'review_invoice' then '/admin/finance'
        when 'review_report' then '/admin/reports'
        when 'replenish_credit' then '/admin/subscriptions'
      end as action_path
    from filtered
    order by filtered.priority desc, filtered.first_detected_at, filtered.id
    limit p_page_size offset ((p_page - 1) * p_page_size)
  )
  select jsonb_build_object(
    'rows', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', row.id,
        'rule_type', row.rule_type,
        'subject_type', row.subject_type,
        'subject_id', row.subject_id,
        'subject_name', coalesce(row.subject_name, row.subject_id::text),
        'status', row.status,
        'priority', row.priority,
        'reason_code', row.reason_code,
        'evidence', row.evidence,
        'recommended_action', row.recommended_action,
        'action_path', row.action_path,
        'first_detected_at', row.first_detected_at,
        'last_detected_at', row.last_detected_at,
        'detection_count', row.detection_count,
        'escalated_at', row.escalated_at,
        'disposition_reason', row.disposition_reason
      ) order by row.priority desc, row.first_detected_at, row.id)
      from page_rows as row
    ), '[]'::jsonb),
    'total', (select count(*) from filtered),
    'page', p_page,
    'page_size', p_page_size,
    'counts', jsonb_build_object(
      'open', (select count(*) from filtered where status = 'open'),
      'acknowledged', (select count(*) from filtered where status = 'acknowledged'),
      'resolved', (select count(*) from filtered where status = 'resolved'),
      'dismissed', (select count(*) from filtered where status = 'dismissed')
    ),
    'generated_at', pg_catalog.clock_timestamp()
  ) into result;

  return result;
end;
$$;

revoke all on function public.get_intervention_center(text, smallint, text, integer, integer)
from public, anon, authenticated, service_role;
grant execute on function public.get_intervention_center(text, smallint, text, integer, integer)
to authenticated;

create or replace function private.notification_pref_enabled(
  p_prefs jsonb,
  p_key text,
  p_default boolean
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case
    when jsonb_typeof(p_prefs -> p_key) = 'boolean' then (p_prefs ->> p_key)::boolean
    else p_default
  end
$$;

revoke all on function private.notification_pref_enabled(jsonb, text, boolean)
from public, anon, authenticated, service_role;

create or replace function public.dispatch_intervention_notifications(
  p_at timestamptz default pg_catalog.now()
)
returns integer
language plpgsql
security definer
set search_path = ''
set statement_timeout = '30s'
as $$
declare
  candidate record;
  recipient record;
  stored_prefs jsonb;
  notification_id uuid;
  in_app_enabled boolean;
  email_enabled boolean;
  recipients integer;
  dispatched integer := 0;
  run_id bigint;
begin
  if current_user not in ('postgres', 'service_role') then
    raise exception using errcode = '42501', message = 'intervention_dispatcher_forbidden';
  end if;
  if p_at is null then
    raise exception using errcode = '22023', message = 'intervention_dispatch_time_invalid';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('public.dispatch_intervention_notifications'));
  insert into public.job_runs(job_name, details)
  values ('dispatch_intervention_notifications', jsonb_build_object('dispatched_at', p_at))
  returning id into run_id;

  for candidate in
    select intervention_case.*,
      intervention_rule.rule_type,
      case
        when intervention_case.escalated_at is not null
          then 'escalated:' || intervention_case.priority::text
        else 'opened'
      end as event_key
    from public.intervention_cases as intervention_case
    join public.intervention_rules as intervention_rule on intervention_rule.id = intervention_case.rule_id
    where intervention_case.status in ('open', 'acknowledged')
      and not exists (
        select 1 from public.intervention_notification_events as event
        where event.case_id = intervention_case.id
          and event.event_key = case
            when intervention_case.escalated_at is not null
              then 'escalated:' || intervention_case.priority::text
            else 'opened'
          end
      )
    order by intervention_case.priority desc, intervention_case.first_detected_at, intervention_case.id
    for update of intervention_case skip locked
  loop
    recipients := 0;
    for recipient in
      select profile.id, profile.preferred_locale
      from public.profiles as profile
      where profile.role = 'admin' and profile.is_active
      order by profile.id
    loop
      select preference.prefs into stored_prefs
      from public.notification_prefs as preference
      where preference.user_id = recipient.id;

      in_app_enabled := private.notification_pref_enabled(stored_prefs, 'in_app', true)
        and private.notification_pref_enabled(stored_prefs, 'intervention', true);
      email_enabled := private.notification_pref_enabled(stored_prefs, 'intervention_email', true);

      if not in_app_enabled and not email_enabled then
        continue;
      end if;

      insert into public.notifications (user_id, type, source_key, in_app_visible, payload)
      values (
        recipient.id,
        case when candidate.event_key = 'opened' then 'intervention_opened' else 'intervention_escalated' end,
        candidate.id::text || ':' || candidate.event_key,
        in_app_enabled,
        jsonb_build_object(
          'case_id', candidate.id,
          'rule_type', candidate.rule_type,
          'priority', candidate.priority,
          'reason_code', candidate.reason_code,
          'action_href', '/' || recipient.preferred_locale || '/admin/control-center?caseStatus=' || candidate.status
        )
      )
      on conflict (user_id, type, source_key) where source_key is not null
      do update set payload = excluded.payload
      returning id into notification_id;

      if email_enabled then
        insert into public.notification_outbox (notification_id, channel)
        values (notification_id, 'email')
        on conflict (notification_id, channel) do nothing;
      end if;
      recipients := recipients + 1;
    end loop;

    if recipients > 0 then
      insert into public.intervention_notification_events (case_id, event_key, priority, recipient_count)
      values (candidate.id, candidate.event_key, candidate.priority, recipients)
      on conflict (case_id, event_key) do nothing;
      dispatched := dispatched + 1;
    end if;
  end loop;

  update public.job_runs
  set finished_at = pg_catalog.clock_timestamp(), result = 'succeeded',
    affected_rows = dispatched,
    details = details || jsonb_build_object('dispatched_cases', dispatched)
  where id = run_id;
  return dispatched;
end;
$$;

revoke all on function public.dispatch_intervention_notifications(timestamptz)
from public, anon, authenticated, service_role;
grant execute on function public.dispatch_intervention_notifications(timestamptz)
to service_role;

create or replace function public.claim_notification_outbox(p_limit integer default 25)
returns jsonb
language plpgsql
security definer
set search_path = ''
set statement_timeout = '5s'
as $$
declare
  claimed jsonb;
begin
  if current_user not in ('postgres', 'service_role') then
    raise exception using errcode = '42501', message = 'notification_worker_forbidden';
  end if;
  if p_limit not between 1 and 100 then
    raise exception using errcode = '22023', message = 'notification_claim_limit_invalid';
  end if;

  update public.notification_outbox
  set status = 'failed', next_attempt_at = pg_catalog.now(), last_error = 'processing_timeout'
  where status = 'processing' and updated_at < pg_catalog.now() - interval '15 minutes';

  with candidates as (
    select outbox.id
    from public.notification_outbox as outbox
    where outbox.status in ('pending', 'failed')
      and outbox.next_attempt_at <= pg_catalog.now()
      and outbox.attempts < 5
    order by outbox.next_attempt_at, outbox.created_at, outbox.id
    limit p_limit
    for update skip locked
  ), updated as (
    update public.notification_outbox as outbox
    set status = 'processing', attempts = outbox.attempts + 1, last_error = null
    from candidates
    where outbox.id = candidates.id
    returning outbox.id, outbox.notification_id, outbox.attempts
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'outbox_id', updated.id,
    'notification_id', notification.id,
    'attempts', updated.attempts,
    'recipient', private_profile.contact_email,
    'locale', profile.preferred_locale,
    'type', notification.type,
    'payload', notification.payload
  ) order by updated.id), '[]'::jsonb)
  into claimed
  from updated
  join public.notifications as notification on notification.id = updated.notification_id
  join public.profiles as profile on profile.id = notification.user_id
  left join public.profile_private as private_profile on private_profile.profile_id = profile.id;

  return claimed;
end;
$$;

revoke all on function public.claim_notification_outbox(integer)
from public, anon, authenticated, service_role;
grant execute on function public.claim_notification_outbox(integer) to service_role;

select cron.schedule(
  'dispatch-intervention-notifications',
  '*/10 * * * *',
  $$select public.dispatch_intervention_notifications()$$
)
where not exists (
  select 1 from cron.job where jobname = 'dispatch-intervention-notifications'
);

comment on function public.get_intervention_center(text, smallint, text, integer, integer) is
'P10-T04 stable intervention queue for MFA administrators with server-side filters and pagination.';
comment on function public.dispatch_intervention_notifications(timestamptz) is
'P10-T04 idempotent in-app/email outbox dispatcher for newly opened or escalated intervention cases.';
comment on function public.claim_notification_outbox(integer) is
'P10-T04 atomic bounded outbox claim with stale-worker recovery and maximum five attempts.';

insert into supabase_migrations.schema_migrations(version, statements, name) values ('20261023123000', array[]::text[], 'add_intervention_center_notifications') on conflict (version) do nothing;
-- END MIGRATION 20261023123000_add_intervention_center_notifications.sql
-- BEGIN MIGRATION 20261023133000_create_versioned_content_templates.sql
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

insert into supabase_migrations.schema_migrations(version, statements, name) values ('20261023133000', array[]::text[], 'create_versioned_content_templates') on conflict (version) do nothing;
-- END MIGRATION 20261023133000_create_versioned_content_templates.sql
-- BEGIN MIGRATION 20261023152747_harden_financial_reconciliation_auth.sql
alter function public.run_financial_reconciliation() set schema private;
alter function private.run_financial_reconciliation() rename to run_financial_reconciliation_unchecked;

revoke all on function private.run_financial_reconciliation_unchecked()
from public, anon, authenticated, service_role;

create or replace function public.run_financial_reconciliation()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  jwt_role text := nullif((select auth.jwt() ->> 'role'), '');
begin
  if jwt_role = 'service_role' then
    null;
  elsif jwt_role = 'authenticated' then
    if actor is null or not public.is_admin() then
      raise exception using errcode = '42501', message = 'admin_mfa_required';
    end if;
  elsif jwt_role is not null
    or session_user not in ('postgres', 'supabase_admin') then
    raise exception using errcode = '42501', message = 'admin_mfa_required';
  end if;

  return private.run_financial_reconciliation_unchecked();
end;
$$;

revoke execute on function public.run_financial_reconciliation() from public, anon;
grant execute on function public.run_financial_reconciliation() to authenticated, service_role;

comment on function public.run_financial_reconciliation() is
'Runs AC-120/AC-130 reconciliation for an AAL2 administrator, service role, or trusted database scheduler; delegates only after authorization.';

insert into supabase_migrations.schema_migrations(version, statements, name) values ('20261023152747', array[]::text[], 'harden_financial_reconciliation_auth') on conflict (version) do nothing;
-- END MIGRATION 20261023152747_harden_financial_reconciliation_auth.sql
-- BEGIN MIGRATION 20261023170000_fix_function_schema_lint.sql
create or replace function public.issue_certificate(
  p_version uuid,
  p_student uuid,
  p_locale text,
  p_achievement text,
  p_idempotency_key text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  version_row public.certificate_template_versions%rowtype;
  template_row public.certificate_templates%rowtype;
  student_name text;
  result uuid;
  serial text;
  code text;
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'admin_mfa_required';
  end if;
  if p_locale not in ('ar', 'en')
    or char_length(btrim(p_achievement)) not between 2 and 500
    or char_length(p_idempotency_key) not between 8 and 180 then
    raise exception using errcode = '22023', message = 'certificate_issue_invalid';
  end if;

  select id into result
  from public.certificates
  where idempotency_key = p_idempotency_key;
  if result is not null then
    return result;
  end if;

  select * into version_row
  from public.certificate_template_versions
  where id = p_version and status = 'published';
  if version_row.id is null then
    raise exception using errcode = 'P0001', message = 'certificate_template_not_published';
  end if;

  select * into template_row
  from public.certificate_templates
  where id = version_row.template_id and is_active;
  select full_name into student_name
  from public.students
  where id = p_student and status = 'active';
  if template_row.id is null or student_name is null then
    raise exception using errcode = 'P0001', message = 'certificate_subject_unavailable';
  end if;

  serial := 'NAW-' || extract(year from current_date)::integer || '-'
    || lpad(nextval('public.certificate_serial_seq')::text, 8, '0');
  code := encode(extensions.gen_random_bytes(24), 'hex');

  insert into public.certificates(
    template_version_id, student_id, kind, serial_no, verify_code, locale,
    payload_snapshot, template_snapshot, idempotency_key, issued_by
  ) values (
    version_row.id, p_student, template_row.kind, serial, code, p_locale,
    jsonb_build_object(
      'student_name', student_name,
      'achievement', btrim(p_achievement),
      'issued_on', current_date,
      'serial_no', serial
    ),
    to_jsonb(version_row) - array['created_by', 'published_by'],
    p_idempotency_key,
    (select auth.uid())
  ) returning id into result;

  perform private.notify_session_parties(
    p_student,
    'certificate_issued',
    jsonb_build_object('certificate_id', result, 'kind', template_row.kind)
  );
  return result;
end;
$$;

create or replace function public.verify_certificate(p_code text)
returns table(
  valid boolean,
  status text,
  student_name text,
  certificate_kind text,
  issued_on date,
  serial_no text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  headers jsonb;
  requester text;
  requester_digest text;
  bucket timestamptz;
  current_attempts integer;
  row record;
begin
  if p_code is null or char_length(p_code) not between 32 and 128
    or p_code !~ '^[a-zA-Z0-9_-]+$' then
    return query select false, 'not_found'::text, null::text, null::text, null::date, null::text;
    return;
  end if;

  begin
    headers := coalesce(current_setting('request.headers', true), '{}')::jsonb;
  exception when others then
    headers := '{}'::jsonb;
  end;
  requester := coalesce(
    headers ->> 'cf-connecting-ip',
    headers ->> 'x-real-ip',
    split_part(coalesce(headers ->> 'x-forwarded-for', 'unknown'), ',', 1),
    'unknown'
  ) || ':' || coalesce(headers ->> 'user-agent', 'unknown');
  requester_digest := encode(extensions.digest(requester, 'sha256'), 'hex');
  bucket := date_bin(
    interval '10 minutes',
    clock_timestamp(),
    timestamptz '2020-01-01 00:00:00+00'
  );

  insert into private.certificate_verification_limits(requester_hash, window_start, attempts)
  values (requester_digest, bucket, 1)
  on conflict (requester_hash, window_start) do update
  set attempts = private.certificate_verification_limits.attempts + 1
  returning attempts into current_attempts;
  if current_attempts > 15 then
    raise exception using errcode = 'P0001', message = 'certificate_verification_rate_limited';
  end if;

  select certificate.serial_no, certificate.kind, certificate.issued_at,
    certificate.revoked_at, student.full_name
  into row
  from public.certificates as certificate
  join public.students as student on student.id = certificate.student_id
  where certificate.verify_code = p_code;

  if row.serial_no is null then
    return query select false, 'not_found'::text, null::text, null::text, null::date, null::text;
    return;
  end if;

  return query select
    row.revoked_at is null,
    case when row.revoked_at is null then 'valid' else 'revoked' end,
    split_part(row.full_name, ' ', 1)
      || case
        when position(' ' in row.full_name) > 0
          then ' ' || left(regexp_replace(row.full_name, '^.*\s', '', 'g'), 1) || '.'
        else ''
      end,
    row.kind::text,
    row.issued_at::date,
    row.serial_no::text;
end;
$$;

create or replace function public.dispatch_intervention_notifications(
  p_at timestamptz default pg_catalog.now()
)
returns integer
language plpgsql
security definer
set search_path = ''
set statement_timeout = '30s'
as $$
declare
  candidate record;
  recipient record;
  stored_prefs jsonb;
  created_notification_id uuid;
  in_app_enabled boolean;
  email_enabled boolean;
  recipients integer;
  dispatched integer := 0;
  run_id bigint;
begin
  if current_user not in ('postgres', 'service_role') then
    raise exception using errcode = '42501', message = 'intervention_dispatcher_forbidden';
  end if;
  if p_at is null then
    raise exception using errcode = '22023', message = 'intervention_dispatch_time_invalid';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext('public.dispatch_intervention_notifications')
  );
  insert into public.job_runs(job_name, details)
  values ('dispatch_intervention_notifications', jsonb_build_object('dispatched_at', p_at))
  returning id into run_id;

  for candidate in
    select intervention_case.*,
      intervention_rule.rule_type,
      case
        when intervention_case.escalated_at is not null
          then 'escalated:' || intervention_case.priority::text
        else 'opened'
      end as event_key
    from public.intervention_cases as intervention_case
    join public.intervention_rules as intervention_rule
      on intervention_rule.id = intervention_case.rule_id
    where intervention_case.status in ('open', 'acknowledged')
      and not exists (
        select 1
        from public.intervention_notification_events as event
        where event.case_id = intervention_case.id
          and event.event_key = case
            when intervention_case.escalated_at is not null
              then 'escalated:' || intervention_case.priority::text
            else 'opened'
          end
      )
    order by intervention_case.priority desc,
      intervention_case.first_detected_at,
      intervention_case.id
    for update of intervention_case skip locked
  loop
    recipients := 0;
    for recipient in
      select profile.id, profile.preferred_locale
      from public.profiles as profile
      where profile.role = 'admin' and profile.is_active
      order by profile.id
    loop
      select preference.prefs into stored_prefs
      from public.notification_prefs as preference
      where preference.user_id = recipient.id;

      in_app_enabled := private.notification_pref_enabled(stored_prefs, 'in_app', true)
        and private.notification_pref_enabled(stored_prefs, 'intervention', true);
      email_enabled := private.notification_pref_enabled(
        stored_prefs,
        'intervention_email',
        true
      );
      if not in_app_enabled and not email_enabled then
        continue;
      end if;

      insert into public.notifications(user_id, type, source_key, in_app_visible, payload)
      values (
        recipient.id,
        case
          when candidate.event_key = 'opened' then 'intervention_opened'
          else 'intervention_escalated'
        end,
        candidate.id::text || ':' || candidate.event_key,
        in_app_enabled,
        jsonb_build_object(
          'case_id', candidate.id,
          'rule_type', candidate.rule_type,
          'priority', candidate.priority,
          'reason_code', candidate.reason_code,
          'action_href', '/' || recipient.preferred_locale
            || '/admin/control-center?caseStatus=' || candidate.status
        )
      )
      on conflict (user_id, type, source_key) where source_key is not null
      do update set payload = excluded.payload
      returning id into created_notification_id;

      if email_enabled then
        insert into public.notification_outbox(notification_id, channel)
        values (created_notification_id, 'email')
        on conflict (notification_id, channel) do nothing;
      end if;
      recipients := recipients + 1;
    end loop;

    if recipients > 0 then
      insert into public.intervention_notification_events(
        case_id,
        event_key,
        priority,
        recipient_count
      ) values (candidate.id, candidate.event_key, candidate.priority, recipients)
      on conflict (case_id, event_key) do nothing;
      dispatched := dispatched + 1;
    end if;
  end loop;

  update public.job_runs
  set finished_at = pg_catalog.clock_timestamp(),
    result = 'succeeded',
    affected_rows = dispatched,
    details = details || jsonb_build_object('dispatched_cases', dispatched)
  where id = run_id;
  return dispatched;
end;
$$;

insert into supabase_migrations.schema_migrations(version, statements, name) values ('20261023170000', array[]::text[], 'fix_function_schema_lint') on conflict (version) do nothing;
-- END MIGRATION 20261023170000_fix_function_schema_lint.sql
-- BEGIN MIGRATION 20261023190000_fix_certificate_crypto_search_path.sql
-- Certificate RPCs use pgcrypto primitives while retaining a fixed, trusted search path.
alter function public.issue_certificate(uuid, uuid, text, text, text)
  set search_path = pg_catalog, extensions;

alter function public.verify_certificate(text)
  set search_path = pg_catalog, extensions;

insert into supabase_migrations.schema_migrations(version, statements, name) values ('20261023190000', array[]::text[], 'fix_certificate_crypto_search_path') on conflict (version) do nothing;
-- END MIGRATION 20261023190000_fix_certificate_crypto_search_path.sql
-- BEGIN MIGRATION 20261023193000_fix_intervention_notification_dispatch.sql
create or replace function public.dispatch_intervention_notifications(
  p_at timestamptz default pg_catalog.now()
)
returns integer
language plpgsql
security definer
set search_path = ''
set statement_timeout = '30s'
as $$
declare
  candidate record;
  recipient record;
  stored_prefs jsonb;
  queued_notification_id uuid;
  in_app_enabled boolean;
  email_enabled boolean;
  recipients integer;
  dispatched integer := 0;
  run_id bigint;
begin
  if current_user not in ('postgres', 'service_role') then
    raise exception using errcode = '42501', message = 'intervention_dispatcher_forbidden';
  end if;
  if p_at is null then
    raise exception using errcode = '22023', message = 'intervention_dispatch_time_invalid';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('public.dispatch_intervention_notifications'));
  insert into public.job_runs(job_name, details)
  values ('dispatch_intervention_notifications', jsonb_build_object('dispatched_at', p_at))
  returning id into run_id;

  for candidate in
    select intervention_case.*,
      intervention_rule.rule_type,
      case
        when intervention_case.escalated_at is not null
          then 'escalated:' || intervention_case.priority::text
        else 'opened'
      end as event_key
    from public.intervention_cases as intervention_case
    join public.intervention_rules as intervention_rule on intervention_rule.id = intervention_case.rule_id
    where intervention_case.status in ('open', 'acknowledged')
      and not exists (
        select 1 from public.intervention_notification_events as event
        where event.case_id = intervention_case.id
          and event.event_key = case
            when intervention_case.escalated_at is not null
              then 'escalated:' || intervention_case.priority::text
            else 'opened'
          end
      )
    order by intervention_case.priority desc, intervention_case.first_detected_at, intervention_case.id
    for update of intervention_case skip locked
  loop
    recipients := 0;
    for recipient in
      select profile.id, profile.preferred_locale
      from public.profiles as profile
      where profile.role = 'admin' and profile.is_active
      order by profile.id
    loop
      select preference.prefs into stored_prefs
      from public.notification_prefs as preference
      where preference.user_id = recipient.id;

      in_app_enabled := private.notification_pref_enabled(stored_prefs, 'in_app', true)
        and private.notification_pref_enabled(stored_prefs, 'intervention', true);
      email_enabled := private.notification_pref_enabled(stored_prefs, 'intervention_email', true);

      if not in_app_enabled and not email_enabled then
        continue;
      end if;

      insert into public.notifications (user_id, type, source_key, in_app_visible, payload)
      values (
        recipient.id,
        case when candidate.event_key = 'opened' then 'intervention_opened' else 'intervention_escalated' end,
        candidate.id::text || ':' || candidate.event_key,
        in_app_enabled,
        jsonb_build_object(
          'case_id', candidate.id,
          'rule_type', candidate.rule_type,
          'priority', candidate.priority,
          'reason_code', candidate.reason_code,
          'action_href', '/' || recipient.preferred_locale || '/admin/control-center?caseStatus=' || candidate.status
        )
      )
      on conflict (user_id, type, source_key) where source_key is not null
      do update set payload = excluded.payload
      returning id into queued_notification_id;

      if email_enabled then
        insert into public.notification_outbox (notification_id, channel)
        values (queued_notification_id, 'email')
        on conflict (notification_id, channel) do nothing;
      end if;
      recipients := recipients + 1;
    end loop;

    if recipients > 0 then
      insert into public.intervention_notification_events (case_id, event_key, priority, recipient_count)
      values (candidate.id, candidate.event_key, candidate.priority, recipients)
      on conflict (case_id, event_key) do nothing;
      dispatched := dispatched + 1;
    end if;
  end loop;

  update public.job_runs
  set finished_at = pg_catalog.clock_timestamp(), result = 'succeeded',
    affected_rows = dispatched,
    details = details || jsonb_build_object('dispatched_cases', dispatched)
  where id = run_id;
  return dispatched;
end;
$$;

insert into supabase_migrations.schema_migrations(version, statements, name) values ('20261023193000', array[]::text[], 'fix_intervention_notification_dispatch') on conflict (version) do nothing;
-- END MIGRATION 20261023193000_fix_intervention_notification_dispatch.sql
-- BEGIN MIGRATION 20261024050000_set_official_academy_logo.sql
update public.app_settings
set value = jsonb_set(
  value,
  '{logo_url}',
  to_jsonb('/images/brand/noor-alwahy-emblem.png'::text),
  true
)
where key = 'academy_profile';

insert into supabase_migrations.schema_migrations(version, statements, name) values ('20261024050000', array[]::text[], 'set_official_academy_logo') on conflict (version) do nothing;
-- END MIGRATION 20261024050000_set_official_academy_logo.sql
