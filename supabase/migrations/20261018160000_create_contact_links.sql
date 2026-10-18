create table public.contact_links (
  id uuid primary key default gen_random_uuid(),
  type text not null check (
    type in ('whatsapp', 'phone', 'email', 'facebook', 'instagram', 'telegram', 'youtube', 'tiktok', 'other')
  ),
  label_ar text not null check (char_length(btrim(label_ar)) between 1 and 100),
  label_en text check (label_en is null or char_length(btrim(label_en)) between 1 and 100),
  url text not null check (
    char_length(url) <= 2048
    and url ~* '^(https://|mailto:|tel:)'
  ),
  sort_order integer not null default 0 check (sort_order >= 0),
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index contact_links_public_order_idx
on public.contact_links (sort_order, created_at, id)
where is_visible;

create trigger contact_links_set_updated_at
before update on public.contact_links
for each row execute function public.set_updated_at();

create trigger contact_links_audit
after insert or update or delete on public.contact_links
for each row execute function public.audit_row();

alter table public.contact_links enable row level security;

revoke all on table public.contact_links from public, anon, authenticated;
grant select on table public.contact_links to anon, authenticated;
grant insert, update, delete on table public.contact_links to authenticated;

create policy contact_links_read_visible
on public.contact_links
for select
to anon, authenticated
using (is_visible);

create policy contact_links_admin_read_all
on public.contact_links
for select
to authenticated
using ((select public.is_admin()));

create policy contact_links_admin_insert
on public.contact_links
for insert
to authenticated
with check ((select public.is_admin()));

create policy contact_links_admin_update
on public.contact_links
for update
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

create policy contact_links_admin_delete
on public.contact_links
for delete
to authenticated
using ((select public.is_admin()));
