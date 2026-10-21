create or replace function public.save_package(p_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  saved_package_id uuid := coalesce(nullif(p_payload ->> 'package_id', '')::uuid, gen_random_uuid());
  requested_package_id uuid := nullif(p_payload ->> 'package_id', '')::uuid;
  price jsonb;
begin
  if actor_id is null or not (select public.is_admin()) then
    raise exception using errcode = '42501', message = 'admin_mfa_required';
  end if;
  if jsonb_typeof(p_payload) <> 'object'
    or jsonb_typeof(p_payload -> 'prices') <> 'array' then
    raise exception using errcode = '22023', message = 'package_payload_invalid';
  end if;

  if requested_package_id is not null and not exists (
    select 1 from public.packages where id = requested_package_id
  ) then
    raise exception using errcode = 'P0002', message = 'package_not_found';
  end if;

  if requested_package_id is null then
    insert into public.packages(
    id,
    slug,
    track_id,
    name_ar,
    name_en,
    description_ar,
    description_en,
    audience,
    teacher_gender,
    sessions_per_week,
    duration_min,
    billing_period,
    features,
    policy,
    is_published,
    is_active,
    sort_order,
    created_by
  )
  values (
    saved_package_id,
    p_payload ->> 'slug',
    nullif(p_payload ->> 'track_id', '')::uuid,
    p_payload ->> 'name_ar',
    nullif(p_payload ->> 'name_en', ''),
    nullif(p_payload ->> 'description_ar', ''),
    nullif(p_payload ->> 'description_en', ''),
    nullif(p_payload ->> 'audience', ''),
    nullif(p_payload ->> 'teacher_gender', '')::public.gender_t,
    (p_payload ->> 'sessions_per_week')::smallint,
    (p_payload ->> 'duration_min')::integer,
    (p_payload ->> 'billing_period')::public.billing_period,
    p_payload -> 'features',
    p_payload -> 'policy',
    false,
    true,
    coalesce((select max(package.sort_order) + 1 from public.packages as package), 0),
    actor_id
    );
  else
    update public.packages
    set slug = p_payload ->> 'slug',
        track_id = nullif(p_payload ->> 'track_id', '')::uuid,
        name_ar = p_payload ->> 'name_ar',
        name_en = nullif(p_payload ->> 'name_en', ''),
        description_ar = nullif(p_payload ->> 'description_ar', ''),
        description_en = nullif(p_payload ->> 'description_en', ''),
        audience = nullif(p_payload ->> 'audience', ''),
        teacher_gender = nullif(p_payload ->> 'teacher_gender', '')::public.gender_t,
        sessions_per_week = (p_payload ->> 'sessions_per_week')::smallint,
        duration_min = (p_payload ->> 'duration_min')::integer,
        billing_period = (p_payload ->> 'billing_period')::public.billing_period,
        features = p_payload -> 'features',
        policy = p_payload -> 'policy',
        is_published = false
    where id = saved_package_id;
  end if;

  for price in select value from jsonb_array_elements(p_payload -> 'prices') loop
    insert into public.package_prices(
      package_id,
      country_code,
      currency,
      amount,
      min_amount,
      max_amount,
      is_active,
      valid_from,
      created_by
    )
    values (
      saved_package_id,
      price ->> 'country_code',
      price ->> 'currency',
      (price ->> 'amount')::numeric,
      nullif(price ->> 'min_amount', '')::numeric,
      nullif(price ->> 'max_amount', '')::numeric,
      coalesce((price ->> 'is_active')::boolean, true),
      (price ->> 'valid_from')::timestamptz,
      actor_id
    );
  end loop;

  if coalesce((p_payload ->> 'is_published')::boolean, false) then
    update public.packages set is_published = true where id = saved_package_id;
  end if;

  return saved_package_id;
exception
  when unique_violation then
    raise exception using errcode = '23505', message = 'package_slug_exists';
end;
$$;

revoke execute on function public.save_package(jsonb) from public, anon;
grant execute on function public.save_package(jsonb) to authenticated, service_role;

create or replace function public.clone_package(p_package uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  source_package public.packages%rowtype;
  new_package_id uuid := gen_random_uuid();
begin
  if actor_id is null or not (select public.is_admin()) then
    raise exception using errcode = '42501', message = 'admin_mfa_required';
  end if;

  select * into source_package from public.packages where id = p_package;
  if not found then
    raise exception using errcode = 'P0002', message = 'package_not_found';
  end if;

  insert into public.packages(
    id, slug, track_id, name_ar, name_en, description_ar, description_en, audience,
    teacher_gender, sessions_per_week, duration_min, billing_period, features, policy,
    is_published, is_active, sort_order, created_by
  )
  values (
    new_package_id,
    source_package.slug || '-copy-' || substr(replace(new_package_id::text, '-', ''), 1, 8),
    source_package.track_id,
    source_package.name_ar || ' (نسخة)',
    case when source_package.name_en is null then null else source_package.name_en || ' (Copy)' end,
    source_package.description_ar,
    source_package.description_en,
    source_package.audience,
    source_package.teacher_gender,
    source_package.sessions_per_week,
    source_package.duration_min,
    source_package.billing_period,
    source_package.features,
    source_package.policy,
    false,
    true,
    coalesce((select max(package.sort_order) + 1 from public.packages as package), 0),
    actor_id
  );

  insert into public.package_prices(
    package_id, country_code, currency, amount, min_amount, max_amount,
    is_active, valid_from, created_by
  )
  select
    new_package_id,
    current_price.country_code,
    current_price.currency,
    current_price.amount,
    current_price.min_amount,
    current_price.max_amount,
    current_price.is_active,
    pg_catalog.clock_timestamp(),
    actor_id
  from (
    select distinct on (price.country_code) price.*
    from public.package_prices as price
    where price.package_id = p_package and price.valid_from <= now()
    order by price.country_code, price.valid_from desc
  ) as current_price;

  return new_package_id;
end;
$$;

revoke execute on function public.clone_package(uuid) from public, anon;
grant execute on function public.clone_package(uuid) to authenticated, service_role;

create or replace function public.reorder_packages(p_package_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  expected_count integer;
begin
  if actor_id is null or not (select public.is_admin()) then
    raise exception using errcode = '42501', message = 'admin_mfa_required';
  end if;
  if p_package_ids is null or cardinality(p_package_ids) = 0
    or cardinality(p_package_ids) <> (
      select count(distinct package_id) from unnest(p_package_ids) as package_id
    ) then
    raise exception using errcode = '22023', message = 'package_order_invalid';
  end if;

  select count(*) into expected_count
  from public.packages
  where id = any(p_package_ids);
  if expected_count <> cardinality(p_package_ids) then
    raise exception using errcode = '22023', message = 'package_order_unknown_id';
  end if;

  update public.packages as package
  set sort_order = requested.position - 1
  from unnest(p_package_ids) with ordinality as requested(id, position)
  where package.id = requested.id;
end;
$$;

revoke execute on function public.reorder_packages(uuid[]) from public, anon;
grant execute on function public.reorder_packages(uuid[]) to authenticated, service_role;
