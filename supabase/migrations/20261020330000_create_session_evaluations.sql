create table public.session_evaluations (
  id uuid primary key default gen_random_uuid(),
  session_id uuid unique not null references public.sessions(id) on delete restrict,
  session_type public.session_type_t not null,
  from_ayah_id integer references public.quran_ayahs(id) on delete restrict,
  to_ayah_id integer references public.quran_ayahs(id) on delete restrict,
  pages numeric(5, 2) check (pages is null or pages >= 0),
  lines_count integer check (lines_count is null or lines_count >= 0),
  scores jsonb not null,
  errors_major integer not null default 0 check (errors_major >= 0),
  errors_minor integer not null default 0 check (errors_minor >= 0),
  prompts_count integer not null default 0 check (prompts_count >= 0),
  forgot_count integer not null default 0 check (forgot_count >= 0),
  weak_tags text[] not null default '{}',
  decision text check (decision in ('passed', 'repeat', 'next')),
  homework jsonb,
  family_note text,
  settings_snapshot jsonb not null default '{}'::jsonb,
  total_score numeric(5, 2) not null default 0 check (total_score between 0 and 100),
  rating smallint not null default 1 check (rating between 1 and 5),
  is_locked boolean not null default false,
  locked_at timestamptz,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (from_ayah_id is null or to_ayah_id is null or from_ayah_id <= to_ayah_id),
  check ((is_locked and locked_at is not null) or (not is_locked and locked_at is null)),
  check (jsonb_typeof(scores) = 'object'),
  check (homework is null or jsonb_typeof(homework) = 'object')
);

create index session_evaluations_created_by_idx
on public.session_evaluations (created_by, created_at desc);

create or replace function private.prepare_session_evaluation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  session_row public.sessions%rowtype;
  settings_row public.eval_settings%rowtype;
  score_entry record;
  score_value numeric;
  criterion_weight numeric;
  weighted_sum numeric := 0;
  total_weight numeric := 0;
  deduction numeric;
  computed_total numeric;
  thresholds numeric[];
  snapshot_weights jsonb := '{}'::jsonb;
begin
  if tg_op = 'UPDATE'
    and old.is_locked
    and (select auth.uid()) is not null
    and not (select public.is_admin()) then
    raise exception using errcode = 'P0001', message = 'evaluation_locked';
  end if;

  select session.* into session_row
  from public.sessions as session
  where session.id = new.session_id;

  if not found then
    raise exception using errcode = '23503', message = 'evaluation_session_not_found';
  end if;

  if (select auth.uid()) is not null and not (select public.is_admin()) then
    if session_row.teacher_id is distinct from (select private.current_teacher_id())
      or new.created_by is distinct from (select auth.uid()) then
      raise exception using errcode = '42501', message = 'evaluation_forbidden';
    end if;

    if tg_op = 'UPDATE' and (
      new.session_id is distinct from old.session_id
      or new.created_by is distinct from old.created_by
    ) then
      raise exception using errcode = '42501', message = 'evaluation_identity_immutable';
    end if;
  end if;

  if new.from_ayah_id is null and new.to_ayah_id is not null
    or new.from_ayah_id is not null and new.to_ayah_id is null then
    raise exception using errcode = '23514', message = 'evaluation_ayah_range_incomplete';
  end if;

  if jsonb_typeof(new.scores) <> 'object' or new.scores = '{}'::jsonb then
    raise exception using errcode = '23514', message = 'evaluation_scores_required';
  end if;

  select settings.* into strict settings_row
  from public.eval_settings as settings
  where settings.session_type = new.session_type;

  for score_entry in select key, value from jsonb_each(new.scores)
  loop
    if jsonb_typeof(score_entry.value) <> 'number' then
      raise exception using errcode = '23514', message = 'evaluation_score_invalid';
    end if;

    begin
      score_value := (score_entry.value #>> '{}')::numeric;
    exception when others then
      raise exception using errcode = '23514', message = 'evaluation_score_invalid';
    end;

    if score_value <> trunc(score_value) or score_value < 1 or score_value > 5 then
      raise exception using errcode = '23514', message = 'evaluation_score_out_of_range';
    end if;

    select weight.weight into criterion_weight
    from public.eval_weights as weight
    join public.eval_criteria as criterion on criterion.code = weight.criterion_code
    where weight.session_type = new.session_type
      and weight.criterion_code = score_entry.key
      and new.session_type = any(criterion.applies_to);

    if criterion_weight is null then
      raise exception using errcode = '23514', message = 'evaluation_criterion_not_applicable';
    end if;

    weighted_sum := weighted_sum + score_value * criterion_weight;
    total_weight := total_weight + criterion_weight;
    snapshot_weights := snapshot_weights || jsonb_build_object(score_entry.key, criterion_weight);
  end loop;

  if total_weight <= 0 then
    raise exception using errcode = '23514', message = 'evaluation_total_weight_invalid';
  end if;

  deduction :=
    new.errors_major * settings_row.d_major
    + new.errors_minor * settings_row.d_minor
    + new.prompts_count * settings_row.d_prompt
    + new.forgot_count * settings_row.d_forgot;
  computed_total := greatest(0, least(100, (weighted_sum / total_weight) * 20 - deduction));
  thresholds := array(select (value #>> '{}')::numeric from jsonb_array_elements(settings_row.rating_thresholds));

  new.total_score := round(computed_total, 2);
  new.rating := case
    when computed_total >= thresholds[5] then 5
    when computed_total >= thresholds[4] then 4
    when computed_total >= thresholds[3] then 3
    when computed_total >= thresholds[2] then 2
    else 1
  end;
  new.settings_snapshot := jsonb_build_object(
    'session_type', new.session_type,
    'weights', snapshot_weights,
    'deductions', jsonb_build_object(
      'major', settings_row.d_major,
      'minor', settings_row.d_minor,
      'prompt', settings_row.d_prompt,
      'forgot', settings_row.d_forgot
    ),
    'rating_thresholds', settings_row.rating_thresholds
  );

  if new.is_locked then
    if tg_op = 'INSERT' then
      new.locked_at := pg_catalog.clock_timestamp();
    else
      new.locked_at := coalesce(old.locked_at, pg_catalog.clock_timestamp());
    end if;
  else
    new.locked_at := null;
  end if;

  return new;
end;
$$;

revoke execute on function private.prepare_session_evaluation() from public, anon, authenticated, service_role;

create trigger session_evaluations_prepare
before insert or update on public.session_evaluations
for each row execute function private.prepare_session_evaluation();

create trigger session_evaluations_set_updated_at
before update on public.session_evaluations
for each row execute function public.set_updated_at();

create trigger session_evaluations_audit
after insert or update or delete on public.session_evaluations
for each row execute function public.audit_row();

alter table public.session_evaluations enable row level security;

revoke all on table public.session_evaluations from public, anon, authenticated, service_role;
grant select, insert, update, delete on table public.session_evaluations to authenticated;
grant select on table public.session_evaluations to service_role;

create policy session_evaluations_admin_all on public.session_evaluations
for all to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

create policy session_evaluations_teacher_read on public.session_evaluations
for select to authenticated
using (exists (
  select 1 from public.sessions as session
  where session.id = session_evaluations.session_id
    and session.teacher_id = (select private.current_teacher_id())
));

create policy session_evaluations_teacher_insert on public.session_evaluations
for insert to authenticated
with check (
  created_by = (select auth.uid())
  and exists (
    select 1 from public.sessions as session
    where session.id = session_evaluations.session_id
      and session.teacher_id = (select private.current_teacher_id())
  )
);

create policy session_evaluations_teacher_update on public.session_evaluations
for update to authenticated
using (
  not is_locked
  and created_by = (select auth.uid())
  and exists (
    select 1 from public.sessions as session
    where session.id = session_evaluations.session_id
      and session.teacher_id = (select private.current_teacher_id())
  )
)
with check (
  created_by = (select auth.uid())
  and exists (
    select 1 from public.sessions as session
    where session.id = session_evaluations.session_id
      and session.teacher_id = (select private.current_teacher_id())
  )
);

create policy session_evaluations_student_read on public.session_evaluations
for select to authenticated
using (exists (
  select 1 from public.sessions as session
  join public.students as student on student.id = session.student_id
  where session.id = session_evaluations.session_id
    and student.profile_id = (select auth.uid())
));

create policy session_evaluations_parent_read on public.session_evaluations
for select to authenticated
using (exists (
  select 1 from public.sessions as session
  where session.id = session_evaluations.session_id
    and (select private.guards_student(session.student_id))
));
