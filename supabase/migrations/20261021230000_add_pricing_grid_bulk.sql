create or replace function public.bulk_append_package_prices(
  p_source_country char(2),
  p_target_country char(2),
  p_multiplier numeric,
  p_round_to numeric,
  p_valid_from timestamptz,
  p_package_ids uuid[] default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  target_currency char(3);
  inserted_count integer;
begin
  if actor_id is null or not public.is_admin() then
    raise exception using errcode = '42501', message = 'admin_mfa_required';
  end if;
  if upper(btrim(p_source_country)) !~ '^[A-Z]{2}$'
    or upper(btrim(p_target_country)) !~ '^[A-Z]{2}$'
    or p_multiplier is null or p_multiplier <= 0 or p_multiplier > 1000
    or p_round_to is null or p_round_to < 0.01 or p_round_to > 10000
    or p_valid_from is null
    or p_valid_from < pg_catalog.clock_timestamp() - interval '5 minutes'
    or p_valid_from > pg_catalog.clock_timestamp() + interval '5 years'
    or (p_package_ids is not null and cardinality(p_package_ids) = 0) then
    raise exception using errcode = '22023', message = 'pricing_bulk_input_invalid';
  end if;
  if p_package_ids is not null and cardinality(p_package_ids) <> (
    select count(distinct id) from unnest(p_package_ids) as id
  ) then
    raise exception using errcode = '22023', message = 'pricing_bulk_duplicate_package';
  end if;

  select currency into target_currency
  from public.countries
  where code = upper(btrim(p_target_country)) and is_enabled;
  if target_currency is null then
    raise exception using errcode = 'P0002', message = 'pricing_target_country_unavailable';
  end if;

  insert into public.package_prices(
    package_id, country_code, currency, amount, is_active, valid_from, created_by
  )
  select
    package.id,
    upper(btrim(p_target_country)),
    target_currency,
    (round((source_price.amount * p_multiplier) / p_round_to) * p_round_to)::numeric(12,2),
    true,
    p_valid_from,
    actor_id
  from public.packages as package
  join lateral (
    select price.amount
    from public.package_prices as price
    where price.package_id = package.id
      and price.country_code = upper(btrim(p_source_country))
      and price.valid_from <= pg_catalog.clock_timestamp()
      and price.is_active
    order by price.valid_from desc
    limit 1
  ) as source_price on true
  where package.is_active
    and (p_package_ids is null or package.id = any(p_package_ids));

  get diagnostics inserted_count = row_count;
  if inserted_count = 0 then
    raise exception using errcode = 'P0002', message = 'pricing_source_prices_not_found';
  end if;
  return inserted_count;
exception
  when unique_violation then
    raise exception using errcode = '23505', message = 'pricing_schedule_conflict';
end;
$$;

revoke execute on function public.bulk_append_package_prices(character, character, numeric, numeric, timestamptz, uuid[])
from public, anon;
grant execute on function public.bulk_append_package_prices(character, character, numeric, numeric, timestamptz, uuid[])
to authenticated, service_role;
