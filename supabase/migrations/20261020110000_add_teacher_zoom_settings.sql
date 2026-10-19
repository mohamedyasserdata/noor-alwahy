create table public.teacher_zoom_settings (
  teacher_id uuid primary key references public.teachers(id) on delete cascade,
  join_url text not null check (
    char_length(join_url) between 12 and 2048
    and join_url ~* '^https://(([a-z0-9-]+\.)*zoom\.us|zoom\.com|([a-z0-9-]+\.)*zoomgov\.com)(/|$)'
  ),
  meeting_id text check (meeting_id is null or char_length(btrim(meeting_id)) between 1 and 100),
  passcode text check (passcode is null or char_length(passcode) between 1 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger teacher_zoom_settings_set_updated_at before update on public.teacher_zoom_settings
for each row execute function public.set_updated_at();

create or replace function public.audit_teacher_zoom_settings()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.audit_logs(user_id,action,table_name,record_id,before,after,ip)
  values (
    (select auth.uid()), tg_op, 'teacher_zoom_settings', new.teacher_id::text,
    case when tg_op = 'UPDATE' then jsonb_build_object('configured', old.join_url is not null) end,
    jsonb_build_object('configured', new.join_url is not null), inet_client_addr()
  );
  return new;
end;
$$;
revoke execute on function public.audit_teacher_zoom_settings() from public, anon, authenticated, service_role;
create trigger teacher_zoom_settings_audit after insert or update on public.teacher_zoom_settings
for each row execute function public.audit_teacher_zoom_settings();

alter table public.teacher_zoom_settings enable row level security;
revoke all on public.teacher_zoom_settings from public, anon, authenticated;
grant select, insert, update on public.teacher_zoom_settings to authenticated;
grant select, insert, update, delete on public.teacher_zoom_settings to service_role;

create policy teacher_zoom_settings_admin_read on public.teacher_zoom_settings for select to authenticated
using ((select public.is_admin()));
create policy teacher_zoom_settings_admin_update on public.teacher_zoom_settings for update to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));
create policy teacher_zoom_settings_teacher_read on public.teacher_zoom_settings for select to authenticated
using (teacher_id = (select private.current_teacher_id()));
create policy teacher_zoom_settings_teacher_insert on public.teacher_zoom_settings for insert to authenticated
with check (teacher_id = (select private.current_teacher_id()));
create policy teacher_zoom_settings_teacher_update on public.teacher_zoom_settings for update to authenticated
using (teacher_id = (select private.current_teacher_id()))
with check (teacher_id = (select private.current_teacher_id()));
