create table public.app_settings (
  key text primary key check (
    char_length(key) between 1 and 100
    and key ~ '^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*$'
  ),
  value jsonb not null check (
    jsonb_typeof(value) = 'object'
    and octet_length(value::text) <= 16384
  ),
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint app_settings_public_shape check (
    (
      key = 'academy_profile'
      and value ?& array['name_ar', 'name_en', 'description_ar', 'description_en', 'logo_url']
      and value - array['name_ar', 'name_en', 'description_ar', 'description_en', 'logo_url'] = '{}'::jsonb
      and jsonb_typeof(value -> 'name_ar') = 'string'
      and jsonb_typeof(value -> 'name_en') = 'string'
      and jsonb_typeof(value -> 'description_ar') = 'string'
      and jsonb_typeof(value -> 'description_en') = 'string'
      and (value -> 'logo_url' = 'null'::jsonb or jsonb_typeof(value -> 'logo_url') = 'string')
      and value ->> 'name_ar' = btrim(value ->> 'name_ar')
      and value ->> 'name_en' = btrim(value ->> 'name_en')
      and value ->> 'description_ar' = btrim(value ->> 'description_ar')
      and value ->> 'description_en' = btrim(value ->> 'description_en')
      and char_length(btrim(value ->> 'name_ar')) between 2 and 120
      and char_length(btrim(value ->> 'name_en')) between 2 and 120
      and char_length(btrim(value ->> 'description_ar')) between 2 and 500
      and char_length(btrim(value ->> 'description_en')) between 2 and 500
      and (
        value ->> 'logo_url' is null
        or (
          char_length(value ->> 'logo_url') between 1 and 2048
          and value ->> 'logo_url' like '/%'
          and value ->> 'logo_url' not like '//%'
          and value ->> 'logo_url' !~ '[^A-Za-z0-9_./-]'
          and not (value ->> 'logo_url' ~ '(^|/)\.\.(/|$)')
        )
      )
    )
    or (
      key = 'support_hours'
      and value ?& array['ar', 'en']
      and value - array['ar', 'en'] = '{}'::jsonb
      and jsonb_typeof(value -> 'ar') = 'string'
      and jsonb_typeof(value -> 'en') = 'string'
      and value ->> 'ar' = btrim(value ->> 'ar')
      and value ->> 'en' = btrim(value ->> 'en')
      and char_length(btrim(value ->> 'ar')) between 2 and 500
      and char_length(btrim(value ->> 'en')) between 2 and 500
    )
    or key not in ('academy_profile', 'support_hours')
  )
);

insert into public.app_settings (key, value)
values
  (
    'academy_profile',
    jsonb_build_object(
      'name_ar', 'أكاديمية نور الوحي',
      'name_en', 'Noor Al-Wahy Academy',
      'description_ar', 'تعليم قرآني منظم بمتابعة آمنة وواضحة.',
      'description_en', 'Structured Quran learning with safe, clear follow-up.',
      'logo_url', null
    )
  ),
  (
    'support_hours',
    jsonb_build_object(
      'ar', 'تكون الاستجابة خلال مواعيد العمل المعلنة للأكاديمية.',
      'en', 'Responses are provided during the academy’s announced working hours.'
    )
  );

create or replace function public.set_app_setting_actor()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_by = auth.uid();
  return new;
end;
$$;

revoke execute on function public.set_app_setting_actor() from public, anon, authenticated;

create trigger app_settings_set_actor
before insert or update on public.app_settings
for each row execute function public.set_app_setting_actor();

create trigger app_settings_set_updated_at
before update on public.app_settings
for each row execute function public.set_updated_at();

create trigger app_settings_audit
after insert or update or delete on public.app_settings
for each row execute function public.audit_row();

alter table public.app_settings enable row level security;

revoke all on table public.app_settings from public, anon, authenticated;
grant select (key, value) on table public.app_settings to anon, authenticated;
grant insert, update, delete on table public.app_settings to authenticated;

create policy app_settings_public_read
on public.app_settings
for select
to anon, authenticated
using (key in ('academy_profile', 'support_hours'));

create policy app_settings_admin_read_all
on public.app_settings
for select
to authenticated
using ((select public.is_admin()));

create policy app_settings_admin_insert
on public.app_settings
for insert
to authenticated
with check ((select public.is_admin()));

create policy app_settings_admin_update
on public.app_settings
for update
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

create policy app_settings_admin_delete
on public.app_settings
for delete
to authenticated
using ((select public.is_admin()));

create or replace function public.update_public_app_settings(
  p_academy_profile jsonb,
  p_support_hours jsonb
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.app_settings
  set value = p_academy_profile
  where key = 'academy_profile';

  if not found then
    raise exception 'academy_profile_missing';
  end if;

  update public.app_settings
  set value = p_support_hours
  where key = 'support_hours';

  if not found then
    raise exception 'support_hours_missing';
  end if;
end;
$$;

revoke execute on function public.update_public_app_settings(jsonb, jsonb) from public, anon;
grant execute on function public.update_public_app_settings(jsonb, jsonb) to authenticated;
