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
