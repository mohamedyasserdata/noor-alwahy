create sequence public.expense_no_seq;

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  expense_no text unique not null default (
    'EXP-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.expense_no_seq')::text, 6, '0')
  ),
  category text not null check (category in (
    'teacher_payout', 'marketing', 'software', 'bank_fees', 'rent', 'equipment', 'other'
  )),
  description text not null check (char_length(btrim(description)) between 2 and 500),
  amount numeric(12,2) not null check (amount > 0),
  currency char(3) not null check (currency = upper(currency) and btrim(currency) ~ '^[A-Z]{3}$'),
  incurred_on date not null default current_date,
  payee text check (payee is null or char_length(btrim(payee)) between 2 and 200),
  reference text check (reference is null or char_length(btrim(reference)) <= 200),
  receipt_path text check (
    receipt_path is null or receipt_path ~ '^expense-receipts/[0-9a-f-]{36}/[A-Za-z0-9._-]+$'
  ),
  status text not null default 'recorded' check (status in ('recorded', 'void')),
  void_reason text check (void_reason is null or char_length(btrim(void_reason)) between 2 and 500),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'recorded' and void_reason is null) or (status = 'void' and void_reason is not null))
);

create index expenses_currency_date_idx on public.expenses(currency, incurred_on desc)
where status = 'recorded';
alter table public.expenses enable row level security;
revoke all on public.expenses from public, anon, authenticated;
grant select, insert, update on public.expenses to authenticated;
grant select, insert, update, delete on public.expenses to service_role;
create policy expenses_admin_read on public.expenses for select to authenticated
using ((select public.is_admin()));
create policy expenses_admin_insert on public.expenses for insert to authenticated
with check ((select public.is_admin()) and created_by = (select auth.uid()));
create policy expenses_admin_update on public.expenses for update to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));
create trigger expenses_set_updated_at before update on public.expenses
for each row execute function public.set_updated_at();
create trigger expenses_audit after insert or update or delete on public.expenses
for each row execute function public.audit_row();

create or replace function private.guard_expense_change()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if old.status = 'void' then
    raise exception using errcode = 'P0001', message = 'void_expense_immutable';
  end if;
  if new.expense_no is distinct from old.expense_no
    or new.category is distinct from old.category
    or new.description is distinct from old.description
    or new.amount is distinct from old.amount
    or new.currency is distinct from old.currency
    or new.incurred_on is distinct from old.incurred_on
    or new.payee is distinct from old.payee
    or new.reference is distinct from old.reference
    or new.receipt_path is distinct from old.receipt_path
    or new.created_by is distinct from old.created_by
    or new.created_at is distinct from old.created_at then
    raise exception using errcode = 'P0001', message = 'expense_financial_fields_immutable';
  end if;
  if new.status = 'void' and (new.void_reason is null or char_length(btrim(new.void_reason)) < 2) then
    raise exception using errcode = '22023', message = 'expense_void_reason_required';
  end if;
  return new;
end;
$$;
revoke execute on function private.guard_expense_change() from public, anon, authenticated, service_role;
create trigger expenses_guard_change before update on public.expenses
for each row execute function private.guard_expense_change();

create or replace view public.financial_currency_summary
with (security_invoker = true, security_barrier = true)
as
with invoice_totals as (
  select currency, coalesce(sum(total), 0)::numeric(14,2) as invoiced,
    coalesce(sum(total) filter (where status in ('issued','partially_paid','overdue')), 0)::numeric(14,2) as outstanding
  from public.invoices where status <> 'void' group by currency
), payment_totals as (
  select currency,
    coalesce(sum(amount) filter (where kind = 'payment'), 0)::numeric(14,2) as received,
    coalesce(sum(amount) filter (where kind = 'refund'), 0)::numeric(14,2) as refunded
  from public.payments where status = 'confirmed' group by currency
), expense_totals as (
  select currency, coalesce(sum(amount), 0)::numeric(14,2) as expenses
  from public.expenses where status = 'recorded' group by currency
), currencies as (
  select currency from invoice_totals union select currency from payment_totals union select currency from expense_totals
)
select currencies.currency,
  coalesce(invoice_totals.invoiced, 0)::numeric(14,2) as invoiced,
  coalesce(payment_totals.received, 0)::numeric(14,2) as received,
  coalesce(payment_totals.refunded, 0)::numeric(14,2) as refunded,
  coalesce(expense_totals.expenses, 0)::numeric(14,2) as expenses,
  coalesce(invoice_totals.outstanding, 0)::numeric(14,2) as outstanding,
  (coalesce(payment_totals.received, 0) - coalesce(payment_totals.refunded, 0) - coalesce(expense_totals.expenses, 0))::numeric(14,2) as net_cash
from currencies
left join invoice_totals using (currency)
left join payment_totals using (currency)
left join expense_totals using (currency);
revoke all on public.financial_currency_summary from public, anon;
grant select on public.financial_currency_summary to authenticated, service_role;

create or replace view public.student_account_statement
with (security_invoker = true, security_barrier = true)
as
with entries as (
  select invoice.student_id, invoice.currency, invoice.created_at as entry_at,
    'invoice'::text as entry_type, invoice.invoice_no as reference,
    invoice.total::numeric(12,2) as debit, 0::numeric(12,2) as credit
  from public.invoices as invoice where invoice.status not in ('draft','void')
  union all
  select invoice.student_id, payment.currency, coalesce(payment.confirmed_at, payment.created_at),
    payment.kind::text, coalesce(payment.receipt_no, invoice.invoice_no),
    case when payment.kind = 'refund' then payment.amount else 0 end,
    case when payment.kind = 'payment' then payment.amount else 0 end
  from public.payments as payment
  join public.invoices as invoice on invoice.id = payment.invoice_id
  where payment.status = 'confirmed'
)
select student_id, currency, entry_at, entry_type, reference, debit, credit,
  sum(debit - credit) over (
    partition by student_id, currency order by entry_at, entry_type, reference
    rows between unbounded preceding and current row
  )::numeric(14,2) as running_balance
from entries;
revoke all on public.student_account_statement from public, anon;
grant select on public.student_account_statement to authenticated, service_role;

comment on view public.financial_currency_summary is
'Admin financial totals remain separated by currency; currencies are never converted or combined.';
comment on view public.student_account_statement is
'RLS-filtered immutable invoice/payment ledger with a running balance per student and currency.';
