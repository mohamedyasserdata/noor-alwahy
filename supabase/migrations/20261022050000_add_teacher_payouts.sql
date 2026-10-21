create table public.teacher_payouts (
  id uuid primary key default gen_random_uuid(),
  payout_no text unique not null default (
    'PAY-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.expense_no_seq')::text, 6, '0')
  ),
  teacher_id uuid not null references public.teachers(id) on delete restrict,
  period_start date not null,
  period_end date not null,
  currency char(3) not null check (currency = upper(currency) and btrim(currency) ~ '^[A-Z]{3}$'),
  gross numeric(12,2) not null default 0 check (gross >= 0),
  bonuses numeric(12,2) not null default 0 check (bonuses >= 0),
  deductions numeric(12,2) not null default 0 check (deductions >= 0),
  net numeric(12,2) not null default 0 check (net >= 0),
  status public.payout_status not null default 'accruing',
  approved_by uuid references public.profiles(id) on delete restrict,
  approved_at timestamptz,
  paid_at timestamptz,
  payment_reference text check (payment_reference is null or char_length(btrim(payment_reference)) between 2 and 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (period_end >= period_start),
  unique (teacher_id, period_start, period_end, currency)
);

alter table public.teacher_payout_items
  add column payout_id uuid references public.teacher_payouts(id) on delete restrict,
  add column rate_id uuid references public.teacher_rates(id) on delete restrict;
create index teacher_payout_items_payout_idx on public.teacher_payout_items(payout_id) where payout_id is not null;

create table public.teacher_adjustments (
  id uuid primary key default gen_random_uuid(),
  payout_id uuid not null references public.teacher_payouts(id) on delete restrict,
  kind text not null check (kind in ('bonus', 'deduction')),
  amount numeric(12,2) not null check (amount > 0),
  reason text not null check (char_length(btrim(reason)) between 2 and 500),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

alter table public.expenses
  add column source text not null default 'manual' check (source in ('manual', 'teacher_payout')),
  add column payout_id uuid unique references public.teacher_payouts(id) on delete restrict;
alter table public.expenses add constraint expenses_source_payout_valid check (
  (source = 'manual' and payout_id is null) or (source = 'teacher_payout' and payout_id is not null)
);

drop trigger teacher_payout_items_immutable on public.teacher_payout_items;
create or replace function public.prevent_teacher_payout_item_mutation()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if tg_op = 'DELETE' or old.payout_id is not null
    or new.payout_id is null
    or (to_jsonb(new) - 'payout_id' - 'updated_at') is distinct from (to_jsonb(old) - 'payout_id' - 'updated_at') then
    raise exception using errcode = 'P0001', message = 'teacher_payout_item_immutable';
  end if;
  return new;
end;
$$;
create trigger teacher_payout_items_immutable before update or delete on public.teacher_payout_items
for each row execute function public.prevent_teacher_payout_item_mutation();

create or replace function private.recalculate_teacher_payout(target_payout uuid)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  update public.teacher_payouts as payout set
    gross = totals.gross,
    bonuses = totals.bonuses,
    deductions = totals.deductions,
    net = greatest(totals.gross + totals.bonuses - totals.deductions, 0),
    updated_at = pg_catalog.clock_timestamp()
  from (
    select
      coalesce((select sum(amount) from public.teacher_payout_items where payout_id = target_payout), 0)::numeric(12,2) as gross,
      coalesce((select sum(amount) from public.teacher_adjustments where payout_id = target_payout and kind = 'bonus'), 0)::numeric(12,2) as bonuses,
      coalesce((select sum(amount) from public.teacher_adjustments where payout_id = target_payout and kind = 'deduction'), 0)::numeric(12,2) as deductions
  ) as totals where payout.id = target_payout;
end;
$$;
revoke execute on function private.recalculate_teacher_payout(uuid) from public, anon, authenticated, service_role;

create or replace function private.recalculate_teacher_payout_trigger()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  perform private.recalculate_teacher_payout(coalesce(new.payout_id, old.payout_id));
  return coalesce(new, old);
end;
$$;
revoke execute on function private.recalculate_teacher_payout_trigger() from public, anon, authenticated, service_role;
create trigger teacher_payout_items_recalculate after update of payout_id on public.teacher_payout_items
for each row execute function private.recalculate_teacher_payout_trigger();
create trigger teacher_adjustments_recalculate after insert or delete on public.teacher_adjustments
for each row execute function private.recalculate_teacher_payout_trigger();

create or replace function public.generate_teacher_payouts(p_period_start date, p_period_end date)
returns integer language plpgsql security definer set search_path = ''
as $$
declare group_row record; target_payout uuid; generated integer := 0;
begin
  if not public.is_admin() then raise exception using errcode = '42501', message = 'admin_mfa_required'; end if;
  if p_period_start is null or p_period_end is null or p_period_end < p_period_start or p_period_end >= current_date then
    raise exception using errcode = '22023', message = 'payout_period_invalid';
  end if;
  for group_row in
    select item.teacher_id, item.currency
    from public.teacher_payout_items as item
    join public.sessions as session on session.id = item.session_id
    where item.payout_id is null and session.scheduled_at::date between p_period_start and p_period_end
    group by item.teacher_id, item.currency
  loop
    insert into public.teacher_payouts(teacher_id, period_start, period_end, currency, status)
    values (group_row.teacher_id, p_period_start, p_period_end, group_row.currency, 'due')
    on conflict (teacher_id, period_start, period_end, currency) do update set updated_at = now()
    returning id into target_payout;
    update public.teacher_payout_items as item set payout_id = target_payout
    from public.sessions as session
    where session.id = item.session_id and item.teacher_id = group_row.teacher_id
      and item.currency = group_row.currency and item.payout_id is null
      and session.scheduled_at::date between p_period_start and p_period_end;
    perform private.recalculate_teacher_payout(target_payout);
    generated := generated + 1;
  end loop;
  return generated;
end;
$$;
revoke execute on function public.generate_teacher_payouts(date, date) from public, anon;
grant execute on function public.generate_teacher_payouts(date, date) to authenticated, service_role;

create or replace function public.add_teacher_adjustment(p_payout uuid, p_kind text, p_amount numeric, p_reason text)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare payout_row public.teacher_payouts%rowtype; result uuid;
begin
  if not public.is_admin() then raise exception using errcode = '42501', message = 'admin_mfa_required'; end if;
  select * into payout_row from public.teacher_payouts where id = p_payout for update;
  if payout_row.id is null or payout_row.status not in ('accruing','due') or p_kind not in ('bonus','deduction') or p_amount <= 0 or char_length(btrim(p_reason)) not between 2 and 500 then
    raise exception using errcode = '22023', message = 'adjustment_invalid';
  end if;
  insert into public.teacher_adjustments(payout_id, kind, amount, reason, created_by)
  values (p_payout, p_kind, p_amount, btrim(p_reason), (select auth.uid())) returning id into result;
  return result;
end;
$$;
revoke execute on function public.add_teacher_adjustment(uuid, text, numeric, text) from public, anon;
grant execute on function public.add_teacher_adjustment(uuid, text, numeric, text) to authenticated, service_role;

create or replace function public.transition_teacher_payout(p_payout uuid, p_action text, p_reference text default null)
returns void language plpgsql security definer set search_path = ''
as $$
declare payout_row public.teacher_payouts%rowtype; teacher_name text;
begin
  if not public.is_admin() then raise exception using errcode = '42501', message = 'admin_mfa_required'; end if;
  select * into payout_row from public.teacher_payouts where id = p_payout for update;
  if payout_row.id is null then raise exception using errcode = 'P0002', message = 'payout_not_found'; end if;
  if p_action = 'approve' and payout_row.status = 'due' then
    update public.teacher_payouts set status = 'approved', approved_by = (select auth.uid()), approved_at = now() where id = p_payout;
  elsif p_action = 'pay' and payout_row.status = 'approved' and char_length(btrim(coalesce(p_reference,''))) between 2 and 200 then
    select profile.full_name into teacher_name from public.teachers as teacher join public.profiles as profile on profile.id = teacher.profile_id where teacher.id = payout_row.teacher_id;
    update public.teacher_payouts set status = 'paid', paid_at = now(), payment_reference = btrim(p_reference) where id = p_payout;
    insert into public.expenses(category, description, amount, currency, incurred_on, payee, reference, source, payout_id, created_by)
    values ('teacher_payout', 'Teacher payout ' || payout_row.payout_no, payout_row.net, payout_row.currency, current_date, teacher_name, btrim(p_reference), 'teacher_payout', p_payout, (select auth.uid()));
  else
    raise exception using errcode = 'P0001', message = 'invalid_payout_transition';
  end if;
end;
$$;
revoke execute on function public.transition_teacher_payout(uuid, text, text) from public, anon;
grant execute on function public.transition_teacher_payout(uuid, text, text) to authenticated, service_role;

create or replace function private.guard_expense_change()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if old.status = 'void' then raise exception using errcode = 'P0001', message = 'void_expense_immutable'; end if;
  if (to_jsonb(new) - 'status' - 'void_reason' - 'updated_at') is distinct from (to_jsonb(old) - 'status' - 'void_reason' - 'updated_at') then
    raise exception using errcode = 'P0001', message = 'expense_financial_fields_immutable';
  end if;
  if new.status = 'void' and (new.void_reason is null or char_length(btrim(new.void_reason)) < 2) then
    raise exception using errcode = '22023', message = 'expense_void_reason_required';
  end if;
  return new;
end;
$$;

create trigger teacher_payouts_set_updated_at before update on public.teacher_payouts
for each row execute function public.set_updated_at();
create trigger teacher_payouts_audit after insert or update on public.teacher_payouts
for each row execute function public.audit_row();
create trigger teacher_adjustments_audit after insert or delete on public.teacher_adjustments
for each row execute function public.audit_row();

alter table public.teacher_payouts enable row level security;
alter table public.teacher_adjustments enable row level security;
revoke all on public.teacher_payouts, public.teacher_adjustments from public, anon, authenticated;
grant select on public.teacher_payouts, public.teacher_adjustments to authenticated;
grant select, insert, update, delete on public.teacher_payouts, public.teacher_adjustments to service_role;
create policy teacher_payouts_admin_all on public.teacher_payouts for all to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));
create policy teacher_payouts_teacher_read on public.teacher_payouts for select to authenticated
using (teacher_id = (select private.current_teacher_id()));
create policy teacher_adjustments_admin_read on public.teacher_adjustments for select to authenticated
using ((select public.is_admin()));
create policy teacher_adjustments_teacher_read on public.teacher_adjustments for select to authenticated
using (exists (select 1 from public.teacher_payouts where id = teacher_adjustments.payout_id));

create or replace view public.my_earnings
with (security_invoker = true, security_barrier = true)
as
select payout.id, payout.payout_no, payout.teacher_id, payout.period_start, payout.period_end,
  payout.currency, payout.gross, payout.bonuses, payout.deductions, payout.net,
  payout.status, payout.approved_at, payout.paid_at, payout.payment_reference,
  count(item.id)::integer as session_count
from public.teacher_payouts as payout
left join public.teacher_payout_items as item on item.payout_id = payout.id
group by payout.id;
revoke all on public.my_earnings from public, anon;
grant select on public.my_earnings to authenticated, service_role;

create or replace function private.apply_attendance_effects(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  attendance_row public.attendance%rowtype; session_row public.sessions%rowtype;
  subscription_row public.subscriptions%rowtype; selected_rate public.teacher_rates%rowtype;
  track_value uuid; consume_credit boolean := false; pay_teacher boolean := false;
  timely_excuse boolean := false; grant_makeup boolean := false; outside_cap boolean := false;
  cancel_notice_hours integer; max_makeups integer; makeup_valid_days integer; capped_makeups integer;
  payout_kind text; target_status public.session_status; admin_profile record;
begin
  select * into attendance_row from public.attendance where session_id = p_session_id;
  select * into session_row from public.sessions where id = p_session_id for update;
  if attendance_row.session_id is null or session_row.id is null then raise exception using errcode = 'P0002', message = 'attendance_session_not_found'; end if;
  select subscription.* into subscription_row from public.subscriptions as subscription
  where subscription.student_id = session_row.student_id and subscription.status in ('trial','active')
    and session_row.scheduled_at::date between subscription.current_period_start and subscription.current_period_end
  order by subscription.current_period_start desc limit 1 for update;
  if subscription_row.id is null then raise exception using errcode = 'P0001', message = 'active_subscription_required'; end if;
  cancel_notice_hours := (subscription_row.policy_snapshot ->> 'cancel_notice_hours')::integer;
  max_makeups := (subscription_row.policy_snapshot ->> 'max_makeups_per_period')::integer;
  makeup_valid_days := (subscription_row.policy_snapshot ->> 'makeup_valid_days')::integer;
  timely_excuse := attendance_row.status = 'student_excused' and attendance_row.student_notice_at is not null and attendance_row.student_notice_at <= session_row.scheduled_at - pg_catalog.make_interval(hours => cancel_notice_hours);
  consume_credit := case attendance_row.status when 'present' then true when 'late' then true when 'student_absent' then (subscription_row.policy_snapshot ->> 'student_no_show_consumes_credit')::boolean when 'student_excused' then not timely_excuse and (subscription_row.policy_snapshot ->> 'student_no_show_consumes_credit')::boolean else false end;
  pay_teacher := case attendance_row.status when 'present' then true when 'late' then true when 'student_absent' then (subscription_row.policy_snapshot ->> 'student_no_show_pays_teacher')::boolean when 'student_excused' then not timely_excuse and (subscription_row.policy_snapshot ->> 'student_no_show_pays_teacher')::boolean else false end;
  target_status := case attendance_row.status when 'present' then 'held'::public.session_status when 'late' then 'held'::public.session_status when 'student_absent' then 'missed'::public.session_status when 'student_excused' then 'missed'::public.session_status when 'teacher_absent' then 'missed'::public.session_status else 'cancelled'::public.session_status end;
  update public.sessions set status = target_status, started_at = coalesce(started_at, attendance_row.teacher_joined_at), ended_at = case when attendance_row.teacher_joined_at is not null and attendance_row.minutes is not null then attendance_row.teacher_joined_at + pg_catalog.make_interval(mins => attendance_row.minutes) else ended_at end where id = p_session_id;
  if consume_credit then insert into public.session_credit_ledger(subscription_id, delta, reason, session_id, note, created_by) values (subscription_row.id, -1, 'consume', p_session_id, 'attendance_effect', attendance_row.recorded_by) on conflict (session_id) where reason = 'consume' do nothing; end if;
  if pay_teacher then
    if session_row.assignment_id is not null then select assignment.track_id into track_value from public.teacher_assignments as assignment where assignment.id = session_row.assignment_id; end if;
    select rate.* into selected_rate from public.teacher_rates as rate
    where rate.teacher_id = session_row.teacher_id and rate.valid_from <= session_row.scheduled_at::date
      and (rate.track_id is null or rate.track_id = track_value) and (rate.duration_min is null or rate.duration_min = session_row.duration_min)
    order by case when rate.track_id is not null and rate.duration_min is not null then 4 when rate.duration_min is not null then 3 when rate.track_id is not null then 2 else 1 end desc, rate.valid_from desc, rate.id limit 1;
    if selected_rate.id is null then raise exception using errcode = 'P0001', message = 'teacher_rate_missing'; end if;
    payout_kind := case when session_row.kind = 'makeup' then 'makeup' when session_row.original_teacher_id is not null and session_row.original_teacher_id <> session_row.teacher_id then 'substitute' when attendance_row.status in ('student_absent','student_excused') then 'no_show' else 'session' end;
    insert into public.teacher_payout_items(session_id, teacher_id, amount, currency, rate_snapshot, rate_id, kind)
    values (p_session_id, session_row.teacher_id, selected_rate.rate_per_session, selected_rate.currency, selected_rate.rate_per_session, selected_rate.id, payout_kind) on conflict (session_id) do nothing;
  end if;
  if timely_excuse then
    select count(*)::integer into capped_makeups from public.makeup_entitlements as entitlement where entitlement.subscription_id = subscription_row.id and not entitlement.outside_period_cap and entitlement.created_at::date between subscription_row.current_period_start and subscription_row.current_period_end;
    grant_makeup := capped_makeups < max_makeups;
  elsif attendance_row.status in ('teacher_absent','cancelled_teacher','cancelled_admin') then grant_makeup := true; outside_cap := true; end if;
  if grant_makeup then insert into public.makeup_entitlements(subscription_id, student_id, source_session_id, outside_period_cap, expires_at) values (subscription_row.id, session_row.student_id, p_session_id, outside_cap, attendance_row.recorded_at + pg_catalog.make_interval(days => makeup_valid_days)) on conflict (source_session_id) do nothing; end if;
  if attendance_row.status = 'student_absent' or (attendance_row.status = 'student_excused' and not timely_excuse) then perform private.notify_session_parties(session_row.student_id, 'student_absent', pg_catalog.jsonb_build_object('session_id', p_session_id)); end if;
  if attendance_row.status = 'teacher_absent' then
    for admin_profile in select profile.id from public.profiles as profile where profile.role = 'admin' and profile.is_active loop perform private.enqueue_notification(admin_profile.id, 'teacher_absent', pg_catalog.jsonb_build_object('session_id', p_session_id)); end loop;
    perform private.notify_session_parties(session_row.student_id, 'teacher_absent', pg_catalog.jsonb_build_object('session_id', p_session_id));
  end if;
end;
$$;
