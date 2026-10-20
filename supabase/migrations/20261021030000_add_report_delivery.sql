create or replace function private.notify_report_approved()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  recipient record;
begin
  if new.status = 'approved' and old.status = 'draft' then
    for recipient in
      select guardian.profile_id as user_id
      from public.student_guardians as link
      join public.guardians as guardian on guardian.id = link.guardian_id
      where link.student_id = new.student_id
    loop
      perform private.enqueue_notification(
        recipient.user_id,
        'report_approved',
        jsonb_build_object(
          'report_id', new.id,
          'student_id', new.student_id,
          'period_type', new.period_type,
          'period_start', new.period_start,
          'period_end', new.period_end
        )
      );
    end loop;
  end if;
  return new;
end;
$$;

revoke execute on function private.notify_report_approved() from public, anon, authenticated, service_role;

create trigger reports_notify_approved
after update of status on public.reports
for each row execute function private.notify_report_approved();
