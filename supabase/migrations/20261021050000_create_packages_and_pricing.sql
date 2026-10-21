create or replace function private.is_valid_package_policy(candidate jsonb)
returns boolean
language plpgsql
immutable
strict
set search_path = ''
as $$
declare
  numeric_key text;
begin
  if jsonb_typeof(candidate) <> 'object'
    or not candidate ?& array[
      'cancel_notice_hours',
      'max_makeups_per_period',
      'makeup_valid_days',
      'late_tolerance_min',
      'student_no_show_consumes_credit',
      'student_no_show_pays_teacher',
      'partial_refund_pct',
      'max_pause_days',
      'trial'
    ] then
    return false;
  end if;

  foreach numeric_key in array array[
    'cancel_notice_hours',
    'max_makeups_per_period',
    'makeup_valid_days',
    'late_tolerance_min',
    'partial_refund_pct',
    'max_pause_days'
  ] loop
    if jsonb_typeof(candidate -> numeric_key) <> 'number'
      or (candidate ->> numeric_key)::numeric < 0 then
      return false;
    end if;
  end loop;

  if (candidate ->> 'partial_refund_pct')::numeric > 100
    or jsonb_typeof(candidate -> 'student_no_show_consumes_credit') <> 'boolean'
    or jsonb_typeof(candidate -> 'student_no_show_pays_teacher') <> 'boolean'
    or jsonb_typeof(candidate -> 'trial') <> 'object'
    or jsonb_typeof(candidate #> '{trial,enabled}') <> 'boolean'
    or jsonb_typeof(candidate #> '{trial,price_pct}') <> 'number'
    or (candidate #>> '{trial,price_pct}')::numeric not between 0 and 100 then
    return false;
  end if;

  return true;
exception
  when invalid_text_representation or numeric_value_out_of_range then
    return false;
end;
$$;

revoke execute on function private.is_valid_package_policy(jsonb) from public, anon, authenticated, service_role;

create table public.countries (
  code char(2) primary key,
  name_ar text not null check (char_length(btrim(name_ar)) between 2 and 120),
  name_en text check (name_en is null or char_length(btrim(name_en)) between 2 and 120),
  currency char(3) not null,
  default_timezone text check (
    default_timezone is null or char_length(btrim(default_timezone)) between 1 and 100
  ),
  is_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint countries_code_iso check (code = upper(code) and btrim(code) ~ '^[A-Z]{2}$'),
  constraint countries_currency_iso check (
    currency = upper(currency) and btrim(currency) ~ '^[A-Z]{3}$'
  )
);

create table public.packages (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null check (
    slug = lower(slug)
    and slug ~ '^[a-z0-9][a-z0-9-]{1,78}[a-z0-9]$'
  ),
  track_id uuid references public.tracks(id) on delete restrict,
  name_ar text not null check (char_length(btrim(name_ar)) between 2 and 160),
  name_en text check (name_en is null or char_length(btrim(name_en)) between 2 and 160),
  description_ar text check (
    description_ar is null or char_length(btrim(description_ar)) between 2 and 4000
  ),
  description_en text check (
    description_en is null or char_length(btrim(description_en)) between 2 and 4000
  ),
  audience text check (audience in ('child', 'adult', 'women')),
  teacher_gender public.gender_t,
  sessions_per_week smallint not null check (sessions_per_week between 1 and 14),
  duration_min integer not null default 30 check (duration_min between 10 and 120),
  billing_period public.billing_period not null default 'monthly',
  features jsonb not null default '[]'::jsonb check (jsonb_typeof(features) = 'array'),
  policy jsonb not null default jsonb_build_object(
    'cancel_notice_hours', 12,
    'max_makeups_per_period', 2,
    'makeup_valid_days', 30,
    'late_tolerance_min', 10,
    'student_no_show_consumes_credit', true,
    'student_no_show_pays_teacher', true,
    'partial_refund_pct', 0,
    'max_pause_days', 30,
    'trial', jsonb_build_object('enabled', true, 'price_pct', 0)
  ) check (private.is_valid_package_policy(policy)),
  is_published boolean not null default false,
  is_active boolean not null default true,
  sort_order integer not null default 0 check (sort_order >= 0),
  created_by uuid references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.package_prices (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references public.packages(id) on delete restrict,
  country_code char(2) not null references public.countries(code) on delete restrict,
  currency char(3) not null,
  amount numeric(12,2) not null check (amount >= 0),
  min_amount numeric(12,2) check (min_amount is null or min_amount >= 0),
  max_amount numeric(12,2) check (max_amount is null or max_amount >= 0),
  is_active boolean not null default true,
  valid_from timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint package_prices_currency_iso check (
    currency = upper(currency) and btrim(currency) ~ '^[A-Z]{3}$'
  ),
  constraint package_prices_minimum check (min_amount is null or amount >= min_amount),
  constraint package_prices_maximum check (max_amount is null or amount <= max_amount),
  constraint package_prices_bounds check (
    min_amount is null or max_amount is null or min_amount <= max_amount
  ),
  unique (package_id, country_code, valid_from)
);

create table public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null check (code ~ '^[A-Z0-9][A-Z0-9_-]{2,39}$'),
  kind text not null check (kind in ('percent', 'fixed', 'sibling', 'annual', 'seasonal')),
  value numeric(12,2) not null check (value > 0),
  currency char(3),
  starts_at timestamptz,
  ends_at timestamptz,
  max_redemptions integer check (max_redemptions is null or max_redemptions > 0),
  redeemed_count integer not null default 0 check (redeemed_count >= 0),
  package_id uuid references public.packages(id) on delete restrict,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint coupons_code_unique unique (code),
  constraint coupons_period_valid check (
    starts_at is null or ends_at is null or ends_at > starts_at
  ),
  constraint coupons_capacity_valid check (
    max_redemptions is null or redeemed_count <= max_redemptions
  ),
  constraint coupons_value_shape check (
    (kind = 'fixed' and currency is not null)
    or (
      kind in ('percent', 'sibling', 'annual', 'seasonal')
      and currency is null
      and value <= 100
    )
  ),
  constraint coupons_currency_iso check (
    currency is null or (currency = upper(currency) and btrim(currency) ~ '^[A-Z]{3}$')
  )
);

create index packages_public_order_idx
on public.packages (sort_order, id)
where is_published and is_active;
create index packages_track_idx on public.packages (track_id, is_active, sort_order);
create index package_prices_resolution_idx
on public.package_prices (package_id, country_code, valid_from desc);
create index coupons_active_period_idx on public.coupons (is_active, starts_at, ends_at);

create trigger countries_set_updated_at
before update on public.countries
for each row execute function public.set_updated_at();
create trigger packages_set_updated_at
before update on public.packages
for each row execute function public.set_updated_at();
create trigger package_prices_set_updated_at
before update on public.package_prices
for each row execute function public.set_updated_at();
create trigger coupons_set_updated_at
before update on public.coupons
for each row execute function public.set_updated_at();

create or replace function private.prepare_country()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.code := upper(btrim(new.code));
  new.currency := upper(btrim(new.currency));
  new.name_ar := btrim(new.name_ar);
  new.name_en := nullif(btrim(new.name_en), '');
  new.default_timezone := nullif(btrim(new.default_timezone), '');
  return new;
end;
$$;

revoke execute on function private.prepare_country() from public, anon, authenticated, service_role;
create trigger countries_prepare
before insert or update on public.countries
for each row execute function private.prepare_country();

create or replace function private.package_has_active_default_price(
  target_package_id uuid,
  effective_at timestamptz default now()
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select price.is_active
    from public.package_prices as price
    join public.countries as country on country.code = price.country_code
    where price.package_id = target_package_id
      and price.country_code = 'ZZ'
      and price.valid_from <= effective_at
      and country.is_enabled
    order by price.valid_from desc
    limit 1
  ), false)
$$;

revoke execute on function private.package_has_active_default_price(uuid, timestamptz)
from public, anon, authenticated, service_role;

create or replace function private.validate_package_publication()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.slug := lower(btrim(new.slug));
  new.name_ar := btrim(new.name_ar);
  new.name_en := nullif(btrim(new.name_en), '');
  new.description_ar := nullif(btrim(new.description_ar), '');
  new.description_en := nullif(btrim(new.description_en), '');

  if new.is_published
    and not private.package_has_active_default_price(new.id, pg_catalog.clock_timestamp()) then
    raise exception using errcode = 'P0001', message = 'package_default_price_required';
  end if;
  return new;
end;
$$;

revoke execute on function private.validate_package_publication()
from public, anon, authenticated, service_role;
create trigger packages_validate_publication
before insert or update on public.packages
for each row execute function private.validate_package_publication();

create or replace function private.prepare_package_price()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  expected_currency char(3);
begin
  new.country_code := upper(btrim(new.country_code));
  new.currency := upper(btrim(new.currency));

  select country.currency into expected_currency
  from public.countries as country
  where country.code = new.country_code;

  if expected_currency is null then
    raise exception using errcode = '23503', message = 'price_country_unknown';
  end if;
  if new.currency is distinct from expected_currency then
    raise exception using errcode = 'P0001', message = 'price_currency_mismatch';
  end if;
  return new;
end;
$$;

revoke execute on function private.prepare_package_price()
from public, anon, authenticated, service_role;
create trigger package_prices_prepare
before insert on public.package_prices
for each row execute function private.prepare_package_price();

create or replace function private.reject_package_price_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception using errcode = 'P0001', message = 'package_price_immutable';
end;
$$;

revoke execute on function private.reject_package_price_mutation()
from public, anon, authenticated, service_role;
create trigger package_prices_immutable
before update or delete on public.package_prices
for each row execute function private.reject_package_price_mutation();

create or replace function private.prepare_coupon()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.code := upper(btrim(new.code));
  new.currency := case when new.currency is null then null else upper(btrim(new.currency)) end;
  return new;
end;
$$;

revoke execute on function private.prepare_coupon() from public, anon, authenticated, service_role;
create trigger coupons_prepare
before insert or update on public.coupons
for each row execute function private.prepare_coupon();

create or replace function private.audit_package_price_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  previous_price jsonb;
begin
  select to_jsonb(price) into previous_price
  from public.package_prices as price
  where price.package_id = new.package_id
    and price.country_code = new.country_code
    and price.id <> new.id
    and price.valid_from < new.valid_from
  order by price.valid_from desc
  limit 1;

  insert into public.audit_logs(user_id, action, table_name, record_id, before, after, ip)
  values (
    (select auth.uid()),
    'INSERT',
    'package_prices',
    new.id::text,
    previous_price,
    to_jsonb(new),
    inet_client_addr()
  );
  return new;
end;
$$;

revoke execute on function private.audit_package_price_insert()
from public, anon, authenticated, service_role;

-- TODO(OWNER): confirm USD as the fallback currency for the synthetic ZZ country.
insert into public.countries(code, name_ar, name_en, currency, default_timezone)
values
  ('EG', 'مصر', 'Egypt', 'EGP', 'Africa/Cairo'),
  ('SA', 'السعودية', 'Saudi Arabia', 'SAR', 'Asia/Riyadh'),
  ('AE', 'الإمارات', 'United Arab Emirates', 'AED', 'Asia/Dubai'),
  ('KW', 'الكويت', 'Kuwait', 'KWD', 'Asia/Kuwait'),
  ('QA', 'قطر', 'Qatar', 'QAR', 'Asia/Qatar'),
  ('BH', 'البحرين', 'Bahrain', 'BHD', 'Asia/Bahrain'),
  ('OM', 'عُمان', 'Oman', 'OMR', 'Asia/Muscat'),
  ('IQ', 'العراق', 'Iraq', 'IQD', 'Asia/Baghdad'),
  ('JO', 'الأردن', 'Jordan', 'JOD', 'Asia/Amman'),
  ('LB', 'لبنان', 'Lebanon', 'LBP', 'Asia/Beirut'),
  ('PS', 'فلسطين', 'Palestine', 'ILS', 'Asia/Gaza'),
  ('SY', 'سوريا', 'Syria', 'SYP', 'Asia/Damascus'),
  ('YE', 'اليمن', 'Yemen', 'YER', 'Asia/Aden'),
  ('LY', 'ليبيا', 'Libya', 'LYD', 'Africa/Tripoli'),
  ('TN', 'تونس', 'Tunisia', 'TND', 'Africa/Tunis'),
  ('DZ', 'الجزائر', 'Algeria', 'DZD', 'Africa/Algiers'),
  ('MA', 'المغرب', 'Morocco', 'MAD', 'Africa/Casablanca'),
  ('MR', 'موريتانيا', 'Mauritania', 'MRU', 'Africa/Nouakchott'),
  ('SD', 'السودان', 'Sudan', 'SDG', 'Africa/Khartoum'),
  ('DJ', 'جيبوتي', 'Djibouti', 'DJF', 'Africa/Djibouti'),
  ('SO', 'الصومال', 'Somalia', 'SOS', 'Africa/Mogadishu'),
  ('KM', 'جزر القمر', 'Comoros', 'KMF', 'Indian/Comoro'),
  ('ZZ', 'بقية العالم', 'Rest of world', 'USD', 'UTC');

create trigger countries_audit
after insert or update or delete on public.countries
for each row execute function public.audit_row();
create trigger packages_audit
after insert or update or delete on public.packages
for each row execute function public.audit_row();
create trigger package_prices_audit
after insert on public.package_prices
for each row execute function private.audit_package_price_insert();
create trigger coupons_audit
after insert or update or delete on public.coupons
for each row execute function public.audit_row();

create or replace function public.resolve_price(
  p_package uuid,
  p_country char(2),
  p_at timestamptz default now()
)
returns table(amount numeric(12,2), currency char(3), country_code char(2))
language sql
stable
security definer
set search_path = ''
as $$
  with candidates as (
    select distinct on (price.country_code)
      price.amount,
      price.currency,
      price.country_code,
      price.is_active,
      case when price.country_code = upper(btrim(p_country)) then 0 else 1 end as priority
    from public.package_prices as price
    join public.countries as country
      on country.code = price.country_code and country.is_enabled
    join public.packages as package
      on package.id = price.package_id
    where price.package_id = p_package
      and package.is_published
      and package.is_active
      and private.package_has_active_default_price(p_package, p_at)
      and price.country_code in (upper(btrim(p_country)), 'ZZ')
      and price.valid_from <= p_at
    order by price.country_code, price.valid_from desc
  )
  select candidate.amount, candidate.currency, candidate.country_code
  from candidates as candidate
  where candidate.is_active
  order by candidate.priority
  limit 1
$$;

revoke execute on function public.resolve_price(uuid, char, timestamptz) from public;
grant execute on function public.resolve_price(uuid, char, timestamptz) to anon, authenticated, service_role;

alter table public.countries enable row level security;
alter table public.packages enable row level security;
alter table public.package_prices enable row level security;
alter table public.coupons enable row level security;

revoke all on public.countries from public, anon, authenticated, service_role;
revoke all on public.packages from public, anon, authenticated, service_role;
revoke all on public.package_prices from public, anon, authenticated, service_role;
revoke all on public.coupons from public, anon, authenticated, service_role;

grant select on public.countries to anon, authenticated, service_role;
grant insert, update, delete on public.countries to authenticated, service_role;
grant select on public.packages to anon, authenticated, service_role;
grant insert, update, delete on public.packages to authenticated, service_role;
grant select on public.package_prices to anon, authenticated, service_role;
grant insert on public.package_prices to authenticated, service_role;
grant select, insert, update, delete on public.coupons to authenticated, service_role;

create policy countries_public_read on public.countries
for select to anon, authenticated
using (is_enabled);
create policy countries_admin_all on public.countries
for all to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

create policy packages_public_read on public.packages
for select to anon, authenticated
using (
  is_published
  and is_active
  and exists (
    select 1
    from public.resolve_price(id, 'ZZ', now())
  )
);
create policy packages_admin_all on public.packages
for all to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

create policy package_prices_public_read on public.package_prices
for select to anon, authenticated
using (
  valid_from <= now()
  and exists (
    select 1
    from public.packages as package
    join public.countries as country on country.code = package_prices.country_code
    where package.id = package_prices.package_id
      and package.is_published
      and package.is_active
      and country.is_enabled
  )
);
create policy package_prices_admin_read on public.package_prices
for select to authenticated
using ((select public.is_admin()));
create policy package_prices_admin_insert on public.package_prices
for insert to authenticated
with check ((select public.is_admin()));

create policy coupons_admin_all on public.coupons
for all to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));
