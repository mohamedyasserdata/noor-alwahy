create or replace function public.set_memorization_review_schedule()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  intervals constant smallint[] := array[1, 3, 7, 14, 30, 60, 90]::smallint[];
  schedule_from date;
begin
  if new.status = 'in_progress' then
    new.next_review_due = null;
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.review_count > 0 and new.last_reviewed_at is not null then
      schedule_from := new.last_reviewed_at::date;
      if new.status = 'needs_review' then
        new.review_stage = 0;
      elsif new.status = 'mastered' then
        new.review_stage = least(new.review_stage + 1, 6);
      end if;
    elsif new.status = 'mastered' and new.first_memorized_at is not null then
      schedule_from := new.first_memorized_at::date;
      new.review_stage = 0;
    end if;
  elsif new.review_count > old.review_count and new.last_reviewed_at is not null then
    schedule_from := new.last_reviewed_at::date;
    if new.status = 'needs_review' then
      new.review_stage = 0;
    elsif new.status = 'mastered' then
      new.review_stage = least(old.review_stage + 1, 6);
    end if;
  elsif new.status = 'mastered'
    and old.status is distinct from new.status
    and new.first_memorized_at is not null then
    schedule_from := new.first_memorized_at::date;
    new.review_stage = 0;
  end if;

  if schedule_from is not null then
    new.next_review_due = schedule_from + intervals[new.review_stage + 1];
  end if;

  return new;
end;
$$;

revoke execute on function public.set_memorization_review_schedule() from public, anon, authenticated, service_role;

create trigger memorization_progress_review_schedule
before insert or update on public.memorization_progress
for each row execute function public.set_memorization_review_schedule();

create view public.v_review_queue
with (security_invoker = true)
as
with eligible as (
  select
    progress.student_id,
    progress.page,
    progress.status,
    progress.review_stage,
    progress.next_review_due,
    (array[1, 3, 7, 14, 30, 60, 90]::smallint[])[progress.review_stage + 1] as interval_days,
    (current_date - progress.next_review_due)::integer as days_overdue,
    row_number() over (
      partition by progress.student_id
      order by progress.next_review_due, progress.page
    ) as queue_position
  from public.memorization_progress as progress
  where progress.status in ('mastered', 'needs_review')
    and progress.next_review_due <= current_date
)
select
  eligible.student_id,
  eligible.page,
  eligible.status,
  eligible.review_stage,
  eligible.next_review_due,
  eligible.interval_days,
  eligible.days_overdue,
  eligible.days_overdue > eligible.interval_days * 2 as is_overdue,
  eligible.queue_position
from eligible
where eligible.queue_position <= 10;

revoke all on table public.v_review_queue from public, anon, authenticated, service_role;
grant select on table public.v_review_queue to authenticated, service_role;
