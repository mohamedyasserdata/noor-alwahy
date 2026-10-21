create or replace function private.is_valid_payment_method_details(candidate jsonb)
returns boolean
language plpgsql
immutable
strict
set search_path = ''
as $$
declare
  allowed_keys constant text[] := array[
    'account_name', 'account_number', 'iban', 'phone', 'branch', 'reference_hint'
  ];
  entry record;
begin
  if jsonb_typeof(candidate) <> 'object' then return false; end if;
  for entry in select key, value from jsonb_each(candidate) loop
    if not entry.key = any(allowed_keys)
      or jsonb_typeof(entry.value) <> 'string'
      or char_length(entry.value #>> '{}') > 300
      or (entry.value #>> '{}') ~ '[<>\x00-\x08\x0B\x0C\x0E-\x1F]' then
      return false;
    end if;
  end loop;
  return true;
end;
$$;

revoke execute on function private.is_valid_payment_method_details(jsonb)
from public, anon, authenticated, service_role;

alter table public.payment_methods
add constraint payment_methods_details_safe
check (private.is_valid_payment_method_details(details));

create unique index payment_methods_country_label_active_idx
on public.payment_methods (country_code, lower(label_ar))
where is_active;

drop policy payment_methods_authenticated_read on public.payment_methods;
create policy payment_methods_payer_read on public.payment_methods for select to authenticated
using (
  is_active
  and (select public.auth_role()) in ('student'::public.user_role, 'parent'::public.user_role)
);
