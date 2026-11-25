alter table public.certificates
  alter column template_version_id drop not null,
  alter column payload_snapshot set default '{}'::jsonb,
  alter column template_snapshot set default '{}'::jsonb,
  add column source text not null default 'generated'
    check (source in ('generated','uploaded')),
  add column title text
    check (title is null or char_length(btrim(title)) between 2 and 180),
  add column original_file_name text
    check (original_file_name is null or char_length(btrim(original_file_name)) between 1 and 180),
  add constraint certificates_source_payload_check check (
    (source = 'generated' and template_version_id is not null)
    or
    (source = 'uploaded' and template_version_id is null and title is not null
      and pdf_path ~ '^students/[0-9a-f-]{36}/[0-9a-f-]{36}\.pdf$'
      and pdf_sha256 ~ '^[a-f0-9]{64}$')
  );

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('student-certificates','student-certificates',false,10485760,array['application/pdf'])
on conflict (id) do update set
  public=false,
  file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types;

create policy student_certificates_admin_read on storage.objects for select to authenticated
using (bucket_id='student-certificates' and (select public.is_admin()));
create policy student_certificates_admin_insert on storage.objects for insert to authenticated
with check (bucket_id='student-certificates' and (select public.is_admin()));
create policy student_certificates_admin_delete on storage.objects for delete to authenticated
using (bucket_id='student-certificates' and (select public.is_admin()));

create or replace function private.guard_certificate_update()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.id is distinct from old.id or new.template_version_id is distinct from old.template_version_id
    or new.student_id is distinct from old.student_id or new.kind is distinct from old.kind
    or new.serial_no is distinct from old.serial_no or new.verify_code is distinct from old.verify_code
    or new.locale is distinct from old.locale or new.payload_snapshot is distinct from old.payload_snapshot
    or new.template_snapshot is distinct from old.template_snapshot or new.idempotency_key is distinct from old.idempotency_key
    or new.issued_by is distinct from old.issued_by or new.issued_at is distinct from old.issued_at
    or new.source is distinct from old.source or new.title is distinct from old.title
    or new.original_file_name is distinct from old.original_file_name
    or new.pdf_sha256 is distinct from old.pdf_sha256 or new.pdf_path is distinct from old.pdf_path then
    raise exception using errcode='P0001',message='issued_certificate_immutable';
  end if;
  return new;
end;
$$;
revoke execute on function private.guard_certificate_update() from public,anon,authenticated,service_role;

create or replace function public.issue_uploaded_certificate(
  p_student uuid,
  p_title text,
  p_pdf_path text,
  p_pdf_sha256 text,
  p_original_file_name text,
  p_issued_on date default current_date
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare result uuid; serial text; code text; student_name text;
begin
  if not public.is_admin() then
    raise exception using errcode='42501',message='admin_mfa_required';
  end if;
  if char_length(btrim(p_title)) not between 2 and 180
    or p_pdf_path !~ ('^students/'||p_student::text||'/[0-9a-f-]{36}\.pdf$')
    or p_pdf_sha256 !~ '^[a-f0-9]{64}$'
    or char_length(btrim(p_original_file_name)) not between 1 and 180
    or p_issued_on > current_date then
    raise exception using errcode='22023',message='uploaded_certificate_invalid';
  end if;
  select full_name into student_name from public.students
  where id=p_student and status <> 'archived';
  if student_name is null then
    raise exception using errcode='P0001',message='certificate_subject_unavailable';
  end if;
  serial := 'NAW-'||extract(year from p_issued_on)::integer||'-'||lpad(nextval('public.certificate_serial_seq')::text,8,'0');
  code := encode(gen_random_bytes(24),'hex');
  insert into public.certificates(
    template_version_id,student_id,kind,serial_no,verify_code,locale,
    payload_snapshot,template_snapshot,idempotency_key,issued_by,issued_at,
    pdf_path,pdf_sha256,source,title,original_file_name
  ) values (
    null,p_student,'other',serial,code,'ar',
    jsonb_build_object('student_name',student_name,'achievement',btrim(p_title),'issued_on',p_issued_on,'serial_no',serial),
    '{}'::jsonb,'upload:'||p_pdf_path,(select auth.uid()),p_issued_on::timestamptz,
    p_pdf_path,p_pdf_sha256,'uploaded',btrim(p_title),btrim(p_original_file_name)
  ) returning id into result;
  perform private.notify_session_parties(p_student,'certificate_issued',jsonb_build_object('certificate_id',result,'kind','other'));
  return result;
end;
$$;
revoke execute on function public.issue_uploaded_certificate(uuid,text,text,text,text,date) from public,anon;
grant execute on function public.issue_uploaded_certificate(uuid,text,text,text,text,date) to authenticated,service_role;
