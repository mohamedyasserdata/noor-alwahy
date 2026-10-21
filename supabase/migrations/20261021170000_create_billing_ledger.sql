create sequence public.invoice_no_seq;
create sequence public.receipt_no_seq;

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_no text unique not null default (
    'INV-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.invoice_no_seq')::text, 6, '0')
  ),
  subscription_id uuid references public.subscriptions(id) on delete restrict,
  student_id uuid not null references public.students(id) on delete restrict,
  payer_profile_id uuid references public.profiles(id) on delete restrict,
  currency char(3) not null,
  subtotal numeric(12,2) not null default 0,
  discount_total numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  status public.invoice_status not null default 'draft',
  due_date date,
  issued_at timestamptz,
  locale text not null default 'ar' check (locale in ('ar', 'en')),
  created_by uuid references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (currency = upper(currency) and btrim(currency) ~ '^[A-Z]{3}$'),
  check (subtotal >= 0 and discount_total >= 0 and total >= 0),
  check (discount_total <= subtotal and total = subtotal - discount_total),
  check ((status = 'draft' and issued_at is null) or status <> 'draft')
);

create table public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  kind text not null check (kind in (
    'subscription', 'registration', 'exam', 'certificate',
    'extra_session', 'other', 'discount', 'proration'
  )),
  description_ar text not null check (char_length(btrim(description_ar)) between 2 and 500),
  description_en text check (description_en is null or char_length(btrim(description_en)) between 2 and 500),
  quantity numeric(10,2) not null default 1 check (quantity > 0),
  unit_amount numeric(12,2) not null,
  amount numeric(12,2) generated always as (round(quantity * unit_amount, 2)) stored,
  created_at timestamptz not null default now(),
  check (
    (kind = 'discount' and unit_amount < 0)
    or (kind <> 'discount' and unit_amount >= 0)
  )
);

create table public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  country_code char(2) not null references public.countries(code) on delete restrict,
  type text not null check (type in ('bank', 'wallet', 'instapay', 'cash', 'other')),
  label_ar text not null check (char_length(btrim(label_ar)) between 2 and 160),
  label_en text check (label_en is null or char_length(btrim(label_en)) between 2 and 160),
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  instructions_ar text check (instructions_ar is null or char_length(instructions_ar) <= 3000),
  instructions_en text check (instructions_en is null or char_length(instructions_en) <= 3000),
  is_active boolean not null default true,
  sort_order integer not null default 0 check (sort_order >= 0),
  created_by uuid references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete restrict,
  kind public.payment_kind not null default 'payment',
  amount numeric(12,2) not null check (amount > 0),
  currency char(3) not null,
  status public.payment_status not null default 'pending_confirmation',
  provider text not null default 'manual' check (provider = 'manual'),
  payment_method_id uuid references public.payment_methods(id) on delete restrict,
  paid_at timestamptz,
  proof_note text check (proof_note is null or char_length(proof_note) <= 3000),
  proof_file_path text check (
    proof_file_path is null
    or (char_length(proof_file_path) between 3 and 500 and proof_file_path !~ '^[a-z]+://')
  ),
  recorded_by uuid not null references public.profiles(id) on delete restrict,
  confirmed_by uuid references public.profiles(id) on delete restrict,
  confirmed_at timestamptz,
  receipt_no text unique,
  created_at timestamptz not null default now(),
  check (currency = upper(currency) and btrim(currency) ~ '^[A-Z]{3}$'),
  check (
    (status = 'confirmed' and confirmed_by is not null and confirmed_at is not null and receipt_no is not null)
    or (status <> 'confirmed' and confirmed_by is null and confirmed_at is null and receipt_no is null)
  )
);

alter table public.session_credit_ledger
add column source_invoice_id uuid references public.invoices(id) on delete restrict;
create unique index session_credit_ledger_invoice_grant_idx
on public.session_credit_ledger (source_invoice_id)
where reason = 'grant' and source_invoice_id is not null;

create index invoices_student_created_idx on public.invoices (student_id, created_at desc);
create index invoices_status_due_idx on public.invoices (status, due_date);
create index invoice_items_invoice_idx on public.invoice_items (invoice_id);
create index payment_methods_country_order_idx on public.payment_methods (country_code, sort_order, id);
create index payments_invoice_created_idx on public.payments (invoice_id, created_at);
create index payments_pending_idx on public.payments (created_at)
where status = 'pending_confirmation';

create trigger invoices_set_updated_at before update on public.invoices
for each row execute function public.set_updated_at();
create trigger payment_methods_set_updated_at before update on public.payment_methods
for each row execute function public.set_updated_at();
create trigger invoices_audit after insert or update or delete on public.invoices
for each row execute function public.audit_row();
create trigger invoice_items_audit after insert or update or delete on public.invoice_items
for each row execute function public.audit_row();
create trigger payment_methods_audit after insert or update or delete on public.payment_methods
for each row execute function public.audit_row();
create trigger payments_audit after insert or update on public.payments
for each row execute function public.audit_row();

create or replace function private.guard_invoice_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if old.status <> 'draft' then
      raise exception using errcode = 'P0001', message = 'invoice_immutable';
    end if;
    return old;
  end if;

  if old.status <> 'draft' and (
    new.subscription_id is distinct from old.subscription_id
    or new.student_id is distinct from old.student_id
    or new.payer_profile_id is distinct from old.payer_profile_id
    or new.currency is distinct from old.currency
    or new.subtotal is distinct from old.subtotal
    or new.discount_total is distinct from old.discount_total
    or new.total is distinct from old.total
    or new.due_date is distinct from old.due_date
    or new.locale is distinct from old.locale
  ) then
    raise exception using errcode = 'P0001', message = 'invoice_immutable';
  end if;

  if old.status is distinct from new.status and not (
    (old.status = 'draft' and new.status in ('issued', 'void'))
    or (old.status = 'issued' and new.status in ('partially_paid', 'paid', 'overdue', 'void'))
    or (old.status = 'partially_paid' and new.status in ('paid', 'overdue'))
    or (old.status = 'overdue' and new.status in ('partially_paid', 'paid', 'void'))
    or (old.status = 'paid' and new.status = 'partially_paid')
  ) then
    raise exception using errcode = 'P0001', message = 'invalid_invoice_transition';
  end if;

  if old.status = 'draft' and new.status = 'issued' then
    new.issued_at := coalesce(new.issued_at, pg_catalog.clock_timestamp());
    if new.due_date is null then new.due_date := current_date; end if;
  end if;
  return new;
end;
$$;
revoke execute on function private.guard_invoice_change() from public, anon, authenticated, service_role;
create trigger invoices_guard_change before update or delete on public.invoices
for each row execute function private.guard_invoice_change();

create or replace function private.guard_invoice_item_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  parent_status public.invoice_status;
begin
  select status into parent_status from public.invoices where id = coalesce(new.invoice_id, old.invoice_id);
  if parent_status is distinct from 'draft' then
    raise exception using errcode = 'P0001', message = 'invoice_immutable';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
revoke execute on function private.guard_invoice_item_change() from public, anon, authenticated, service_role;
create trigger invoice_items_guard_change before insert or update or delete on public.invoice_items
for each row execute function private.guard_invoice_item_change();

create or replace function private.recalculate_invoice_totals()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_invoice uuid := coalesce(new.invoice_id, old.invoice_id);
  calculated_subtotal numeric(12,2);
  calculated_discount numeric(12,2);
begin
  select
    coalesce(sum(item.amount) filter (where item.kind <> 'discount'), 0),
    abs(coalesce(sum(item.amount) filter (where item.kind = 'discount'), 0))
  into calculated_subtotal, calculated_discount
  from public.invoice_items as item
  where item.invoice_id = target_invoice;

  if calculated_discount > calculated_subtotal then
    raise exception using errcode = '23514', message = 'invoice_discount_exceeds_subtotal';
  end if;
  update public.invoices
  set subtotal = calculated_subtotal,
      discount_total = calculated_discount,
      total = calculated_subtotal - calculated_discount
  where id = target_invoice;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
revoke execute on function private.recalculate_invoice_totals() from public, anon, authenticated, service_role;
create trigger invoice_items_recalculate after insert or update or delete on public.invoice_items
for each row execute function private.recalculate_invoice_totals();

create or replace function private.prepare_payment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  invoice_row public.invoices%rowtype;
  net_paid numeric(12,2);
begin
  if tg_op = 'DELETE' then
    raise exception using errcode = 'P0001', message = 'payment_immutable';
  end if;
  select * into invoice_row from public.invoices where id = new.invoice_id for update;
  if invoice_row.id is null then
    raise exception using errcode = 'P0002', message = 'invoice_not_found';
  end if;
  if new.currency is distinct from invoice_row.currency then
    raise exception using errcode = 'P0001', message = 'payment_currency_mismatch';
  end if;
  if invoice_row.status in ('draft', 'void') then
    raise exception using errcode = 'P0001', message = 'invoice_not_payable';
  end if;
  if tg_op = 'INSERT' then
    if new.status <> 'pending_confirmation' or new.confirmed_by is not null
      or new.confirmed_at is not null or new.receipt_no is not null then
      raise exception using errcode = 'P0001', message = 'payment_must_start_pending';
    end if;
    if new.recorded_by is distinct from (select auth.uid()) and current_user <> 'service_role' then
      raise exception using errcode = '42501', message = 'invalid_payment_recorder';
    end if;
    return new;
  end if;

  if old.status = 'confirmed' then
    raise exception using errcode = 'P0001', message = 'payment_immutable';
  end if;
  if old.status = 'rejected' then
    raise exception using errcode = 'P0001', message = 'payment_finalized';
  end if;
  if new.invoice_id is distinct from old.invoice_id
    or new.kind is distinct from old.kind
    or new.amount is distinct from old.amount
    or new.currency is distinct from old.currency
    or new.recorded_by is distinct from old.recorded_by then
    raise exception using errcode = 'P0001', message = 'payment_core_immutable';
  end if;
  if new.status not in ('pending_confirmation', 'confirmed', 'rejected') then
    raise exception using errcode = 'P0001', message = 'invalid_payment_transition';
  end if;

  if new.status = 'confirmed' then
    if not public.is_admin() then
      raise exception using errcode = '42501', message = 'admin_mfa_required';
    end if;
    if new.kind = 'refund' then
      select coalesce(sum(case when kind = 'payment' then amount else -amount end), 0)
      into net_paid
      from public.payments
      where invoice_id = new.invoice_id and status = 'confirmed';
      if new.amount > net_paid then
        raise exception using errcode = 'P0001', message = 'refund_exceeds_paid';
      end if;
    end if;
    new.confirmed_by := (select auth.uid());
    new.confirmed_at := pg_catalog.clock_timestamp();
    new.receipt_no := (case when new.kind = 'refund' then 'RFD-' else 'REC-' end)
      || to_char(new.confirmed_at, 'YYYY') || '-'
      || lpad(nextval('public.receipt_no_seq')::text, 6, '0');
  elsif new.status = 'rejected' then
    new.confirmed_by := null;
    new.confirmed_at := null;
    new.receipt_no := null;
  end if;
  return new;
end;
$$;
revoke execute on function private.prepare_payment() from public, anon, authenticated, service_role;
create trigger payments_prepare before insert or update or delete on public.payments
for each row execute function private.prepare_payment();

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
  subscription_row public.subscriptions%rowtype;
begin
  if new.status is not distinct from old.status then return new; end if;
  select * into invoice_row from public.invoices where id = new.invoice_id for update;
  select coalesce(sum(case when kind = 'payment' then amount else -amount end), 0)
  into paid_total
  from public.payments
  where invoice_id = new.invoice_id and status = 'confirmed';
  due_total := greatest(invoice_row.total - paid_total, 0);
  next_status := case
    when due_total = 0 then 'paid'::public.invoice_status
    when paid_total > 0 then 'partially_paid'::public.invoice_status
    when invoice_row.due_date < current_date then 'overdue'::public.invoice_status
    else 'issued'::public.invoice_status
  end;
  update public.invoices set status = next_status where id = invoice_row.id and status is distinct from next_status;

  if next_status = 'paid' and invoice_row.subscription_id is not null then
    select * into subscription_row from public.subscriptions
    where id = invoice_row.subscription_id for update;
    if subscription_row.status in ('trial', 'expired') then
      update public.subscriptions set status = 'active' where id = subscription_row.id;
    end if;
    insert into public.session_credit_ledger(
      subscription_id, delta, reason, note, created_by, source_invoice_id
    ) values (
      subscription_row.id, subscription_row.sessions_per_period, 'grant',
      'invoice:' || invoice_row.invoice_no, new.confirmed_by, invoice_row.id
    ) on conflict (source_invoice_id) where reason = 'grant' and source_invoice_id is not null do nothing;
  end if;
  return new;
end;
$$;
revoke execute on function private.apply_confirmed_payment() from public, anon, authenticated, service_role;
create trigger payments_apply_confirmation after update of status on public.payments
for each row when (new.status in ('confirmed', 'rejected'))
execute function private.apply_confirmed_payment();

create or replace function private.create_subscription_invoice()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_invoice_id uuid;
  payer_id uuid;
  invoice_locale text := 'ar';
  description_ar text;
  description_en text;
begin
  if new.package_id is null or new.price_amount is null or new.price_currency is null then return new; end if;
  select guardian.profile_id into payer_id
  from public.student_guardians as relation
  join public.guardians as guardian on guardian.id = relation.guardian_id
  where relation.student_id = new.student_id and relation.is_payer
  order by relation.is_primary desc
  limit 1;
  if payer_id is null then
    select profile_id into payer_id from public.students where id = new.student_id;
  end if;
  if payer_id is not null then
    select coalesce(profile.preferred_locale, 'ar') into invoice_locale
    from public.profiles as profile where profile.id = payer_id;
  end if;
  description_ar := 'اشتراك ' || coalesce(new.package_snapshot ->> 'name_ar', 'الأكاديمية');
  description_en := 'Subscription · ' || coalesce(new.package_snapshot ->> 'name_en', new.package_snapshot ->> 'name_ar', 'Academy');

  insert into public.invoices(
    subscription_id, student_id, payer_profile_id, currency, due_date, locale, created_by
  ) values (
    new.id, new.student_id, payer_id, new.price_currency, new.start_date,
    invoice_locale, new.created_by
  ) returning id into new_invoice_id;
  insert into public.invoice_items(invoice_id, kind, description_ar, description_en, quantity, unit_amount)
  values (new_invoice_id, 'subscription', description_ar, description_en, 1, new.price_amount);
  update public.invoices set status = 'issued' where id = new_invoice_id;
  return new;
end;
$$;
revoke execute on function private.create_subscription_invoice() from public, anon, authenticated, service_role;
create trigger subscriptions_create_invoice after insert on public.subscriptions
for each row execute function private.create_subscription_invoice();

create view public.invoice_balance
with (security_invoker = true, security_barrier = true)
as
select
  invoice.id as invoice_id,
  invoice.total,
  coalesce(sum(case
    when payment.status = 'confirmed' and payment.kind = 'payment' then payment.amount
    when payment.status = 'confirmed' and payment.kind = 'refund' then -payment.amount
    else 0
  end), 0)::numeric(12,2) as paid,
  greatest(invoice.total - coalesce(sum(case
    when payment.status = 'confirmed' and payment.kind = 'payment' then payment.amount
    when payment.status = 'confirmed' and payment.kind = 'refund' then -payment.amount
    else 0
  end), 0), 0)::numeric(12,2) as due
from public.invoices as invoice
left join public.payments as payment on payment.invoice_id = invoice.id
group by invoice.id;

alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;
alter table public.payment_methods enable row level security;
alter table public.payments enable row level security;

revoke all on public.invoices from public, anon, authenticated;
revoke all on public.invoice_items from public, anon, authenticated;
revoke all on public.payment_methods from public, anon, authenticated;
revoke all on public.payments from public, anon, authenticated;
revoke all on public.invoice_balance from public, anon, authenticated;

grant select, insert, update, delete on public.invoices to authenticated;
grant select, insert, update, delete on public.invoice_items to authenticated;
grant select, insert, update, delete on public.payment_methods to authenticated;
grant select, insert, update on public.payments to authenticated;
grant select on public.invoice_balance to authenticated;
grant select, insert, update, delete on public.invoices to service_role;
grant select, insert, update, delete on public.invoice_items to service_role;
grant select, insert, update, delete on public.payment_methods to service_role;
grant select, insert, update on public.payments to service_role;
grant select on public.invoice_balance to service_role;

create policy invoices_admin_all on public.invoices for all to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));
create policy invoices_student_read on public.invoices for select to authenticated
using (exists (
  select 1 from public.students as student
  where student.id = invoices.student_id and student.profile_id = (select auth.uid())
));
create policy invoices_guardian_read on public.invoices for select to authenticated
using ((select private.guards_student(student_id)));

create policy invoice_items_admin_all on public.invoice_items for all to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));
create policy invoice_items_payer_read on public.invoice_items for select to authenticated
using (exists (select 1 from public.invoices where id = invoice_items.invoice_id));

create policy payment_methods_admin_all on public.payment_methods for all to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));
create policy payment_methods_authenticated_read on public.payment_methods for select to authenticated
using (is_active);

create policy payments_admin_all on public.payments for all to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));
create policy payments_payer_read on public.payments for select to authenticated
using (exists (select 1 from public.invoices where id = payments.invoice_id));

grant usage, select on sequence public.invoice_no_seq to authenticated;
grant usage, select on sequence public.receipt_no_seq to authenticated;
grant usage, select on sequence public.invoice_no_seq to service_role;
grant usage, select on sequence public.receipt_no_seq to service_role;
