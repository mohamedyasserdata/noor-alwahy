create or replace function public.get_public_package_catalog(
  p_country char(2),
  p_at timestamptz default now()
)
returns table(
  package_id uuid,
  slug text,
  track_name_ar text,
  track_name_en text,
  name_ar text,
  name_en text,
  description_ar text,
  description_en text,
  audience text,
  teacher_gender public.gender_t,
  sessions_per_week smallint,
  duration_min integer,
  billing_period public.billing_period,
  features jsonb,
  amount numeric(12,2),
  currency char(3),
  country_code char(2)
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    package.id,
    package.slug,
    track.name_ar,
    track.name_en,
    package.name_ar,
    package.name_en,
    package.description_ar,
    package.description_en,
    package.audience,
    package.teacher_gender,
    package.sessions_per_week,
    package.duration_min,
    package.billing_period,
    package.features,
    price.amount,
    price.currency,
    price.country_code
  from public.packages as package
  left join public.tracks as track on track.id = package.track_id
  cross join lateral public.resolve_price(package.id, upper(btrim(p_country)), p_at) as price
  where package.is_published and package.is_active
  order by package.sort_order, package.id
$$;

revoke execute on function public.get_public_package_catalog(char, timestamptz) from public;
grant execute on function public.get_public_package_catalog(char, timestamptz)
to anon, authenticated, service_role;
