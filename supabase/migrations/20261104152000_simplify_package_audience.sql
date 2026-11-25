alter table public.packages drop constraint if exists packages_audience_check;
alter table public.packages add constraint packages_audience_check
check (audience in ('all','child','adult','women'));

update public.packages set audience='all' where audience is null;
