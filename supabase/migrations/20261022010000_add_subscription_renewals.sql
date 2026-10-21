alter table public.subscriptions
  add column scheduled_package_id uuid references public.packages(id) on delete restrict,
  add column pause_reason text check (pause_reason is null or char_length(btrim(pause_reason)) between 2 and 500);

alter table public.invoices
  add column purpose text not null default 'initial' check (purpose in ('initial', 'renewal', 'proration')),
  add column billing_period_start date,
  add column billing_period_end date,
  add column metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  add constraint invoices_billing_period_valid check (
    (billing_period_start is null and billing_period_end is null)
    or (billing_period_start is not null and billing_period_end >= billing_period_start)
  );

create unique index invoices_one_renewal_period_idx
on public.invoices (subscription_id, billing_period_start)
where purpose = 'renewal' and status <> 'void';
create unique index invoices_one_open_proration_idx
on public.invoices (subscription_id)
where purpose = 'proration' and status in ('draft', 'issued', 'partially_paid', 'overdue');
create unique index session_credit_ledger_invoice_proration_idx
on public.session_credit_ledger (source_invoice_id)
where reason = 'proration' and source_invoice_id is not null;

create table public.subscription_renewal_alerts (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.subscriptions(id) on delete cascade,
  period_end date not null,
  days_before smallint not null check (days_before in (7, 3, 0)),
  created_at timestamptz not null default now(),
  unique (subscription_id, period_end, days_before)
);
alter table public.subscription_renewal_alerts enable row level security;
revoke all on public.subscription_renewal_alerts from public, anon, authenticated;
grant select on public.subscription_renewal_alerts to authenticated;
grant select, insert, update, delete on public.subscription_renewal_alerts to service_role;
create policy subscription_renewal_alerts_admin_read on public.subscription_renewal_alerts
for select to authenticated using ((select public.is_admin()));

create or replace function private.subscription_target_snapshot(target_package_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', package.id, 'slug', package.slug, 'track_id', package.track_id,
    'name_ar', package.name_ar, 'name_en', package.name_en,
    'sessions_per_week', package.sessions_per_week, 'duration_min', package.duration_min,
    'billing_period', package.billing_period, 'features', package.features,
    'captured_at', pg_catalog.clock_timestamp()
  )
  from public.packages as package
  where package.id = target_package_id and package.is_active and package.is_published
$$;
revoke execute on function private.subscription_target_snapshot(uuid) from public, anon, authenticated, service_role;

create or replace function private.subscription_period(target_package_id uuid, period_start date)
returns table(period_end date, sessions integer)
language sql
stable
security definer
set search_path = ''
as $$
  select
    case package.billing_period
      when 'monthly' then (period_start + interval '1 month' - interval '1 day')::date
      when 'quarterly' then (period_start + interval '3 months' - interval '1 day')::date
      when 'yearly' then (period_start + interval '1 year' - interval '1 day')::date
    end,
    package.sessions_per_week * case package.billing_period when 'monthly' then 4 when 'quarterly' then 13 else 52 end
  from public.packages as package where package.id = target_package_id
$$;
revoke execute on function private.subscription_period(uuid, date) from public, anon, authenticated, service_role;

create or replace function private.apply_paid_invoice(target_invoice uuid, actor uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  invoice_row public.invoices%rowtype;
  subscription_row public.subscriptions%rowtype;
  target_sessions integer;
  current_balance integer;
  ledger_delta integer;
begin
  select * into invoice_row from public.invoices where id = target_invoice for update;
  if invoice_row.id is null or invoice_row.status <> 'paid' or invoice_row.subscription_id is null then return; end if;
  select * into subscription_row from public.subscriptions where id = invoice_row.subscription_id for update;
  if invoice_row.purpose = 'initial' then
    if subscription_row.status in ('trial', 'expired') then
      update public.subscriptions set status = 'active' where id = subscription_row.id;
    end if;
    insert into public.session_credit_ledger(subscription_id, delta, reason, note, created_by, source_invoice_id)
    values (subscription_row.id, subscription_row.sessions_per_period, 'grant', 'invoice:' || invoice_row.invoice_no, actor, invoice_row.id)
    on conflict (source_invoice_id) where reason = 'grant' and source_invoice_id is not null do nothing;
  elsif invoice_row.purpose = 'renewal' then
    target_sessions := (invoice_row.metadata ->> 'sessions_per_period')::integer;
    update public.subscriptions set
      package_id = (invoice_row.metadata ->> 'package_id')::uuid,
      status = 'active', current_period_start = invoice_row.billing_period_start,
      current_period_end = invoice_row.billing_period_end, renew_date = invoice_row.billing_period_end + 1,
      price_amount = (invoice_row.metadata ->> 'price_amount')::numeric,
      price_currency = invoice_row.currency, price_country = invoice_row.metadata ->> 'price_country',
      policy_snapshot = invoice_row.metadata -> 'policy_snapshot',
      package_snapshot = invoice_row.metadata -> 'package_snapshot',
      sessions_per_period = target_sessions, scheduled_package_id = null,
      paused_until = null, pause_reason = null
    where id = subscription_row.id;
    insert into public.session_credit_ledger(subscription_id, delta, reason, note, created_by, source_invoice_id)
    values (subscription_row.id, target_sessions, 'grant', 'renewal:' || invoice_row.invoice_no, actor, invoice_row.id)
    on conflict (source_invoice_id) where reason = 'grant' and source_invoice_id is not null do nothing;
  else
    target_sessions := (invoice_row.metadata ->> 'sessions_per_period')::integer;
    select coalesce(sessions_remaining, 0) into current_balance
    from public.subscription_balance where subscription_id = subscription_row.id;
    current_balance := coalesce(current_balance, 0);
    ledger_delta := target_sessions - current_balance;
    update public.subscriptions set
      package_id = (invoice_row.metadata ->> 'package_id')::uuid,
      price_amount = (invoice_row.metadata ->> 'price_amount')::numeric,
      price_currency = invoice_row.currency, price_country = invoice_row.metadata ->> 'price_country',
      policy_snapshot = invoice_row.metadata -> 'policy_snapshot',
      package_snapshot = invoice_row.metadata -> 'package_snapshot',
      sessions_per_period = target_sessions, scheduled_package_id = null
    where id = subscription_row.id;
    if ledger_delta <> 0 then
      insert into public.session_credit_ledger(subscription_id, delta, reason, note, created_by, source_invoice_id)
      values (subscription_row.id, ledger_delta, 'proration', 'proration:' || invoice_row.invoice_no, actor, invoice_row.id)
      on conflict (source_invoice_id) where reason = 'proration' and source_invoice_id is not null do nothing;
    end if;
  end if;
end;
$$;
revoke execute on function private.apply_paid_invoice(uuid, uuid) from public, anon, authenticated, service_role;

create or replace function private.apply_confirmed_payment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  invoice_row public.invoices%rowtype;
  paid_total numeric(12,2);
  due_total numeric(12,2);
  next_status public.invoice_status;
begin
  if new.status is not distinct from old.status then return new; end if;
  select * into invoice_row from public.invoices where id = new.invoice_id for update;
  select coalesce(sum(case when kind = 'payment' then amount else -amount end), 0)
  into paid_total from public.payments where invoice_id = new.invoice_id and status = 'confirmed';
  due_total := greatest(invoice_row.total - paid_total, 0);
  next_status := case when due_total = 0 then 'paid'::public.invoice_status when paid_total > 0 then 'partially_paid'::public.invoice_status when invoice_row.due_date < current_date then 'overdue'::public.invoice_status else 'issued'::public.invoice_status end;
  update public.invoices set status = next_status where id = invoice_row.id and status is distinct from next_status;
  if next_status = 'paid' then perform private.apply_paid_invoice(invoice_row.id, new.confirmed_by); end if;
  return new;
end;
$$;

create or replace function public.process_subscription_renewals(p_as_of date default current_date)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  subscription_row public.subscriptions%rowtype;
  target_package public.packages%rowtype;
  resolved_price record;
  next_period record;
  payer_id uuid;
  invoice_id uuid;
  alerts_created integer := 0;
  invoices_created integer := 0;
  inserted_alert uuid;
begin
  if current_user not in ('postgres', 'service_role') and not public.is_admin() then raise exception using errcode = '42501', message = 'admin_mfa_required'; end if;
  update public.subscriptions set status = 'active', paused_until = null, pause_reason = null
  where status = 'paused' and paused_until <= p_as_of and current_period_end >= p_as_of;
  update public.subscriptions set status = 'expired'
  where status in ('trial','active','paused') and current_period_end < p_as_of;

  for subscription_row in
    select * from public.subscriptions
    where status in ('trial','active','paused') and current_period_end - p_as_of in (7,3,0)
    for update
  loop
    insert into public.subscription_renewal_alerts(subscription_id, period_end, days_before)
    values (subscription_row.id, subscription_row.current_period_end, subscription_row.current_period_end - p_as_of)
    on conflict do nothing returning id into inserted_alert;
    if inserted_alert is not null then
      alerts_created := alerts_created + 1;
      select payer_profile_id into payer_id from public.invoices where subscription_id = subscription_row.id order by created_at desc limit 1;
      if payer_id is not null then
        perform private.enqueue_notification(payer_id, 'subscription_renewal_due', jsonb_build_object('subscription_id', subscription_row.id, 'days_before', subscription_row.current_period_end - p_as_of, 'period_end', subscription_row.current_period_end));
      end if;
    end if;
    inserted_alert := null;

    if subscription_row.current_period_end - p_as_of = 7 and not exists (
      select 1 from public.invoices where subscription_id = subscription_row.id and purpose = 'renewal' and billing_period_start = subscription_row.current_period_end + 1 and status <> 'void'
    ) then
      select * into target_package from public.packages where id = coalesce(subscription_row.scheduled_package_id, subscription_row.package_id);
      select * into resolved_price from public.resolve_price(target_package.id, subscription_row.price_country, pg_catalog.clock_timestamp());
      select * into next_period from private.subscription_period(target_package.id, subscription_row.current_period_end + 1);
      if resolved_price.amount is not null and next_period.period_end is not null then
        insert into public.invoices(subscription_id, student_id, payer_profile_id, currency, due_date, locale, created_by, purpose, billing_period_start, billing_period_end, metadata)
        select subscription_row.id, subscription_row.student_id, previous.payer_profile_id, resolved_price.currency,
          subscription_row.current_period_end, previous.locale, (select auth.uid()), 'renewal', subscription_row.current_period_end + 1, next_period.period_end,
          jsonb_build_object('package_id', target_package.id, 'price_amount', resolved_price.amount, 'price_country', resolved_price.country_code, 'sessions_per_period', next_period.sessions, 'policy_snapshot', target_package.policy, 'package_snapshot', private.subscription_target_snapshot(target_package.id))
        from public.invoices as previous where previous.subscription_id = subscription_row.id order by previous.created_at desc limit 1
        returning id into invoice_id;
        insert into public.invoice_items(invoice_id, kind, description_ar, description_en, quantity, unit_amount)
        values (invoice_id, 'subscription', 'تجديد اشتراك ' || target_package.name_ar, 'Subscription renewal · ' || coalesce(target_package.name_en, target_package.name_ar), 1, resolved_price.amount);
        update public.invoices set status = 'issued' where id = invoice_id;
        invoices_created := invoices_created + 1;
      end if;
    end if;
  end loop;
  return jsonb_build_object('alerts', alerts_created, 'invoices', invoices_created);
end;
$$;
revoke execute on function public.process_subscription_renewals(date) from public, anon;
grant execute on function public.process_subscription_renewals(date) to authenticated, service_role;

create or replace function public.pause_subscription(p_subscription uuid, p_until date, p_reason text)
returns void language plpgsql security definer set search_path = ''
as $$
declare subscription_row public.subscriptions%rowtype; max_days integer;
begin
  if not public.is_admin() then raise exception using errcode = '42501', message = 'admin_mfa_required'; end if;
  select * into subscription_row from public.subscriptions where id = p_subscription for update;
  if subscription_row.id is null or subscription_row.status <> 'active' then raise exception using errcode = 'P0001', message = 'subscription_not_pausable'; end if;
  max_days := coalesce((subscription_row.policy_snapshot ->> 'max_pause_days')::integer, 0);
  if p_until <= current_date or p_until > current_date + max_days or char_length(btrim(p_reason)) not between 2 and 500 then raise exception using errcode = '22023', message = 'pause_period_invalid'; end if;
  update public.subscriptions set status = 'paused', paused_until = p_until, pause_reason = btrim(p_reason) where id = p_subscription;
end;
$$;
revoke execute on function public.pause_subscription(uuid, date, text) from public, anon;
grant execute on function public.pause_subscription(uuid, date, text) to authenticated, service_role;

create or replace function public.request_subscription_change(p_subscription uuid, p_target_package uuid)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare subscription_row public.subscriptions%rowtype; target_package public.packages%rowtype; resolved_price record; target_period record; current_balance integer; credit numeric(12,2); difference numeric(12,2); invoice_id uuid; payer_id uuid; invoice_locale text;
begin
  if not public.is_admin() then raise exception using errcode = '42501', message = 'admin_mfa_required'; end if;
  select * into subscription_row from public.subscriptions where id = p_subscription for update;
  select * into target_package from public.packages where id = p_target_package and is_active and is_published;
  if subscription_row.id is null or subscription_row.status not in ('active','paused') or target_package.id is null then raise exception using errcode = 'P0001', message = 'subscription_change_invalid'; end if;
  select * into resolved_price from public.resolve_price(target_package.id, subscription_row.price_country, pg_catalog.clock_timestamp());
  if resolved_price.amount is null then raise exception using errcode = 'P0002', message = 'package_price_not_found'; end if;
  if resolved_price.amount <= subscription_row.price_amount then
    update public.subscriptions set scheduled_package_id = target_package.id where id = subscription_row.id;
    return null;
  end if;
  select coalesce(sessions_remaining, 0) into current_balance from public.subscription_balance where subscription_id = subscription_row.id;
  current_balance := coalesce(current_balance, 0);
  credit := round(current_balance * (subscription_row.price_amount / subscription_row.sessions_per_period), 2);
  difference := greatest(resolved_price.amount - credit, 0);
  select * into target_period from private.subscription_period(target_package.id, subscription_row.current_period_start);
  select payer_profile_id, locale into payer_id, invoice_locale from public.invoices where subscription_id = subscription_row.id order by created_at desc limit 1;
  insert into public.invoices(subscription_id, student_id, payer_profile_id, currency, due_date, locale, created_by, purpose, billing_period_start, billing_period_end, metadata)
  values (subscription_row.id, subscription_row.student_id, payer_id, resolved_price.currency, current_date, coalesce(invoice_locale,'ar'), (select auth.uid()), 'proration', subscription_row.current_period_start, subscription_row.current_period_end,
    jsonb_build_object('package_id', target_package.id, 'price_amount', resolved_price.amount, 'price_country', resolved_price.country_code, 'sessions_per_period', target_period.sessions, 'policy_snapshot', target_package.policy, 'package_snapshot', private.subscription_target_snapshot(target_package.id), 'credit', credit)) returning id into invoice_id;
  insert into public.invoice_items(invoice_id, kind, description_ar, description_en, quantity, unit_amount)
  values (invoice_id, 'proration', 'ترقية إلى ' || target_package.name_ar, 'Upgrade to ' || coalesce(target_package.name_en,target_package.name_ar), 1, resolved_price.amount);
  if credit > 0 then insert into public.invoice_items(invoice_id, kind, description_ar, description_en, quantity, unit_amount) values (invoice_id, 'discount', 'رصيد الحصص المتبقية', 'Remaining-session credit', 1, -credit); end if;
  update public.invoices set status = case when difference = 0 then 'paid'::public.invoice_status else 'issued'::public.invoice_status end where id = invoice_id;
  if difference = 0 then perform private.apply_paid_invoice(invoice_id, (select auth.uid())); end if;
  return invoice_id;
end;
$$;
revoke execute on function public.request_subscription_change(uuid, uuid) from public, anon;
grant execute on function public.request_subscription_change(uuid, uuid) to authenticated, service_role;

create or replace function private.guard_invoice_change()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if old.status <> 'draft' then raise exception using errcode = 'P0001', message = 'invoice_immutable'; end if;
    return old;
  end if;
  if old.status <> 'draft' and (
    new.subscription_id is distinct from old.subscription_id or new.student_id is distinct from old.student_id
    or new.payer_profile_id is distinct from old.payer_profile_id or new.currency is distinct from old.currency
    or new.subtotal is distinct from old.subtotal or new.discount_total is distinct from old.discount_total
    or new.total is distinct from old.total or new.due_date is distinct from old.due_date
    or new.locale is distinct from old.locale or new.purpose is distinct from old.purpose
    or new.billing_period_start is distinct from old.billing_period_start
    or new.billing_period_end is distinct from old.billing_period_end or new.metadata is distinct from old.metadata
  ) then raise exception using errcode = 'P0001', message = 'invoice_immutable'; end if;
  if old.status is distinct from new.status and not (
    (old.status = 'draft' and new.status in ('issued','paid','void'))
    or (old.status = 'issued' and new.status in ('partially_paid','paid','overdue','void'))
    or (old.status = 'partially_paid' and new.status in ('paid','overdue'))
    or (old.status = 'overdue' and new.status in ('partially_paid','paid','void'))
    or (old.status = 'paid' and new.status = 'partially_paid')
  ) then raise exception using errcode = 'P0001', message = 'invalid_invoice_transition'; end if;
  if old.status = 'draft' and new.status in ('issued','paid') then
    new.issued_at := coalesce(new.issued_at, pg_catalog.clock_timestamp());
    if new.due_date is null then new.due_date := current_date; end if;
  end if;
  return new;
end;
$$;

select cron.schedule('process-subscription-renewals', '15 1 * * *', $$select public.process_subscription_renewals(current_date)$$)
where not exists (select 1 from cron.job where jobname = 'process-subscription-renewals');
