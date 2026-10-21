alter table public.subscriptions
  add column package_id uuid references public.packages(id) on delete restrict,
  add column source_application_id uuid references public.applications(id) on delete restrict,
  add column renew_date date,
  add column auto_renew boolean not null default false,
  add column price_amount numeric(12,2),
  add column price_currency char(3),
  add column price_country char(2) references public.countries(code) on delete restrict,
  add column package_snapshot jsonb,
  add column coupon_id uuid references public.coupons(id) on delete restrict,
  add column created_by uuid references public.profiles(id) on delete restrict;

alter table public.subscriptions
  add constraint subscriptions_renewal_after_period
    check (renew_date is null or renew_date > current_period_end),
  add constraint subscriptions_price_nonnegative
    check (price_amount is null or price_amount >= 0),
  add constraint subscriptions_currency_iso
    check (price_currency is null or (price_currency = upper(price_currency) and btrim(price_currency) ~ '^[A-Z]{3}$')),
  add constraint subscriptions_country_iso
    check (price_country is null or (price_country = upper(price_country) and btrim(price_country) ~ '^[A-Z]{2}$')),
  add constraint subscriptions_snapshots_are_objects
    check (
      jsonb_typeof(policy_snapshot) = 'object'
      and (package_snapshot is null or jsonb_typeof(package_snapshot) = 'object')
    ),
  add constraint subscriptions_package_snapshot_complete
    check (
      package_id is null
      or (
        price_amount is not null
        and price_currency is not null
        and price_country is not null
        and policy_snapshot is not null
        and package_snapshot is not null
        and renew_date is not null
      )
    );

create unique index subscriptions_source_application_idx
on public.subscriptions (source_application_id)
where source_application_id is not null;
create index subscriptions_package_status_idx
on public.subscriptions (package_id, status, current_period_end);
create index subscriptions_renewal_idx
on public.subscriptions (renew_date, status)
where status in ('trial', 'active', 'paused');

create or replace function public.create_subscription(
  p_student uuid,
  p_package uuid,
  p_country char(2),
  p_start_date date default current_date,
  p_application uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_package public.packages%rowtype;
  selected_price record;
  selected_application public.applications%rowtype;
  period_end date;
  next_renewal date;
  period_sessions integer;
  new_subscription_id uuid;
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'admin_mfa_required';
  end if;
  if p_student is null or p_package is null or p_start_date is null
    or p_country is null or upper(btrim(p_country)) !~ '^[A-Z]{2}$' then
    raise exception using errcode = '22023', message = 'invalid_subscription_input';
  end if;
  if not exists (select 1 from public.students where id = p_student and status = 'active') then
    raise exception using errcode = 'P0002', message = 'active_student_not_found';
  end if;

  select * into selected_package
  from public.packages
  where id = p_package and is_active and is_published
  for share;
  if selected_package.id is null then
    raise exception using errcode = 'P0002', message = 'published_package_not_found';
  end if;

  select * into selected_price
  from public.resolve_price(p_package, upper(btrim(p_country))::char(2), pg_catalog.clock_timestamp());
  if selected_price.amount is null then
    raise exception using errcode = 'P0002', message = 'package_price_not_found';
  end if;

  if p_application is not null then
    select * into selected_application
    from public.applications
    where id = p_application
    for update;
    if selected_application.id is null then
      raise exception using errcode = 'P0002', message = 'application_not_found';
    end if;
    if selected_application.status <> 'accepted'
      or selected_application.converted_student_id is distinct from p_student then
      raise exception using errcode = 'P0001', message = 'application_not_ready_for_subscription';
    end if;
    if selected_application.package_id is not null
      and selected_application.package_id is distinct from p_package then
      raise exception using errcode = 'P0001', message = 'application_package_mismatch';
    end if;
  end if;

  case selected_package.billing_period
    when 'monthly' then
      period_end := (p_start_date + interval '1 month' - interval '1 day')::date;
      period_sessions := selected_package.sessions_per_week * 4;
    when 'quarterly' then
      period_end := (p_start_date + interval '3 months' - interval '1 day')::date;
      period_sessions := selected_package.sessions_per_week * 13;
    when 'yearly' then
      period_end := (p_start_date + interval '1 year' - interval '1 day')::date;
      period_sessions := selected_package.sessions_per_week * 52;
    else
      raise exception using errcode = '22023', message = 'invalid_billing_period';
  end case;
  next_renewal := period_end + 1;

  insert into public.subscriptions (
    student_id, package_id, source_application_id, status, start_date,
    current_period_start, current_period_end, renew_date, auto_renew,
    price_amount, price_currency, price_country, policy_snapshot,
    package_snapshot, sessions_per_period, created_by
  ) values (
    p_student, p_package, p_application, 'trial', p_start_date,
    p_start_date, period_end, next_renewal, false,
    selected_price.amount, selected_price.currency, selected_price.country_code,
    selected_package.policy,
    jsonb_build_object(
      'id', selected_package.id,
      'slug', selected_package.slug,
      'track_id', selected_package.track_id,
      'name_ar', selected_package.name_ar,
      'name_en', selected_package.name_en,
      'sessions_per_week', selected_package.sessions_per_week,
      'duration_min', selected_package.duration_min,
      'billing_period', selected_package.billing_period,
      'features', selected_package.features,
      'captured_at', pg_catalog.clock_timestamp()
    ),
    period_sessions,
    (select auth.uid())
  )
  returning id into new_subscription_id;

  return new_subscription_id;
exception
  when unique_violation then
    if p_application is not null then
      select id into new_subscription_id
      from public.subscriptions
      where source_application_id = p_application;
      if new_subscription_id is not null then return new_subscription_id; end if;
    end if;
    raise exception using errcode = '23505', message = 'student_already_has_current_subscription';
end;
$$;

revoke execute on function public.create_subscription(uuid, uuid, char, date, uuid)
from public, anon;
grant execute on function public.create_subscription(uuid, uuid, char, date, uuid)
to authenticated;

comment on function public.create_subscription(uuid, uuid, char, date, uuid) is
'Creates a trial subscription from immutable package, policy, and resolved-price snapshots. Activation and credit grants remain payment-confirmation responsibilities.';
