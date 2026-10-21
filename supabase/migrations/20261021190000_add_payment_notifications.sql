create or replace function private.notify_confirmed_payment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  invoice_row public.invoices%rowtype;
begin
  if old.status = new.status or new.status <> 'confirmed' then return new; end if;
  select * into invoice_row from public.invoices where id = new.invoice_id;
  if invoice_row.payer_profile_id is not null then
    perform private.enqueue_notification(
      invoice_row.payer_profile_id,
      case when new.kind = 'refund' then 'refund_confirmed' else 'payment_confirmed' end,
      jsonb_build_object(
        'invoice_id', invoice_row.id,
        'invoice_no', invoice_row.invoice_no,
        'payment_id', new.id,
        'receipt_no', new.receipt_no,
        'amount', new.amount,
        'currency', new.currency
      )
    );
  end if;
  return new;
end;
$$;

revoke execute on function private.notify_confirmed_payment()
from public, anon, authenticated, service_role;
create trigger payments_notify_confirmation after update of status on public.payments
for each row when (new.status = 'confirmed')
execute function private.notify_confirmed_payment();
