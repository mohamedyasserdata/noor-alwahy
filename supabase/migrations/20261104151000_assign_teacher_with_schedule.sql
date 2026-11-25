create or replace function public.assign_teacher_with_schedule(
  p_student uuid,
  p_teacher uuid,
  p_track uuid,
  p_reason text,
  p_action text,
  p_weekdays smallint[],
  p_local_start_time time,
  p_duration_min integer,
  p_create_schedule boolean default true
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare managed_id uuid; weekday_value smallint; distinct_days integer;
begin
  if not public.is_admin() then
    raise exception using errcode='42501',message='admin_access_required';
  end if;
  select count(distinct value) into distinct_days from unnest(p_weekdays) as day(value);
  if distinct_days < 1 or distinct_days > 7
    or exists(select 1 from unnest(p_weekdays) as day(value) where value not between 0 and 6)
    or p_duration_min not between 10 and 120 then
    raise exception using errcode='22023',message='assignment_schedule_invalid';
  end if;

  if p_create_schedule and exists (
    select 1
    from public.schedule_slots slot
    join public.teacher_assignments assignment on assignment.id=slot.assignment_id
    where assignment.teacher_id=p_teacher
      and assignment.status='active'
      and slot.is_active
      and slot.weekday=any(p_weekdays)
      and slot.local_start_time < p_local_start_time + make_interval(mins => p_duration_min)
      and slot.local_start_time + make_interval(mins => slot.duration_min) > p_local_start_time
  ) then
    raise exception using errcode='23P01',message='weekly_schedule_conflict';
  end if;

  managed_id := public.manage_teacher_assignment(
    p_student,p_teacher,p_track,p_reason,p_action
  );

  if p_create_schedule then
    foreach weekday_value in array p_weekdays loop
      insert into public.schedule_slots(
        assignment_id,weekday,local_start_time,duration_min,anchor_timezone
      ) values (
        managed_id,weekday_value,p_local_start_time,p_duration_min,'Africa/Cairo'
      );
    end loop;
  end if;
  return managed_id;
end;
$$;
revoke execute on function public.assign_teacher_with_schedule(uuid,uuid,uuid,text,text,smallint[],time,integer,boolean) from public,anon;
grant execute on function public.assign_teacher_with_schedule(uuid,uuid,uuid,text,text,smallint[],time,integer,boolean) to authenticated,service_role;
