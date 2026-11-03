create or replace function private.apply_attendance_effects(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  attendance_row public.attendance%rowtype;
  session_row public.sessions%rowtype;
  subscription_row public.subscriptions%rowtype;
  selected_rate public.teacher_rates%rowtype;
  track_value uuid;
  consume_credit boolean := false;
  pay_teacher boolean := false;
  timely_excuse boolean := false;
  grant_makeup boolean := false;
  outside_cap boolean := false;
  cancel_notice_hours integer;
  max_makeups integer;
  makeup_valid_days integer;
  capped_makeups integer;
  payout_kind text;
  target_status public.session_status;
  admin_profile record;
begin
  select * into attendance_row
  from public.attendance
  where session_id = p_session_id;

  select * into session_row
  from public.sessions
  where id = p_session_id
  for update;

  if attendance_row.session_id is null or session_row.id is null then
    raise exception using errcode = 'P0002', message = 'attendance_session_not_found';
  end if;

  select subscription.* into subscription_row
  from public.subscriptions as subscription
  where subscription.student_id = session_row.student_id
    and subscription.status in ('trial', 'active')
    and session_row.scheduled_at::date between subscription.current_period_start and subscription.current_period_end
  order by subscription.current_period_start desc
  limit 1
  for update;

  if subscription_row.id is null then
    raise exception using errcode = 'P0001', message = 'active_subscription_required';
  end if;

  cancel_notice_hours := (subscription_row.policy_snapshot ->> 'cancel_notice_hours')::integer;
  max_makeups := (subscription_row.policy_snapshot ->> 'max_makeups_per_period')::integer;
  makeup_valid_days := (subscription_row.policy_snapshot ->> 'makeup_valid_days')::integer;
  timely_excuse := attendance_row.status = 'student_excused'
    and attendance_row.student_notice_at is not null
    and attendance_row.student_notice_at <= session_row.scheduled_at - pg_catalog.make_interval(hours => cancel_notice_hours);

  consume_credit := case attendance_row.status
    when 'present' then true
    when 'late' then true
    when 'student_absent' then (subscription_row.policy_snapshot ->> 'student_no_show_consumes_credit')::boolean
    when 'student_excused' then not timely_excuse and (subscription_row.policy_snapshot ->> 'student_no_show_consumes_credit')::boolean
    else false
  end;

  pay_teacher := case attendance_row.status
    when 'present' then true
    when 'late' then true
    when 'student_absent' then (subscription_row.policy_snapshot ->> 'student_no_show_pays_teacher')::boolean
    when 'student_excused' then not timely_excuse and (subscription_row.policy_snapshot ->> 'student_no_show_pays_teacher')::boolean
    else false
  end;

  target_status := case attendance_row.status
    when 'present' then 'held'::public.session_status
    when 'late' then 'held'::public.session_status
    when 'student_absent' then 'missed'::public.session_status
    when 'student_excused' then 'missed'::public.session_status
    when 'teacher_absent' then 'missed'::public.session_status
    else 'cancelled'::public.session_status
  end;

  update public.sessions
  set status = target_status,
      started_at = coalesce(started_at, attendance_row.teacher_joined_at),
      ended_at = case
        when attendance_row.teacher_joined_at is not null and attendance_row.minutes is not null
          then attendance_row.teacher_joined_at + pg_catalog.make_interval(mins => attendance_row.minutes)
        else ended_at
      end
  where id = p_session_id;

  if consume_credit then
    insert into public.session_credit_ledger (
      subscription_id, delta, reason, session_id, note, created_by
    )
    values (
      subscription_row.id, -1, 'consume', p_session_id, 'attendance_effect', attendance_row.recorded_by
    )
    on conflict (session_id) where reason = 'consume' do nothing;
  end if;

  if pay_teacher then
    if session_row.assignment_id is not null then
      select assignment.track_id into track_value
      from public.teacher_assignments as assignment
      where assignment.id = session_row.assignment_id;
    end if;

    select rate.* into selected_rate
    from public.teacher_rates as rate
    where rate.teacher_id = session_row.teacher_id
      and rate.valid_from <= session_row.scheduled_at::date
      and (rate.track_id is null or rate.track_id = track_value)
      and (rate.duration_min is null or rate.duration_min = session_row.duration_min)
    order by
      ((rate.track_id is not null)::integer + (rate.duration_min is not null)::integer) desc,
      rate.valid_from desc,
      rate.id
    limit 1;

    if selected_rate.id is null then
      raise exception using errcode = 'P0001', message = 'teacher_rate_missing';
    end if;

    payout_kind := case
      when session_row.kind = 'makeup' then 'makeup'
      when session_row.original_teacher_id is not null and session_row.original_teacher_id <> session_row.teacher_id then 'substitute'
      when attendance_row.status in ('student_absent', 'student_excused') then 'no_show'
      else 'session'
    end;

    insert into public.teacher_payout_items (
      session_id, teacher_id, amount, currency, rate_snapshot, kind
    )
    values (
      p_session_id, session_row.teacher_id, selected_rate.rate_per_session,
      selected_rate.currency, selected_rate.rate_per_session, payout_kind
    )
    on conflict (session_id) do nothing;
  end if;

  if timely_excuse then
    select count(*)::integer into capped_makeups
    from public.makeup_entitlements as entitlement
    join public.sessions as source_session
      on source_session.id = entitlement.source_session_id
    where entitlement.subscription_id = subscription_row.id
      and not entitlement.outside_period_cap
      and source_session.scheduled_at::date between
        subscription_row.current_period_start and subscription_row.current_period_end;

    grant_makeup := capped_makeups < max_makeups;
  elsif attendance_row.status in ('teacher_absent', 'cancelled_teacher', 'cancelled_admin') then
    grant_makeup := true;
    outside_cap := true;
  end if;

  if grant_makeup then
    insert into public.makeup_entitlements (
      subscription_id, student_id, source_session_id, outside_period_cap, expires_at
    )
    values (
      subscription_row.id,
      session_row.student_id,
      p_session_id,
      outside_cap,
      attendance_row.recorded_at + pg_catalog.make_interval(days => makeup_valid_days)
    )
    on conflict (source_session_id) do nothing;
  end if;

  if attendance_row.status = 'student_absent'
    or (attendance_row.status = 'student_excused' and not timely_excuse) then
    perform private.notify_session_parties(
      session_row.student_id,
      'student_absent',
      pg_catalog.jsonb_build_object('session_id', p_session_id)
    );
  end if;

  if attendance_row.status = 'teacher_absent' then
    for admin_profile in
      select profile.id
      from public.profiles as profile
      where profile.role = 'admin' and profile.is_active
    loop
      perform private.enqueue_notification(
        admin_profile.id,
        'teacher_absent',
        pg_catalog.jsonb_build_object('session_id', p_session_id)
      );
    end loop;

    perform private.notify_session_parties(
      session_row.student_id,
      'teacher_absent',
      pg_catalog.jsonb_build_object('session_id', p_session_id)
    );
  end if;
end;
$$;

revoke execute on function private.apply_attendance_effects(uuid)
from public, anon, authenticated, service_role;
