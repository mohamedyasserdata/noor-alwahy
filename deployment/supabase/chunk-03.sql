-- Generated staging deployment bundle. Source of truth remains supabase/migrations/.
-- BEGIN MIGRATION 20261020310000_create_evaluation_settings.sql
create table public.eval_criteria (
  code text primary key,
  name_ar text not null,
  name_en text not null,
  applies_to public.session_type_t[] not null,
  sort_order integer not null default 0,
  constraint eval_criteria_code_format check (code ~ '^[a-z][a-z0-9_]*$'),
  constraint eval_criteria_name_ar_not_blank check (btrim(name_ar) <> ''),
  constraint eval_criteria_name_en_not_blank check (btrim(name_en) <> ''),
  constraint eval_criteria_applies_to_not_empty check (cardinality(applies_to) > 0),
  constraint eval_criteria_sort_order_nonnegative check (sort_order >= 0)
);

create table public.eval_weights (
  session_type public.session_type_t not null,
  criterion_code text not null references public.eval_criteria(code) on update cascade,
  weight numeric(5, 2) not null,
  primary key (session_type, criterion_code),
  constraint eval_weights_weight_nonnegative check (weight >= 0)
);

create or replace function private.is_valid_rating_thresholds(p_thresholds jsonb)
returns boolean
language plpgsql
immutable
strict
set search_path = ''
as $$
declare
  threshold jsonb;
  values_numeric numeric[] := array[]::numeric[];
begin
  if jsonb_typeof(p_thresholds) <> 'array' or jsonb_array_length(p_thresholds) <> 5 then
    return false;
  end if;

  for threshold in select value from jsonb_array_elements(p_thresholds)
  loop
    if jsonb_typeof(threshold) <> 'number' then
      return false;
    end if;
    values_numeric := array_append(values_numeric, (threshold #>> '{}')::numeric);
  end loop;

  return values_numeric[1] >= 0
    and values_numeric[5] <= 100
    and values_numeric[1] < values_numeric[2]
    and values_numeric[2] < values_numeric[3]
    and values_numeric[3] < values_numeric[4]
    and values_numeric[4] < values_numeric[5];
exception
  when others then
    return false;
end;
$$;

revoke execute on function private.is_valid_rating_thresholds(jsonb) from public, anon, authenticated, service_role;

create table public.eval_settings (
  session_type public.session_type_t primary key,
  d_major numeric(5, 2) not null default 2,
  d_minor numeric(5, 2) not null default 0.5,
  d_prompt numeric(5, 2) not null default 0.5,
  d_forgot numeric(5, 2) not null default 1,
  rating_thresholds jsonb not null default '[0,30,50,70,90]'::jsonb,
  constraint eval_settings_d_major_nonnegative check (d_major >= 0),
  constraint eval_settings_d_minor_nonnegative check (d_minor >= 0),
  constraint eval_settings_d_prompt_nonnegative check (d_prompt >= 0),
  constraint eval_settings_d_forgot_nonnegative check (d_forgot >= 0),
  constraint eval_settings_rating_thresholds_valid check (private.is_valid_rating_thresholds(rating_thresholds))
);

create or replace function private.ensure_eval_weight_applicable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.eval_criteria
    where code = new.criterion_code
      and new.session_type = any(applies_to)
  ) then
    raise exception using errcode = '23514', message = 'criterion_not_applicable';
  end if;

  return new;
end;
$$;

revoke execute on function private.ensure_eval_weight_applicable() from public, anon, authenticated, service_role;

create trigger eval_weights_applicability
before insert or update of session_type, criterion_code on public.eval_weights
for each row execute function private.ensure_eval_weight_applicable();

create or replace function private.prevent_invalid_eval_criterion_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.eval_weights
    where criterion_code = new.code
      and not (session_type = any(new.applies_to))
  ) then
    raise exception using errcode = '23514', message = 'criterion_has_inapplicable_weights';
  end if;

  return new;
end;
$$;

revoke execute on function private.prevent_invalid_eval_criterion_change() from public, anon, authenticated, service_role;

create trigger eval_criteria_preserve_weight_applicability
before update of code, applies_to on public.eval_criteria
for each row execute function private.prevent_invalid_eval_criterion_change();

insert into public.eval_criteria (code, name_ar, name_en, applies_to, sort_order)
values
  ('memorization', 'الحفظ', 'Memorization', array['new_memo','near_review','far_review','matn_theory']::public.session_type_t[], 10),
  ('tajweed_applied', 'تطبيق أحكام التجويد', 'Applied Tajweed', array['new_memo','near_review','far_review','recitation','noorani']::public.session_type_t[], 20),
  ('makharij', 'المخارج والصفات', 'Makharij and Sifat', array['new_memo','near_review','far_review','recitation','noorani']::public.session_type_t[], 30),
  ('waqf_ibtida', 'الوقف والابتداء', 'Waqf and Ibtida', array['new_memo','near_review','far_review','recitation']::public.session_type_t[], 40),
  ('fluency', 'الطلاقة', 'Fluency', array['new_memo','near_review','far_review','recitation','noorani']::public.session_type_t[], 50),
  ('linking_mutashabihat', 'ربط المتشابهات', 'Linking Mutashabihat', array['new_memo','near_review','far_review']::public.session_type_t[], 60),
  ('commitment', 'الالتزام', 'Commitment', enum_range(null::public.session_type_t), 70),
  ('theory_understanding', 'الفهم النظري', 'Theory Understanding', array['matn_theory']::public.session_type_t[], 80);

insert into public.eval_weights (session_type, criterion_code, weight)
select applicable_session_type, code, 1
from public.eval_criteria
cross join lateral unnest(applies_to) as applicable_session_type;

insert into public.eval_settings (session_type)
select unnest(enum_range(null::public.session_type_t));

create trigger eval_criteria_audit
after insert or update or delete on public.eval_criteria
for each row execute function public.audit_row();

create trigger eval_weights_audit
after insert or update or delete on public.eval_weights
for each row execute function public.audit_row();

create trigger eval_settings_audit
after insert or update or delete on public.eval_settings
for each row execute function public.audit_row();

alter table public.eval_criteria enable row level security;
alter table public.eval_weights enable row level security;
alter table public.eval_settings enable row level security;

revoke all on table public.eval_criteria, public.eval_weights, public.eval_settings from public, anon, authenticated, service_role;
grant select on table public.eval_criteria, public.eval_weights, public.eval_settings to authenticated, service_role;
grant insert, update, delete on table public.eval_criteria, public.eval_weights, public.eval_settings to authenticated;

create policy eval_criteria_authenticated_read on public.eval_criteria
for select to authenticated using (true);
create policy eval_criteria_admin_insert on public.eval_criteria
for insert to authenticated with check ((select public.is_admin()));
create policy eval_criteria_admin_update on public.eval_criteria
for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy eval_criteria_admin_delete on public.eval_criteria
for delete to authenticated using ((select public.is_admin()));

create policy eval_weights_authenticated_read on public.eval_weights
for select to authenticated using (true);
create policy eval_weights_admin_insert on public.eval_weights
for insert to authenticated with check ((select public.is_admin()));
create policy eval_weights_admin_update on public.eval_weights
for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy eval_weights_admin_delete on public.eval_weights
for delete to authenticated using ((select public.is_admin()));

create policy eval_settings_authenticated_read on public.eval_settings
for select to authenticated using (true);
create policy eval_settings_admin_insert on public.eval_settings
for insert to authenticated with check ((select public.is_admin()));
create policy eval_settings_admin_update on public.eval_settings
for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy eval_settings_admin_delete on public.eval_settings
for delete to authenticated using ((select public.is_admin()));

insert into supabase_migrations.schema_migrations(version, statements, name) values ('20261020310000', array[]::text[], 'create_evaluation_settings') on conflict (version) do nothing;
-- END MIGRATION 20261020310000_create_evaluation_settings.sql
-- BEGIN MIGRATION 20261020320000_add_evaluation_settings_update_rpc.sql
create or replace function private.ensure_positive_eval_weight_total()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  target_session_type public.session_type_t;
begin
  target_session_type := coalesce(new.session_type, old.session_type);

  if not exists (
    select 1
    from public.eval_weights
    where session_type = target_session_type
    having sum(weight) > 0
  ) then
    raise exception using errcode = '23514', message = 'evaluation_weight_total_must_be_positive';
  end if;

  return null;
end;
$$;

revoke execute on function private.ensure_positive_eval_weight_total()
from public, anon, authenticated, service_role;

create constraint trigger eval_weights_positive_total
after insert or update or delete on public.eval_weights
deferrable initially immediate
for each row execute function private.ensure_positive_eval_weight_total();

create or replace function public.update_evaluation_settings(
  p_session_type public.session_type_t,
  p_d_major numeric,
  p_d_minor numeric,
  p_d_prompt numeric,
  p_d_forgot numeric,
  p_rating_thresholds jsonb,
  p_weights jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  expected_codes text[];
  supplied_codes text[];
  weight_entry record;
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'evaluation_settings_forbidden';
  end if;

  if p_d_major < 0 or p_d_minor < 0 or p_d_prompt < 0 or p_d_forgot < 0 then
    raise exception using errcode = '22023', message = 'evaluation_deductions_invalid';
  end if;

  if not private.is_valid_rating_thresholds(p_rating_thresholds) then
    raise exception using errcode = '22023', message = 'evaluation_thresholds_invalid';
  end if;

  if jsonb_typeof(p_weights) <> 'object' then
    raise exception using errcode = '22023', message = 'evaluation_weights_invalid';
  end if;

  select array_agg(code order by code)
  into expected_codes
  from public.eval_criteria
  where p_session_type = any(applies_to);

  select array_agg(key order by key)
  into supplied_codes
  from jsonb_object_keys(p_weights) as keys(key);

  if expected_codes is null or supplied_codes is distinct from expected_codes then
    raise exception using errcode = '22023', message = 'evaluation_weights_mismatch';
  end if;

  for weight_entry in select key, value from jsonb_each(p_weights)
  loop
    if jsonb_typeof(weight_entry.value) <> 'number'
      or (weight_entry.value #>> '{}')::numeric < 0 then
      raise exception using errcode = '22023', message = 'evaluation_weights_invalid';
    end if;
  end loop;

  if not exists (
    select 1
    from jsonb_each_text(p_weights)
    having sum(value::numeric) > 0
  ) then
    raise exception using errcode = '22023', message = 'evaluation_weight_total_must_be_positive';
  end if;

  update public.eval_settings
  set d_major = p_d_major,
      d_minor = p_d_minor,
      d_prompt = p_d_prompt,
      d_forgot = p_d_forgot,
      rating_thresholds = p_rating_thresholds
  where session_type = p_session_type;

  if not found then
    raise exception using errcode = 'P0002', message = 'evaluation_settings_missing';
  end if;

  update public.eval_weights as weights
  set weight = (p_weights ->> weights.criterion_code)::numeric
  where weights.session_type = p_session_type;
end;
$$;

revoke all on function public.update_evaluation_settings(
  public.session_type_t,
  numeric,
  numeric,
  numeric,
  numeric,
  jsonb,
  jsonb
) from public, anon, service_role;
grant execute on function public.update_evaluation_settings(
  public.session_type_t,
  numeric,
  numeric,
  numeric,
  numeric,
  jsonb,
  jsonb
) to authenticated;


insert into supabase_migrations.schema_migrations(version, statements, name) values ('20261020320000', array[]::text[], 'add_evaluation_settings_update_rpc') on conflict (version) do nothing;
-- END MIGRATION 20261020320000_add_evaluation_settings_update_rpc.sql
-- BEGIN MIGRATION 20261020330000_create_session_evaluations.sql
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

insert into supabase_migrations.schema_migrations(version, statements, name) values ('20261020330000', array[]::text[], 'create_session_evaluations') on conflict (version) do nothing;
-- END MIGRATION 20261020330000_create_session_evaluations.sql
-- BEGIN MIGRATION 20261020350000_add_memorization_progress.sql
create table public.memorization_progress (
  student_id uuid not null references public.students(id) on delete cascade,
  page smallint not null references public.quran_pages(page) on delete restrict,
  status public.progress_status not null default 'not_started',
  first_memorized_at timestamptz,
  last_reviewed_at timestamptz,
  avg_score numeric(5, 2) check (avg_score is null or avg_score between 0 and 100),
  review_count integer not null default 0 check (review_count >= 0),
  review_stage smallint not null default 0 check (review_stage between 0 and 6),
  next_review_due date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (student_id, page),
  constraint memorization_progress_review_average_consistent check (
    (review_count = 0 and avg_score is null)
    or (review_count > 0 and avg_score is not null)
  )
);

create index memorization_progress_student_due_idx
on public.memorization_progress (student_id, next_review_due);
create index memorization_progress_student_status_idx
on public.memorization_progress (student_id, status);
create index memorization_progress_page_idx
on public.memorization_progress (page);

create table private.evaluation_progress_applications (
  evaluation_id uuid not null references public.session_evaluations(id) on delete cascade,
  page smallint not null references public.quran_pages(page) on delete restrict,
  applied_at timestamptz not null default now(),
  primary key (evaluation_id, page)
);

create index evaluation_progress_applications_page_idx
on private.evaluation_progress_applications (page);

revoke all on table private.evaluation_progress_applications from public, anon, authenticated, service_role;

create or replace function public.apply_evaluation_to_progress()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  progress_student_id uuid;
  page_row record;
  application_inserted integer;
  is_review boolean;
  is_full_page boolean;
  next_status public.progress_status;
  applied_at timestamptz;
begin
  if not new.is_locked
    or new.from_ayah_id is null
    or new.to_ayah_id is null
    or new.session_type not in ('new_memo', 'near_review', 'far_review', 'recitation') then
    return new;
  end if;

  select session.student_id
  into strict progress_student_id
  from public.sessions as session
  where session.id = new.session_id;

  is_review := new.session_type in ('near_review', 'far_review', 'recitation');
  applied_at := coalesce(new.locked_at, pg_catalog.clock_timestamp());

  for page_row in
    select page.page, page.first_ayah_id, page.last_ayah_id
    from public.quran_pages as page
    where page.first_ayah_id <= new.to_ayah_id
      and page.last_ayah_id >= new.from_ayah_id
    order by page.page
  loop
    insert into private.evaluation_progress_applications (evaluation_id, page)
    values (new.id, page_row.page)
    on conflict do nothing;
    get diagnostics application_inserted = row_count;

    if application_inserted = 0 then
      continue;
    end if;

    is_full_page := page_row.first_ayah_id >= new.from_ayah_id
      and page_row.last_ayah_id <= new.to_ayah_id;

    if new.session_type = 'new_memo' then
      next_status := case
        when is_full_page and new.decision = 'passed' and new.rating >= 3 then 'mastered'::public.progress_status
        else 'in_progress'::public.progress_status
      end;

      insert into public.memorization_progress (
        student_id,
        page,
        status,
        first_memorized_at
      )
      values (
        progress_student_id,
        page_row.page,
        next_status,
        case when next_status = 'mastered' then applied_at else null end
      )
      on conflict (student_id, page) do update
      set status = excluded.status,
          first_memorized_at = case
            when excluded.status = 'mastered' then coalesce(public.memorization_progress.first_memorized_at, excluded.first_memorized_at)
            else public.memorization_progress.first_memorized_at
          end;
    elsif is_review then
      next_status := case
        when not is_full_page then 'in_progress'::public.progress_status
        when new.rating <= 2 then 'needs_review'::public.progress_status
        else 'mastered'::public.progress_status
      end;

      insert into public.memorization_progress (
        student_id,
        page,
        status,
        last_reviewed_at,
        avg_score,
        review_count
      )
      values (
        progress_student_id,
        page_row.page,
        next_status,
        applied_at,
        new.total_score,
        1
      )
      on conflict (student_id, page) do update
      set status = excluded.status,
          last_reviewed_at = excluded.last_reviewed_at,
          avg_score = round(
            (
              coalesce(public.memorization_progress.avg_score, 0)
              * public.memorization_progress.review_count
              + excluded.avg_score
            ) / (public.memorization_progress.review_count + 1),
            2
          ),
          review_count = public.memorization_progress.review_count + 1;
    end if;
  end loop;

  return new;
end;
$$;

revoke execute on function public.apply_evaluation_to_progress() from public, anon, authenticated, service_role;

create trigger session_evaluations_apply_progress
after insert or update on public.session_evaluations
for each row
when (new.is_locked)
execute function public.apply_evaluation_to_progress();

create trigger memorization_progress_set_updated_at
before update on public.memorization_progress
for each row execute function public.set_updated_at();

create trigger memorization_progress_audit
after insert or update or delete on public.memorization_progress
for each row execute function public.audit_row();

alter table public.memorization_progress enable row level security;
alter table public.memorization_progress replica identity full;

revoke all on table public.memorization_progress from public, anon, authenticated, service_role;
grant select on table public.memorization_progress to authenticated, service_role;

create policy memorization_progress_admin_read on public.memorization_progress
for select to authenticated
using ((select public.is_admin()));

create policy memorization_progress_teacher_read on public.memorization_progress
for select to authenticated
using ((select private.teaches_student(student_id)));

create policy memorization_progress_student_read on public.memorization_progress
for select to authenticated
using (exists (
  select 1
  from public.students as student
  where student.id = memorization_progress.student_id
    and student.profile_id = (select auth.uid())
));

create policy memorization_progress_parent_read on public.memorization_progress
for select to authenticated
using ((select private.guards_student(student_id)));

create view public.v_surah_progress
with (security_invoker = true)
as
with page_surahs as (
  select distinct ayah.page, ayah.surah_id
  from public.quran_ayahs as ayah
)
select
  progress.student_id,
  page_surahs.surah_id,
  count(*)::integer as tracked_pages,
  count(*) filter (where progress.status = 'in_progress')::integer as in_progress_pages,
  count(*) filter (where progress.status = 'mastered')::integer as mastered_pages,
  count(*) filter (where progress.status = 'needs_review')::integer as needs_review_pages,
  round(avg(progress.avg_score), 2) as avg_score,
  max(progress.last_reviewed_at) as last_reviewed_at
from public.memorization_progress as progress
join page_surahs on page_surahs.page = progress.page
group by progress.student_id, page_surahs.surah_id;

create view public.v_juz_progress
with (security_invoker = true)
as
with page_juz as (
  select distinct ayah.page, ayah.juz
  from public.quran_ayahs as ayah
)
select
  progress.student_id,
  page_juz.juz,
  count(*)::integer as tracked_pages,
  count(*) filter (where progress.status = 'in_progress')::integer as in_progress_pages,
  count(*) filter (where progress.status = 'mastered')::integer as mastered_pages,
  count(*) filter (where progress.status = 'needs_review')::integer as needs_review_pages,
  round(avg(progress.avg_score), 2) as avg_score,
  max(progress.last_reviewed_at) as last_reviewed_at
from public.memorization_progress as progress
join page_juz on page_juz.page = progress.page
group by progress.student_id, page_juz.juz;

revoke all on table public.v_surah_progress, public.v_juz_progress from public, anon, authenticated, service_role;
grant select on table public.v_surah_progress, public.v_juz_progress to authenticated, service_role;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'memorization_progress'
  ) then
    alter publication supabase_realtime add table public.memorization_progress;
  end if;
end;
$$;

insert into supabase_migrations.schema_migrations(version, statements, name) values ('20261020350000', array[]::text[], 'add_memorization_progress') on conflict (version) do nothing;
-- END MIGRATION 20261020350000_add_memorization_progress.sql
-- BEGIN MIGRATION 20261020370000_add_spaced_review_queue.sql
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

insert into supabase_migrations.schema_migrations(version, statements, name) values ('20261020370000', array[]::text[], 'add_spaced_review_queue') on conflict (version) do nothing;
-- END MIGRATION 20261020370000_add_spaced_review_queue.sql
-- BEGIN MIGRATION 20261020390000_add_memorization_plans.sql
create table public.memorization_plans (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null unique references public.students(id) on delete cascade,
  weekly_target_pages smallint not null check (weekly_target_pages between 1 and 604),
  monthly_target_pages smallint not null check (monthly_target_pages between 1 and 604),
  starts_on date not null default current_date,
  ends_on date,
  created_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  updated_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint memorization_plans_monthly_target_check check (monthly_target_pages >= weekly_target_pages),
  constraint memorization_plans_date_range_check check (ends_on is null or ends_on >= starts_on)
);

create index memorization_plans_validity_idx
on public.memorization_plans (starts_on, ends_on);

create trigger memorization_plans_set_updated_at
before update on public.memorization_plans
for each row execute function public.set_updated_at();

create trigger memorization_plans_audit
after insert or update or delete on public.memorization_plans
for each row execute function public.audit_row();

alter table public.memorization_plans enable row level security;
alter table public.memorization_plans replica identity full;

revoke all on table public.memorization_plans from public, anon, authenticated, service_role;
grant select, insert, update, delete on table public.memorization_plans to authenticated;
grant select on table public.memorization_plans to service_role;

create policy memorization_plans_admin_all on public.memorization_plans
for all to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

create policy memorization_plans_teacher_read on public.memorization_plans
for select to authenticated
using ((select private.teaches_student(student_id)));

create policy memorization_plans_teacher_insert on public.memorization_plans
for insert to authenticated
with check (
  (select private.teaches_student(student_id))
  and created_by = (select auth.uid())
  and updated_by = (select auth.uid())
);

create policy memorization_plans_teacher_update on public.memorization_plans
for update to authenticated
using ((select private.teaches_student(student_id)))
with check (
  (select private.teaches_student(student_id))
  and updated_by = (select auth.uid())
);

create policy memorization_plans_student_read on public.memorization_plans
for select to authenticated
using (exists (
  select 1
  from public.students as student
  where student.id = memorization_plans.student_id
    and student.profile_id = (select auth.uid())
));

create policy memorization_plans_parent_read on public.memorization_plans
for select to authenticated
using ((select private.guards_student(student_id)));

create view public.v_memorization_plan_adherence
with (security_invoker = true)
as
select
  plan.id as plan_id,
  plan.student_id,
  plan.weekly_target_pages,
  plan.monthly_target_pages,
  plan.starts_on,
  plan.ends_on,
  local_period.local_today,
  date_trunc('week', local_period.local_today)::date as week_starts_on,
  date_trunc('month', local_period.local_today)::date as month_starts_on,
  achievement.weekly_achieved_pages,
  achievement.monthly_achieved_pages,
  round(least(100::numeric, achievement.weekly_achieved_pages * 100::numeric / plan.weekly_target_pages), 2) as weekly_adherence_percent,
  round(least(100::numeric, achievement.monthly_achieved_pages * 100::numeric / plan.monthly_target_pages), 2) as monthly_adherence_percent,
  plan.updated_at
from public.memorization_plans as plan
join public.students as student on student.id = plan.student_id
cross join lateral (
  select (now() at time zone student.timezone)::date as local_today
) as local_period
cross join lateral (
  select
    count(*) filter (
      where (progress.first_memorized_at at time zone student.timezone)::date
        >= date_trunc('week', local_period.local_today)::date
    )::integer as weekly_achieved_pages,
    count(*) filter (
      where (progress.first_memorized_at at time zone student.timezone)::date
        >= date_trunc('month', local_period.local_today)::date
    )::integer as monthly_achieved_pages
  from public.memorization_progress as progress
  where progress.student_id = plan.student_id
    and progress.status = 'mastered'
    and progress.first_memorized_at is not null
    and (progress.first_memorized_at at time zone student.timezone)::date <= local_period.local_today
) as achievement
where plan.starts_on <= local_period.local_today
  and (plan.ends_on is null or plan.ends_on >= local_period.local_today);

revoke all on table public.v_memorization_plan_adherence from public, anon, authenticated, service_role;
grant select on table public.v_memorization_plan_adherence to authenticated, service_role;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'memorization_plans'
  ) then
    alter publication supabase_realtime add table public.memorization_plans;
  end if;
end;
$$;

insert into supabase_migrations.schema_migrations(version, statements, name) values ('20261020390000', array[]::text[], 'add_memorization_plans') on conflict (version) do nothing;
-- END MIGRATION 20261020390000_add_memorization_plans.sql
-- BEGIN MIGRATION 20261021010000_create_reports.sql
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete restrict,
  teacher_id uuid not null references public.teachers(id) on delete restrict,
  period_type text not null check (period_type in ('weekly', 'monthly')),
  period_start date not null,
  period_end date not null,
  body jsonb not null,
  status public.report_status not null default 'draft',
  approved_at timestamptz,
  made_visible_at timestamptz,
  content_template_version_id uuid,
  pdf_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reports_period_valid check (
    period_end >= period_start
    and period_end - period_start between 0 and 31
  ),
  constraint reports_body_valid check (
    jsonb_typeof(body) = 'object'
    and jsonb_typeof(body -> 'metrics') = 'object'
    and jsonb_typeof(body -> 'summary') = 'string'
    and jsonb_typeof(body -> 'strengths') = 'string'
    and jsonb_typeof(body -> 'improve') = 'string'
    and jsonb_typeof(body -> 'plan') = 'string'
    and jsonb_typeof(body -> 'recommendation') = 'string'
  ),
  unique (student_id, teacher_id, period_type, period_start)
);

create index reports_teacher_status_period_idx on public.reports (teacher_id, status, period_start desc);
create index reports_student_visible_idx on public.reports (student_id, period_start desc) where status = 'visible';

create or replace function private.calculate_report_metrics(
  p_student_id uuid,
  p_period_start date,
  p_period_end date
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with report_sessions as (
    select session.id
    from public.sessions as session
    join public.students as student on student.id = session.student_id
    where session.student_id = p_student_id
      and (session.scheduled_at at time zone student.timezone)::date between p_period_start and p_period_end
  ), attendance_metrics as (
    select
      count(attendance.session_id)::integer as total,
      count(attendance.session_id) filter (where attendance.status = 'present')::integer as present
    from report_sessions
    left join public.attendance as attendance on attendance.session_id = report_sessions.id
  ), evaluation_metrics as (
    select
      round(avg(evaluation.total_score), 2) as evaluation_average,
      coalesce(
        jsonb_object_agg(criterion.key, criterion.average order by criterion.key)
          filter (where criterion.key is not null),
        '{}'::jsonb
      ) as criteria_average
    from (
      select score.key, round(avg((score.value #>> '{}')::numeric), 2) as average
      from report_sessions
      join public.session_evaluations as evaluation
        on evaluation.session_id = report_sessions.id and evaluation.is_locked
      cross join lateral jsonb_each(evaluation.scores) as score
      group by score.key
    ) as criterion
    cross join lateral (
      select avg(evaluation.total_score) as total_score
      from report_sessions
      join public.session_evaluations as evaluation
        on evaluation.session_id = report_sessions.id and evaluation.is_locked
    ) as evaluation
  ), progress_metrics as (
    select count(*)::integer as mastered_pages
    from public.memorization_progress as progress
    join public.students as student on student.id = progress.student_id
    where progress.student_id = p_student_id
      and progress.status = 'mastered'
      and progress.first_memorized_at is not null
      and (progress.first_memorized_at at time zone student.timezone)::date between p_period_start and p_period_end
  )
  select jsonb_build_object(
    'mastered_pages', progress.mastered_pages,
    'attendance', jsonb_build_object(
      'total', attendance.total,
      'present', attendance.present,
      'rate', case when attendance.total = 0 then null
        else round(attendance.present * 100.0 / attendance.total, 2) end
    ),
    'evaluation_average', evaluation.evaluation_average,
    'criteria_average', evaluation.criteria_average
  )
  from attendance_metrics as attendance
  cross join evaluation_metrics as evaluation
  cross join progress_metrics as progress
$$;

revoke execute on function private.calculate_report_metrics(uuid, date, date) from public, anon, authenticated, service_role;

create or replace function private.prepare_report()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_role public.user_role;
  allowed_transition boolean := false;
begin
  actor_role := (select public.auth_role());

  if tg_op = 'INSERT' then
    if new.status <> 'draft' then
      raise exception using errcode = 'P0001', message = 'report_must_start_draft';
    end if;
    if actor_role = 'teacher' and (
      new.teacher_id is distinct from (select private.current_teacher_id())
      or not (select private.teaches_student(new.student_id))
    ) then
      raise exception using errcode = '42501', message = 'report_forbidden';
    end if;
  else
    if new.student_id is distinct from old.student_id
      or new.teacher_id is distinct from old.teacher_id
      or new.period_type is distinct from old.period_type
      or new.period_start is distinct from old.period_start
      or new.period_end is distinct from old.period_end then
      raise exception using errcode = 'P0001', message = 'report_identity_immutable';
    end if;

    if new.body is distinct from old.body and old.status <> 'draft' then
      raise exception using errcode = 'P0001', message = 'report_content_locked';
    end if;

    if new.status is distinct from old.status then
      allowed_transition := case
        when actor_role = 'teacher' then old.status = 'draft' and new.status = 'approved'
        when actor_role = 'admin' then
          (old.status = 'draft' and new.status = 'approved')
          or (old.status = 'approved' and new.status in ('admin_review', 'visible'))
          or (old.status = 'admin_review' and new.status = 'visible')
          or (old.status = 'visible' and new.status = 'draft')
        else false
      end;
      if not allowed_transition then
        raise exception using errcode = 'P0001', message = 'report_transition_forbidden';
      end if;
    end if;
  end if;

  new.body := jsonb_set(
    new.body,
    '{metrics}',
    private.calculate_report_metrics(new.student_id, new.period_start, new.period_end),
    true
  );
  new.approved_at := case
    when new.status in ('approved', 'admin_review', 'visible') then coalesce(old.approved_at, pg_catalog.clock_timestamp())
    else null
  end;
  new.made_visible_at := case
    when new.status = 'visible' then coalesce(old.made_visible_at, pg_catalog.clock_timestamp())
    else null
  end;
  return new;
end;
$$;

revoke execute on function private.prepare_report() from public, anon, authenticated, service_role;

create trigger reports_prepare
before insert or update on public.reports
for each row execute function private.prepare_report();
create trigger reports_set_updated_at
before update on public.reports
for each row execute function public.set_updated_at();
create trigger reports_audit
after insert or update or delete on public.reports
for each row execute function public.audit_row();

alter table public.reports enable row level security;
revoke all on table public.reports from public, anon, authenticated, service_role;
grant select, insert, update, delete on table public.reports to authenticated;
grant select on table public.reports to service_role;

create policy reports_admin_all on public.reports
for all to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

create policy reports_teacher_select on public.reports
for select to authenticated
using (teacher_id = (select private.current_teacher_id()));
create policy reports_teacher_insert on public.reports
for insert to authenticated
with check (
  status = 'draft'
  and teacher_id = (select private.current_teacher_id())
  and (select private.teaches_student(student_id))
);
create policy reports_teacher_update on public.reports
for update to authenticated
using (
  status <> 'visible'
  and teacher_id = (select private.current_teacher_id())
  and (select private.teaches_student(student_id))
)
with check (
  status <> 'visible'
  and teacher_id = (select private.current_teacher_id())
  and (select private.teaches_student(student_id))
);

create policy reports_student_visible on public.reports
for select to authenticated
using (
  status = 'visible'
  and exists (
    select 1 from public.students as student
    where student.id = reports.student_id and student.profile_id = (select auth.uid())
  )
);
create policy reports_parent_visible on public.reports
for select to authenticated
using (status = 'visible' and (select private.guards_student(student_id)));

insert into supabase_migrations.schema_migrations(version, statements, name) values ('20261021010000', array[]::text[], 'create_reports') on conflict (version) do nothing;
-- END MIGRATION 20261021010000_create_reports.sql
-- BEGIN MIGRATION 20261021030000_add_report_delivery.sql
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

insert into supabase_migrations.schema_migrations(version, statements, name) values ('20261021030000', array[]::text[], 'add_report_delivery') on conflict (version) do nothing;
-- END MIGRATION 20261021030000_add_report_delivery.sql
-- BEGIN MIGRATION 20261021050000_create_packages_and_pricing.sql
create or replace function private.is_valid_package_policy(candidate jsonb)
returns boolean
language plpgsql
immutable
strict
set search_path = ''
as $$
declare
  numeric_key text;
begin
  if jsonb_typeof(candidate) <> 'object'
    or not candidate ?& array[
      'cancel_notice_hours',
      'max_makeups_per_period',
      'makeup_valid_days',
      'late_tolerance_min',
      'student_no_show_consumes_credit',
      'student_no_show_pays_teacher',
      'partial_refund_pct',
      'max_pause_days',
      'trial'
    ] then
    return false;
  end if;

  foreach numeric_key in array array[
    'cancel_notice_hours',
    'max_makeups_per_period',
    'makeup_valid_days',
    'late_tolerance_min',
    'partial_refund_pct',
    'max_pause_days'
  ] loop
    if jsonb_typeof(candidate -> numeric_key) <> 'number'
      or (candidate ->> numeric_key)::numeric < 0 then
      return false;
    end if;
  end loop;

  if (candidate ->> 'partial_refund_pct')::numeric > 100
    or jsonb_typeof(candidate -> 'student_no_show_consumes_credit') <> 'boolean'
    or jsonb_typeof(candidate -> 'student_no_show_pays_teacher') <> 'boolean'
    or jsonb_typeof(candidate -> 'trial') <> 'object'
    or jsonb_typeof(candidate #> '{trial,enabled}') <> 'boolean'
    or jsonb_typeof(candidate #> '{trial,price_pct}') <> 'number'
    or (candidate #>> '{trial,price_pct}')::numeric not between 0 and 100 then
    return false;
  end if;

  return true;
exception
  when invalid_text_representation or numeric_value_out_of_range then
    return false;
end;
$$;

revoke execute on function private.is_valid_package_policy(jsonb) from public, anon, authenticated, service_role;

create table public.countries (
  code char(2) primary key,
  name_ar text not null check (char_length(btrim(name_ar)) between 2 and 120),
  name_en text check (name_en is null or char_length(btrim(name_en)) between 2 and 120),
  currency char(3) not null,
  default_timezone text check (
    default_timezone is null or char_length(btrim(default_timezone)) between 1 and 100
  ),
  is_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint countries_code_iso check (code = upper(code) and btrim(code) ~ '^[A-Z]{2}$'),
  constraint countries_currency_iso check (
    currency = upper(currency) and btrim(currency) ~ '^[A-Z]{3}$'
  )
);

create table public.packages (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null check (
    slug = lower(slug)
    and slug ~ '^[a-z0-9][a-z0-9-]{1,78}[a-z0-9]$'
  ),
  track_id uuid references public.tracks(id) on delete restrict,
  name_ar text not null check (char_length(btrim(name_ar)) between 2 and 160),
  name_en text check (name_en is null or char_length(btrim(name_en)) between 2 and 160),
  description_ar text check (
    description_ar is null or char_length(btrim(description_ar)) between 2 and 4000
  ),
  description_en text check (
    description_en is null or char_length(btrim(description_en)) between 2 and 4000
  ),
  audience text check (audience in ('child', 'adult', 'women')),
  teacher_gender public.gender_t,
  sessions_per_week smallint not null check (sessions_per_week between 1 and 14),
  duration_min integer not null default 30 check (duration_min between 10 and 120),
  billing_period public.billing_period not null default 'monthly',
  features jsonb not null default '[]'::jsonb check (jsonb_typeof(features) = 'array'),
  policy jsonb not null default jsonb_build_object(
    'cancel_notice_hours', 12,
    'max_makeups_per_period', 2,
    'makeup_valid_days', 30,
    'late_tolerance_min', 10,
    'student_no_show_consumes_credit', true,
    'student_no_show_pays_teacher', true,
    'partial_refund_pct', 0,
    'max_pause_days', 30,
    'trial', jsonb_build_object('enabled', true, 'price_pct', 0)
  ) check (private.is_valid_package_policy(policy)),
  is_published boolean not null default false,
  is_active boolean not null default true,
  sort_order integer not null default 0 check (sort_order >= 0),
  created_by uuid references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.package_prices (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references public.packages(id) on delete restrict,
  country_code char(2) not null references public.countries(code) on delete restrict,
  currency char(3) not null,
  amount numeric(12,2) not null check (amount >= 0),
  min_amount numeric(12,2) check (min_amount is null or min_amount >= 0),
  max_amount numeric(12,2) check (max_amount is null or max_amount >= 0),
  is_active boolean not null default true,
  valid_from timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint package_prices_currency_iso check (
    currency = upper(currency) and btrim(currency) ~ '^[A-Z]{3}$'
  ),
  constraint package_prices_minimum check (min_amount is null or amount >= min_amount),
  constraint package_prices_maximum check (max_amount is null or amount <= max_amount),
  constraint package_prices_bounds check (
    min_amount is null or max_amount is null or min_amount <= max_amount
  ),
  unique (package_id, country_code, valid_from)
);

create table public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null check (code ~ '^[A-Z0-9][A-Z0-9_-]{2,39}$'),
  kind text not null check (kind in ('percent', 'fixed', 'sibling', 'annual', 'seasonal')),
  value numeric(12,2) not null check (value > 0),
  currency char(3),
  starts_at timestamptz,
  ends_at timestamptz,
  max_redemptions integer check (max_redemptions is null or max_redemptions > 0),
  redeemed_count integer not null default 0 check (redeemed_count >= 0),
  package_id uuid references public.packages(id) on delete restrict,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint coupons_code_unique unique (code),
  constraint coupons_period_valid check (
    starts_at is null or ends_at is null or ends_at > starts_at
  ),
  constraint coupons_capacity_valid check (
    max_redemptions is null or redeemed_count <= max_redemptions
  ),
  constraint coupons_value_shape check (
    (kind = 'fixed' and currency is not null)
    or (
      kind in ('percent', 'sibling', 'annual', 'seasonal')
      and currency is null
      and value <= 100
    )
  ),
  constraint coupons_currency_iso check (
    currency is null or (currency = upper(currency) and btrim(currency) ~ '^[A-Z]{3}$')
  )
);

create index packages_public_order_idx
on public.packages (sort_order, id)
where is_published and is_active;
create index packages_track_idx on public.packages (track_id, is_active, sort_order);
create index package_prices_resolution_idx
on public.package_prices (package_id, country_code, valid_from desc);
create index coupons_active_period_idx on public.coupons (is_active, starts_at, ends_at);

create trigger countries_set_updated_at
before update on public.countries
for each row execute function public.set_updated_at();
create trigger packages_set_updated_at
before update on public.packages
for each row execute function public.set_updated_at();
create trigger package_prices_set_updated_at
before update on public.package_prices
for each row execute function public.set_updated_at();
create trigger coupons_set_updated_at
before update on public.coupons
for each row execute function public.set_updated_at();

create or replace function private.prepare_country()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.code := upper(btrim(new.code));
  new.currency := upper(btrim(new.currency));
  new.name_ar := btrim(new.name_ar);
  new.name_en := nullif(btrim(new.name_en), '');
  new.default_timezone := nullif(btrim(new.default_timezone), '');
  return new;
end;
$$;

revoke execute on function private.prepare_country() from public, anon, authenticated, service_role;
create trigger countries_prepare
before insert or update on public.countries
for each row execute function private.prepare_country();

create or replace function private.package_has_active_default_price(
  target_package_id uuid,
  effective_at timestamptz default now()
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select price.is_active
    from public.package_prices as price
    join public.countries as country on country.code = price.country_code
    where price.package_id = target_package_id
      and price.country_code = 'ZZ'
      and price.valid_from <= effective_at
      and country.is_enabled
    order by price.valid_from desc
    limit 1
  ), false)
$$;

revoke execute on function private.package_has_active_default_price(uuid, timestamptz)
from public, anon, authenticated, service_role;

create or replace function private.validate_package_publication()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.slug := lower(btrim(new.slug));
  new.name_ar := btrim(new.name_ar);
  new.name_en := nullif(btrim(new.name_en), '');
  new.description_ar := nullif(btrim(new.description_ar), '');
  new.description_en := nullif(btrim(new.description_en), '');

  if new.is_published
    and not private.package_has_active_default_price(new.id, pg_catalog.clock_timestamp()) then
    raise exception using errcode = 'P0001', message = 'package_default_price_required';
  end if;
  return new;
end;
$$;

revoke execute on function private.validate_package_publication()
from public, anon, authenticated, service_role;
create trigger packages_validate_publication
before insert or update on public.packages
for each row execute function private.validate_package_publication();

create or replace function private.prepare_package_price()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  expected_currency char(3);
begin
  new.country_code := upper(btrim(new.country_code));
  new.currency := upper(btrim(new.currency));

  select country.currency into expected_currency
  from public.countries as country
  where country.code = new.country_code;

  if expected_currency is null then
    raise exception using errcode = '23503', message = 'price_country_unknown';
  end if;
  if new.currency is distinct from expected_currency then
    raise exception using errcode = 'P0001', message = 'price_currency_mismatch';
  end if;
  return new;
end;
$$;

revoke execute on function private.prepare_package_price()
from public, anon, authenticated, service_role;
create trigger package_prices_prepare
before insert on public.package_prices
for each row execute function private.prepare_package_price();

create or replace function private.reject_package_price_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception using errcode = 'P0001', message = 'package_price_immutable';
end;
$$;

revoke execute on function private.reject_package_price_mutation()
from public, anon, authenticated, service_role;
create trigger package_prices_immutable
before update or delete on public.package_prices
for each row execute function private.reject_package_price_mutation();

create or replace function private.prepare_coupon()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.code := upper(btrim(new.code));
  new.currency := case when new.currency is null then null else upper(btrim(new.currency)) end;
  return new;
end;
$$;

revoke execute on function private.prepare_coupon() from public, anon, authenticated, service_role;
create trigger coupons_prepare
before insert or update on public.coupons
for each row execute function private.prepare_coupon();

create or replace function private.audit_package_price_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  previous_price jsonb;
begin
  select to_jsonb(price) into previous_price
  from public.package_prices as price
  where price.package_id = new.package_id
    and price.country_code = new.country_code
    and price.id <> new.id
    and price.valid_from < new.valid_from
  order by price.valid_from desc
  limit 1;

  insert into public.audit_logs(user_id, action, table_name, record_id, before, after, ip)
  values (
    (select auth.uid()),
    'INSERT',
    'package_prices',
    new.id::text,
    previous_price,
    to_jsonb(new),
    inet_client_addr()
  );
  return new;
end;
$$;

revoke execute on function private.audit_package_price_insert()
from public, anon, authenticated, service_role;

-- TODO(OWNER): confirm USD as the fallback currency for the synthetic ZZ country.
insert into public.countries(code, name_ar, name_en, currency, default_timezone)
values
  ('EG', 'مصر', 'Egypt', 'EGP', 'Africa/Cairo'),
  ('SA', 'السعودية', 'Saudi Arabia', 'SAR', 'Asia/Riyadh'),
  ('AE', 'الإمارات', 'United Arab Emirates', 'AED', 'Asia/Dubai'),
  ('KW', 'الكويت', 'Kuwait', 'KWD', 'Asia/Kuwait'),
  ('QA', 'قطر', 'Qatar', 'QAR', 'Asia/Qatar'),
  ('BH', 'البحرين', 'Bahrain', 'BHD', 'Asia/Bahrain'),
  ('OM', 'عُمان', 'Oman', 'OMR', 'Asia/Muscat'),
  ('IQ', 'العراق', 'Iraq', 'IQD', 'Asia/Baghdad'),
  ('JO', 'الأردن', 'Jordan', 'JOD', 'Asia/Amman'),
  ('LB', 'لبنان', 'Lebanon', 'LBP', 'Asia/Beirut'),
  ('PS', 'فلسطين', 'Palestine', 'ILS', 'Asia/Gaza'),
  ('SY', 'سوريا', 'Syria', 'SYP', 'Asia/Damascus'),
  ('YE', 'اليمن', 'Yemen', 'YER', 'Asia/Aden'),
  ('LY', 'ليبيا', 'Libya', 'LYD', 'Africa/Tripoli'),
  ('TN', 'تونس', 'Tunisia', 'TND', 'Africa/Tunis'),
  ('DZ', 'الجزائر', 'Algeria', 'DZD', 'Africa/Algiers'),
  ('MA', 'المغرب', 'Morocco', 'MAD', 'Africa/Casablanca'),
  ('MR', 'موريتانيا', 'Mauritania', 'MRU', 'Africa/Nouakchott'),
  ('SD', 'السودان', 'Sudan', 'SDG', 'Africa/Khartoum'),
  ('DJ', 'جيبوتي', 'Djibouti', 'DJF', 'Africa/Djibouti'),
  ('SO', 'الصومال', 'Somalia', 'SOS', 'Africa/Mogadishu'),
  ('KM', 'جزر القمر', 'Comoros', 'KMF', 'Indian/Comoro'),
  ('ZZ', 'بقية العالم', 'Rest of world', 'USD', 'UTC');

create trigger countries_audit
after insert or update or delete on public.countries
for each row execute function public.audit_row();
create trigger packages_audit
after insert or update or delete on public.packages
for each row execute function public.audit_row();
create trigger package_prices_audit
after insert on public.package_prices
for each row execute function private.audit_package_price_insert();
create trigger coupons_audit
after insert or update or delete on public.coupons
for each row execute function public.audit_row();

create or replace function public.resolve_price(
  p_package uuid,
  p_country char(2),
  p_at timestamptz default now()
)
returns table(amount numeric(12,2), currency char(3), country_code char(2))
language sql
stable
security definer
set search_path = ''
as $$
  with candidates as (
    select distinct on (price.country_code)
      price.amount,
      price.currency,
      price.country_code,
      price.is_active,
      case when price.country_code = upper(btrim(p_country)) then 0 else 1 end as priority
    from public.package_prices as price
    join public.countries as country
      on country.code = price.country_code and country.is_enabled
    join public.packages as package
      on package.id = price.package_id
    where price.package_id = p_package
      and package.is_published
      and package.is_active
      and private.package_has_active_default_price(p_package, p_at)
      and price.country_code in (upper(btrim(p_country)), 'ZZ')
      and price.valid_from <= p_at
    order by price.country_code, price.valid_from desc
  )
  select candidate.amount, candidate.currency, candidate.country_code
  from candidates as candidate
  where candidate.is_active
  order by candidate.priority
  limit 1
$$;

revoke execute on function public.resolve_price(uuid, char, timestamptz) from public;
grant execute on function public.resolve_price(uuid, char, timestamptz) to anon, authenticated, service_role;

alter table public.countries enable row level security;
alter table public.packages enable row level security;
alter table public.package_prices enable row level security;
alter table public.coupons enable row level security;

revoke all on public.countries from public, anon, authenticated, service_role;
revoke all on public.packages from public, anon, authenticated, service_role;
revoke all on public.package_prices from public, anon, authenticated, service_role;
revoke all on public.coupons from public, anon, authenticated, service_role;

grant select on public.countries to anon, authenticated, service_role;
grant insert, update, delete on public.countries to authenticated, service_role;
grant select on public.packages to anon, authenticated, service_role;
grant insert, update, delete on public.packages to authenticated, service_role;
grant select on public.package_prices to anon, authenticated, service_role;
grant insert on public.package_prices to authenticated, service_role;
grant select, insert, update, delete on public.coupons to authenticated, service_role;

create policy countries_public_read on public.countries
for select to anon, authenticated
using (is_enabled);
create policy countries_admin_all on public.countries
for all to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

create policy packages_public_read on public.packages
for select to anon, authenticated
using (
  is_published
  and is_active
  and exists (
    select 1
    from public.resolve_price(id, 'ZZ', now())
  )
);
create policy packages_admin_all on public.packages
for all to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

create policy package_prices_public_read on public.package_prices
for select to anon, authenticated
using (
  valid_from <= now()
  and exists (
    select 1
    from public.packages as package
    join public.countries as country on country.code = package_prices.country_code
    where package.id = package_prices.package_id
      and package.is_published
      and package.is_active
      and country.is_enabled
  )
);
create policy package_prices_admin_read on public.package_prices
for select to authenticated
using ((select public.is_admin()));
create policy package_prices_admin_insert on public.package_prices
for insert to authenticated
with check ((select public.is_admin()));

create policy coupons_admin_all on public.coupons
for all to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

insert into supabase_migrations.schema_migrations(version, statements, name) values ('20261021050000', array[]::text[], 'create_packages_and_pricing') on conflict (version) do nothing;
-- END MIGRATION 20261021050000_create_packages_and_pricing.sql
-- BEGIN MIGRATION 20261021070000_add_package_management.sql
create or replace function public.save_package(p_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  saved_package_id uuid := coalesce(nullif(p_payload ->> 'package_id', '')::uuid, gen_random_uuid());
  requested_package_id uuid := nullif(p_payload ->> 'package_id', '')::uuid;
  price jsonb;
begin
  if actor_id is null or not (select public.is_admin()) then
    raise exception using errcode = '42501', message = 'admin_mfa_required';
  end if;
  if jsonb_typeof(p_payload) <> 'object'
    or jsonb_typeof(p_payload -> 'prices') <> 'array' then
    raise exception using errcode = '22023', message = 'package_payload_invalid';
  end if;

  if requested_package_id is not null and not exists (
    select 1 from public.packages where id = requested_package_id
  ) then
    raise exception using errcode = 'P0002', message = 'package_not_found';
  end if;

  if requested_package_id is null then
    insert into public.packages(
    id,
    slug,
    track_id,
    name_ar,
    name_en,
    description_ar,
    description_en,
    audience,
    teacher_gender,
    sessions_per_week,
    duration_min,
    billing_period,
    features,
    policy,
    is_published,
    is_active,
    sort_order,
    created_by
  )
  values (
    saved_package_id,
    p_payload ->> 'slug',
    nullif(p_payload ->> 'track_id', '')::uuid,
    p_payload ->> 'name_ar',
    nullif(p_payload ->> 'name_en', ''),
    nullif(p_payload ->> 'description_ar', ''),
    nullif(p_payload ->> 'description_en', ''),
    nullif(p_payload ->> 'audience', ''),
    nullif(p_payload ->> 'teacher_gender', '')::public.gender_t,
    (p_payload ->> 'sessions_per_week')::smallint,
    (p_payload ->> 'duration_min')::integer,
    (p_payload ->> 'billing_period')::public.billing_period,
    p_payload -> 'features',
    p_payload -> 'policy',
    false,
    true,
    coalesce((select max(package.sort_order) + 1 from public.packages as package), 0),
    actor_id
    );
  else
    update public.packages
    set slug = p_payload ->> 'slug',
        track_id = nullif(p_payload ->> 'track_id', '')::uuid,
        name_ar = p_payload ->> 'name_ar',
        name_en = nullif(p_payload ->> 'name_en', ''),
        description_ar = nullif(p_payload ->> 'description_ar', ''),
        description_en = nullif(p_payload ->> 'description_en', ''),
        audience = nullif(p_payload ->> 'audience', ''),
        teacher_gender = nullif(p_payload ->> 'teacher_gender', '')::public.gender_t,
        sessions_per_week = (p_payload ->> 'sessions_per_week')::smallint,
        duration_min = (p_payload ->> 'duration_min')::integer,
        billing_period = (p_payload ->> 'billing_period')::public.billing_period,
        features = p_payload -> 'features',
        policy = p_payload -> 'policy',
        is_published = false
    where id = saved_package_id;
  end if;

  for price in select value from jsonb_array_elements(p_payload -> 'prices') loop
    insert into public.package_prices(
      package_id,
      country_code,
      currency,
      amount,
      min_amount,
      max_amount,
      is_active,
      valid_from,
      created_by
    )
    values (
      saved_package_id,
      price ->> 'country_code',
      price ->> 'currency',
      (price ->> 'amount')::numeric,
      nullif(price ->> 'min_amount', '')::numeric,
      nullif(price ->> 'max_amount', '')::numeric,
      coalesce((price ->> 'is_active')::boolean, true),
      (price ->> 'valid_from')::timestamptz,
      actor_id
    );
  end loop;

  if coalesce((p_payload ->> 'is_published')::boolean, false) then
    update public.packages set is_published = true where id = saved_package_id;
  end if;

  return saved_package_id;
exception
  when unique_violation then
    raise exception using errcode = '23505', message = 'package_slug_exists';
end;
$$;

revoke execute on function public.save_package(jsonb) from public, anon;
grant execute on function public.save_package(jsonb) to authenticated, service_role;

create or replace function public.clone_package(p_package uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  source_package public.packages%rowtype;
  new_package_id uuid := gen_random_uuid();
begin
  if actor_id is null or not (select public.is_admin()) then
    raise exception using errcode = '42501', message = 'admin_mfa_required';
  end if;

  select * into source_package from public.packages where id = p_package;
  if not found then
    raise exception using errcode = 'P0002', message = 'package_not_found';
  end if;

  insert into public.packages(
    id, slug, track_id, name_ar, name_en, description_ar, description_en, audience,
    teacher_gender, sessions_per_week, duration_min, billing_period, features, policy,
    is_published, is_active, sort_order, created_by
  )
  values (
    new_package_id,
    source_package.slug || '-copy-' || substr(replace(new_package_id::text, '-', ''), 1, 8),
    source_package.track_id,
    source_package.name_ar || ' (نسخة)',
    case when source_package.name_en is null then null else source_package.name_en || ' (Copy)' end,
    source_package.description_ar,
    source_package.description_en,
    source_package.audience,
    source_package.teacher_gender,
    source_package.sessions_per_week,
    source_package.duration_min,
    source_package.billing_period,
    source_package.features,
    source_package.policy,
    false,
    true,
    coalesce((select max(package.sort_order) + 1 from public.packages as package), 0),
    actor_id
  );

  insert into public.package_prices(
    package_id, country_code, currency, amount, min_amount, max_amount,
    is_active, valid_from, created_by
  )
  select
    new_package_id,
    current_price.country_code,
    current_price.currency,
    current_price.amount,
    current_price.min_amount,
    current_price.max_amount,
    current_price.is_active,
    pg_catalog.clock_timestamp(),
    actor_id
  from (
    select distinct on (price.country_code) price.*
    from public.package_prices as price
    where price.package_id = p_package and price.valid_from <= now()
    order by price.country_code, price.valid_from desc
  ) as current_price;

  return new_package_id;
end;
$$;

revoke execute on function public.clone_package(uuid) from public, anon;
grant execute on function public.clone_package(uuid) to authenticated, service_role;

create or replace function public.reorder_packages(p_package_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  expected_count integer;
begin
  if actor_id is null or not (select public.is_admin()) then
    raise exception using errcode = '42501', message = 'admin_mfa_required';
  end if;
  if p_package_ids is null or cardinality(p_package_ids) = 0
    or cardinality(p_package_ids) <> (
      select count(distinct package_id) from unnest(p_package_ids) as package_id
    ) then
    raise exception using errcode = '22023', message = 'package_order_invalid';
  end if;

  select count(*) into expected_count
  from public.packages
  where id = any(p_package_ids);
  if expected_count <> cardinality(p_package_ids) then
    raise exception using errcode = '22023', message = 'package_order_unknown_id';
  end if;

  update public.packages as package
  set sort_order = requested.position - 1
  from unnest(p_package_ids) with ordinality as requested(id, position)
  where package.id = requested.id;
end;
$$;

revoke execute on function public.reorder_packages(uuid[]) from public, anon;
grant execute on function public.reorder_packages(uuid[]) to authenticated, service_role;

insert into supabase_migrations.schema_migrations(version, statements, name) values ('20261021070000', array[]::text[], 'add_package_management') on conflict (version) do nothing;
-- END MIGRATION 20261021070000_add_package_management.sql
-- BEGIN MIGRATION 20261021090000_add_package_imports.sql
create table public.package_import_batches (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references public.profiles(id) on delete restrict,
  source_name text not null check (char_length(btrim(source_name)) between 1 and 180),
  status text not null default 'pending' check (status in ('pending', 'confirmed')),
  package_count integer not null check (package_count between 1 and 200),
  price_count integer not null check (price_count between 1 and 1000),
  payload jsonb not null check (jsonb_typeof(payload) = 'array'),
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (status = 'pending' and confirmed_at is null)
    or (status = 'confirmed' and confirmed_at is not null and payload = '[]'::jsonb)
  )
);

create index package_import_batches_owner_idx
on public.package_import_batches (created_by, created_at desc);

create trigger package_import_batches_set_updated_at
before update on public.package_import_batches
for each row execute function public.set_updated_at();

alter table public.package_import_batches enable row level security;
revoke all on public.package_import_batches from public, anon, authenticated, service_role;
grant select, insert on public.package_import_batches to authenticated;

create policy package_import_batches_admin_read
on public.package_import_batches for select to authenticated
using ((select public.is_admin()) and created_by = (select auth.uid()));

create policy package_import_batches_admin_create
on public.package_import_batches for insert to authenticated
with check ((select public.is_admin()) and created_by = (select auth.uid()));

create or replace function public.confirm_package_import(p_batch_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  managed_batch public.package_import_batches%rowtype;
  imported_package jsonb;
  imported_count integer := 0;
  counted_prices integer := 0;
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'admin_mfa_required';
  end if;

  select * into managed_batch
  from public.package_import_batches
  where id = p_batch_id
    and created_by = (select auth.uid())
    and created_at > now() - interval '1 day'
  for update;

  if managed_batch.id is null or managed_batch.status <> 'pending' then
    raise exception using errcode = 'P0002', message = 'pending_import_not_found';
  end if;
  if jsonb_array_length(managed_batch.payload) <> managed_batch.package_count then
    raise exception using errcode = '22023', message = 'invalid_import_payload';
  end if;

  for imported_package in select value from jsonb_array_elements(managed_batch.payload)
  loop
    if jsonb_typeof(imported_package -> 'prices') <> 'array'
      or jsonb_array_length(imported_package -> 'prices') = 0 then
      raise exception using errcode = '22023', message = 'invalid_import_payload';
    end if;
    counted_prices := counted_prices + jsonb_array_length(imported_package -> 'prices');
    perform public.save_package(imported_package);
    imported_count := imported_count + 1;
  end loop;

  if counted_prices <> managed_batch.price_count then
    raise exception using errcode = '22023', message = 'invalid_import_payload';
  end if;

  update public.package_import_batches
  set status = 'confirmed', payload = '[]'::jsonb, confirmed_at = now()
  where id = managed_batch.id;

  insert into public.audit_logs (user_id, action, table_name, record_id, after, ip)
  values (
    (select auth.uid()),
    'IMPORT',
    'packages',
    managed_batch.id::text,
    jsonb_build_object('package_count', imported_count, 'price_count', counted_prices),
    inet_client_addr()
  );

  return imported_count;
end;
$$;

revoke execute on function public.confirm_package_import(uuid) from public, anon;
grant execute on function public.confirm_package_import(uuid) to authenticated;

insert into supabase_migrations.schema_migrations(version, statements, name) values ('20261021090000', array[]::text[], 'add_package_imports') on conflict (version) do nothing;
-- END MIGRATION 20261021090000_add_package_imports.sql
-- BEGIN MIGRATION 20261021100000_create_public_package_catalog.sql
create or replace function public.get_public_package_catalog(
  p_country char(2),
  p_at timestamptz default now()
)
returns table(
  package_id uuid,
  slug text,
  track_name_ar text,
  track_name_en text,
  name_ar text,
  name_en text,
  description_ar text,
  description_en text,
  audience text,
  teacher_gender public.gender_t,
  sessions_per_week smallint,
  duration_min integer,
  billing_period public.billing_period,
  features jsonb,
  amount numeric(12,2),
  currency char(3),
  country_code char(2)
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    package.id,
    package.slug,
    track.name_ar,
    track.name_en,
    package.name_ar,
    package.name_en,
    package.description_ar,
    package.description_en,
    package.audience,
    package.teacher_gender,
    package.sessions_per_week,
    package.duration_min,
    package.billing_period,
    package.features,
    price.amount,
    price.currency,
    price.country_code
  from public.packages as package
  left join public.tracks as track on track.id = package.track_id
  cross join lateral public.resolve_price(package.id, upper(btrim(p_country)), p_at) as price
  where package.is_published and package.is_active
  order by package.sort_order, package.id
$$;

revoke execute on function public.get_public_package_catalog(char, timestamptz) from public;
grant execute on function public.get_public_package_catalog(char, timestamptz)
to anon, authenticated, service_role;

insert into supabase_migrations.schema_migrations(version, statements, name) values ('20261021100000', array[]::text[], 'create_public_package_catalog') on conflict (version) do nothing;
-- END MIGRATION 20261021100000_create_public_package_catalog.sql
-- BEGIN MIGRATION 20261021110000_create_applications.sql
create table public.applications (
  id uuid primary key default gen_random_uuid(),
  order_no text unique not null check (order_no ~ '^NW-A-[A-F0-9]{20}$'),
  status public.application_status not null default 'new',
  student_name text not null check (char_length(btrim(student_name)) between 2 and 160),
  student_gender public.gender_t not null,
  student_age smallint not null check (student_age between 3 and 100),
  guardian_name text check (guardian_name is null or char_length(btrim(guardian_name)) between 2 and 160),
  contact_email text check (contact_email is null or char_length(contact_email) between 5 and 254),
  contact_phone text check (contact_phone is null or char_length(contact_phone) between 7 and 30),
  country_code char(2) references public.countries(code) on delete restrict,
  timezone text not null check (char_length(btrim(timezone)) between 1 and 100),
  track_id uuid references public.tracks(id) on delete restrict,
  package_id uuid references public.packages(id) on delete restrict,
  self_level text not null check (self_level in ('beginner','intermediate','advanced','memorizing')),
  preferred_times jsonb not null check (jsonb_typeof(preferred_times) = 'array' and jsonb_array_length(preferred_times) between 1 and 7),
  preferred_teacher_gender public.gender_t,
  notes text check (notes is null or char_length(notes) <= 2000),
  consent_version text not null check (char_length(consent_version) between 1 and 40),
  consent_at timestamptz not null default now(),
  source text not null default 'website' check (char_length(source) between 1 and 80),
  internal_notes text check (internal_notes is null or char_length(internal_notes) <= 5000),
  converted_student_id uuid references public.students(id) on delete restrict,
  lookup_hash char(64) not null check (lookup_hash ~ '^[a-f0-9]{64}$'),
  request_ip_hash char(64) not null check (request_ip_hash ~ '^[a-f0-9]{64}$'),
  contact_hash char(64) not null check (contact_hash ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (contact_email is not null or contact_phone is not null),
  check (student_age >= 18 or guardian_name is not null),
  check (preferred_teacher_gender is null or preferred_teacher_gender = student_gender)
);

create index applications_status_created_idx on public.applications (status, created_at desc);
create index applications_ip_rate_idx on public.applications (request_ip_hash, created_at desc);
create index applications_contact_rate_idx on public.applications (contact_hash, created_at desc);
create index applications_order_lookup_idx on public.applications (order_no, lookup_hash);

create trigger applications_set_updated_at before update on public.applications
for each row execute function public.set_updated_at();

create or replace function public.audit_application_workflow()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if old.status is distinct from new.status
    or old.internal_notes is distinct from new.internal_notes
    or old.converted_student_id is distinct from new.converted_student_id then
    insert into public.audit_logs(user_id, action, table_name, record_id, before, after, ip)
    values (
      (select auth.uid()), 'UPDATE', 'applications', new.id::text,
      jsonb_build_object('status', old.status, 'has_internal_notes', old.internal_notes is not null, 'converted_student_id', old.converted_student_id),
      jsonb_build_object('status', new.status, 'has_internal_notes', new.internal_notes is not null, 'converted_student_id', new.converted_student_id),
      inet_client_addr()
    );
  end if;
  return new;
end;
$$;
revoke execute on function public.audit_application_workflow() from public, anon, authenticated, service_role;
create trigger applications_audit_workflow after update on public.applications
for each row execute function public.audit_application_workflow();

alter table public.applications enable row level security;
revoke all on public.applications from public, anon, authenticated, service_role;
grant select, update on public.applications to authenticated;

create policy applications_admin_read on public.applications for select to authenticated
using ((select public.is_admin()));
create policy applications_admin_update on public.applications for update to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));

create or replace function public.submit_application(
  p_payload jsonb,
  p_lookup_hash text,
  p_ip_hash text,
  p_contact_hash text
)
returns text language plpgsql security definer set search_path = ''
as $$
declare
  generated_order text;
begin
  if current_user not in ('service_role', 'postgres') then
    raise exception using errcode = '42501', message = 'service_role_required';
  end if;
  if p_lookup_hash !~ '^[a-f0-9]{64}$' or p_ip_hash !~ '^[a-f0-9]{64}$' or p_contact_hash !~ '^[a-f0-9]{64}$' then
    raise exception using errcode = '22023', message = 'application_hash_invalid';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_ip_hash, 0));
  if (select count(*) from public.applications where request_ip_hash = p_ip_hash and created_at > now() - interval '1 hour') >= 5
    or (select count(*) from public.applications where contact_hash = p_contact_hash and created_at > now() - interval '1 day') >= 3 then
    raise exception using errcode = 'P0001', message = 'application_rate_limited';
  end if;
  if nullif(p_payload ->> 'package_id', '') is not null and not exists (
    select 1 from public.packages where id = (p_payload ->> 'package_id')::uuid and is_active and is_published
  ) then raise exception using errcode = '23503', message = 'package_unavailable'; end if;
  if nullif(p_payload ->> 'track_id', '') is not null and not exists (
    select 1 from public.tracks where id = (p_payload ->> 'track_id')::uuid and is_active
  ) then raise exception using errcode = '23503', message = 'track_unavailable'; end if;

  generated_order := 'NW-A-' || upper(encode(extensions.gen_random_bytes(10), 'hex'));
  insert into public.applications(
    order_no, student_name, student_gender, student_age, guardian_name, contact_email, contact_phone,
    country_code, timezone, track_id, package_id, self_level, preferred_times,
    preferred_teacher_gender, notes, consent_version, source, lookup_hash, request_ip_hash, contact_hash
  ) values (
    generated_order, p_payload ->> 'student_name', (p_payload ->> 'student_gender')::public.gender_t,
    (p_payload ->> 'student_age')::smallint, nullif(p_payload ->> 'guardian_name', ''),
    nullif(p_payload ->> 'contact_email', ''), nullif(p_payload ->> 'contact_phone', ''),
    nullif(p_payload ->> 'country_code', ''), p_payload ->> 'timezone',
    nullif(p_payload ->> 'track_id', '')::uuid, nullif(p_payload ->> 'package_id', '')::uuid,
    p_payload ->> 'self_level', p_payload -> 'preferred_times',
    nullif(p_payload ->> 'preferred_teacher_gender', '')::public.gender_t,
    nullif(p_payload ->> 'notes', ''), p_payload ->> 'consent_version',
    coalesce(nullif(p_payload ->> 'source', ''), 'website'), p_lookup_hash, p_ip_hash, p_contact_hash
  );
  return generated_order;
end;
$$;

revoke execute on function public.submit_application(jsonb,text,text,text) from public, anon, authenticated;
grant execute on function public.submit_application(jsonb,text,text,text) to service_role;

insert into supabase_migrations.schema_migrations(version, statements, name) values ('20261021110000', array[]::text[], 'create_applications') on conflict (version) do nothing;
-- END MIGRATION 20261021110000_create_applications.sql
-- BEGIN MIGRATION 20261021120000_fix_package_validation_privileges.sql
grant execute on function private.is_valid_package_policy(jsonb) to authenticated, service_role;

insert into supabase_migrations.schema_migrations(version, statements, name) values ('20261021120000', array[]::text[], 'fix_package_validation_privileges') on conflict (version) do nothing;
-- END MIGRATION 20261021120000_fix_package_validation_privileges.sql
-- BEGIN MIGRATION 20261021130000_add_application_crm.sql
create or replace function public.enforce_application_transition()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if old.status = new.status then return new; end if;
  if not (
    (old.status = 'new' and new.status in ('contacted','rejected','postponed'))
    or (old.status = 'contacted' and new.status in ('trial_booked','accepted','rejected','postponed'))
    or (old.status = 'trial_booked' and new.status in ('accepted','rejected','postponed'))
    or (old.status = 'postponed' and new.status in ('contacted','rejected'))
  ) then raise exception using errcode = 'P0001', message = 'invalid_application_transition'; end if;
  return new;
end;
$$;
revoke execute on function public.enforce_application_transition() from public, anon, authenticated, service_role;
create trigger applications_enforce_transition before update of status on public.applications
for each row execute function public.enforce_application_transition();

create table public.placement_tests (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete restrict,
  evaluator_id uuid not null references public.profiles(id) on delete restrict,
  recitation_score smallint check (recitation_score between 0 and 100),
  tajweed_score smallint check (tajweed_score between 0 and 100),
  memorization_score smallint check (memorization_score between 0 and 100),
  recommended_track_id uuid references public.tracks(id) on delete restrict,
  recommended_package_id uuid references public.packages(id) on delete restrict,
  notes text check (notes is null or char_length(notes) <= 3000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index placement_tests_application_idx on public.placement_tests(application_id, created_at desc);
create trigger placement_tests_set_updated_at before update on public.placement_tests
for each row execute function public.set_updated_at();
create trigger placement_tests_audit after insert or update on public.placement_tests
for each row execute function public.audit_row();

alter table public.placement_tests enable row level security;
revoke all on public.placement_tests from public, anon, authenticated, service_role;
grant select, insert, update on public.placement_tests to authenticated;
create policy placement_tests_admin_all on public.placement_tests for all to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()) and evaluator_id = (select auth.uid()));
create policy placement_tests_teacher_read on public.placement_tests for select to authenticated
using ((select public.auth_role()) = 'teacher' and evaluator_id = (select auth.uid()));
create policy placement_tests_teacher_create on public.placement_tests for insert to authenticated
with check ((select public.auth_role()) = 'teacher' and evaluator_id = (select auth.uid()));

create or replace function public.convert_application_to_student(p_application uuid)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  managed_application public.applications%rowtype;
  new_student_id uuid;
begin
  if not public.is_admin() then raise exception using errcode = '42501', message = 'admin_mfa_required'; end if;
  select * into managed_application from public.applications where id = p_application for update;
  if managed_application.id is null then raise exception using errcode = 'P0002', message = 'application_not_found'; end if;
  if managed_application.converted_student_id is not null then return managed_application.converted_student_id; end if;
  if managed_application.status <> 'accepted' then raise exception using errcode = 'P0001', message = 'application_not_accepted'; end if;

  insert into public.students(full_name, gender, status, joined_at, country_code, timezone)
  values (managed_application.student_name, managed_application.student_gender, 'active', current_date, managed_application.country_code, managed_application.timezone)
  returning id into new_student_id;
  insert into public.student_private_notes(student_id, special_notes, share_with_teacher)
  values (new_student_id, nullif(managed_application.notes, ''), false);
  update public.applications set converted_student_id = new_student_id where id = managed_application.id;
  return new_student_id;
end;
$$;
revoke execute on function public.convert_application_to_student(uuid) from public, anon;
grant execute on function public.convert_application_to_student(uuid) to authenticated;

insert into supabase_migrations.schema_migrations(version, statements, name) values ('20261021130000', array[]::text[], 'add_application_crm') on conflict (version) do nothing;
-- END MIGRATION 20261021130000_add_application_crm.sql
-- BEGIN MIGRATION 20261021140000_add_application_status_lookup.sql
create or replace function public.lookup_application_status(
  p_order_no text,
  p_lookup_hash text
)
returns table(
  status public.application_status,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select application.status, application.updated_at
  from public.applications as application
  where application.order_no = p_order_no
    and application.lookup_hash = p_lookup_hash
  limit 1
$$;

revoke execute on function public.lookup_application_status(text, text) from public, anon, authenticated;
grant execute on function public.lookup_application_status(text, text) to service_role;

insert into supabase_migrations.schema_migrations(version, statements, name) values ('20261021140000', array[]::text[], 'add_application_status_lookup') on conflict (version) do nothing;
-- END MIGRATION 20261021140000_add_application_status_lookup.sql
-- BEGIN MIGRATION 20261021150000_extend_subscriptions.sql
alter table public.subscriptions
  add column package_id uuid references public.packages(id) on delete restrict,
  add column source_application_id uuid references public.applications(id) on delete restrict,
  add column renew_date date,
  add column auto_renew boolean not null default false,
  add column price_amount numeric(12,2),
  add column price_currency char(3),
  add column price_country char(2) references public.countries(code) on delete restrict,
  add column package_snapshot jsonb,
  add column coupon_id uuid references public.coupons(id) on delete restrict,
  add column created_by uuid references public.profiles(id) on delete restrict;

alter table public.subscriptions
  add constraint subscriptions_renewal_after_period
    check (renew_date is null or renew_date > current_period_end),
  add constraint subscriptions_price_nonnegative
    check (price_amount is null or price_amount >= 0),
  add constraint subscriptions_currency_iso
    check (price_currency is null or (price_currency = upper(price_currency) and btrim(price_currency) ~ '^[A-Z]{3}$')),
  add constraint subscriptions_country_iso
    check (price_country is null or (price_country = upper(price_country) and btrim(price_country) ~ '^[A-Z]{2}$')),
  add constraint subscriptions_snapshots_are_objects
    check (
      jsonb_typeof(policy_snapshot) = 'object'
      and (package_snapshot is null or jsonb_typeof(package_snapshot) = 'object')
    ),
  add constraint subscriptions_package_snapshot_complete
    check (
      package_id is null
      or (
        price_amount is not null
        and price_currency is not null
        and price_country is not null
        and policy_snapshot is not null
        and package_snapshot is not null
        and renew_date is not null
      )
    );

create unique index subscriptions_source_application_idx
on public.subscriptions (source_application_id)
where source_application_id is not null;
create index subscriptions_package_status_idx
on public.subscriptions (package_id, status, current_period_end);
create index subscriptions_renewal_idx
on public.subscriptions (renew_date, status)
where status in ('trial', 'active', 'paused');

create or replace function public.create_subscription(
  p_student uuid,
  p_package uuid,
  p_country char(2),
  p_start_date date default current_date,
  p_application uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_package public.packages%rowtype;
  selected_price record;
  selected_application public.applications%rowtype;
  period_end date;
  next_renewal date;
  period_sessions integer;
  new_subscription_id uuid;
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'admin_mfa_required';
  end if;
  if p_student is null or p_package is null or p_start_date is null
    or p_country is null or upper(btrim(p_country)) !~ '^[A-Z]{2}$' then
    raise exception using errcode = '22023', message = 'invalid_subscription_input';
  end if;
  if not exists (select 1 from public.students where id = p_student and status = 'active') then
    raise exception using errcode = 'P0002', message = 'active_student_not_found';
  end if;

  select * into selected_package
  from public.packages
  where id = p_package and is_active and is_published
  for share;
  if selected_package.id is null then
    raise exception using errcode = 'P0002', message = 'published_package_not_found';
  end if;

  select * into selected_price
  from public.resolve_price(p_package, upper(btrim(p_country))::char(2), pg_catalog.clock_timestamp());
  if selected_price.amount is null then
    raise exception using errcode = 'P0002', message = 'package_price_not_found';
  end if;

  if p_application is not null then
    select * into selected_application
    from public.applications
    where id = p_application
    for update;
    if selected_application.id is null then
      raise exception using errcode = 'P0002', message = 'application_not_found';
    end if;
    if selected_application.status <> 'accepted'
      or selected_application.converted_student_id is distinct from p_student then
      raise exception using errcode = 'P0001', message = 'application_not_ready_for_subscription';
    end if;
    if selected_application.package_id is not null
      and selected_application.package_id is distinct from p_package then
      raise exception using errcode = 'P0001', message = 'application_package_mismatch';
    end if;
  end if;

  case selected_package.billing_period
    when 'monthly' then
      period_end := (p_start_date + interval '1 month' - interval '1 day')::date;
      period_sessions := selected_package.sessions_per_week * 4;
    when 'quarterly' then
      period_end := (p_start_date + interval '3 months' - interval '1 day')::date;
      period_sessions := selected_package.sessions_per_week * 13;
    when 'yearly' then
      period_end := (p_start_date + interval '1 year' - interval '1 day')::date;
      period_sessions := selected_package.sessions_per_week * 52;
    else
      raise exception using errcode = '22023', message = 'invalid_billing_period';
  end case;
  next_renewal := period_end + 1;

  insert into public.subscriptions (
    student_id, package_id, source_application_id, status, start_date,
    current_period_start, current_period_end, renew_date, auto_renew,
    price_amount, price_currency, price_country, policy_snapshot,
    package_snapshot, sessions_per_period, created_by
  ) values (
    p_student, p_package, p_application, 'trial', p_start_date,
    p_start_date, period_end, next_renewal, false,
    selected_price.amount, selected_price.currency, selected_price.country_code,
    selected_package.policy,
    jsonb_build_object(
      'id', selected_package.id,
      'slug', selected_package.slug,
      'track_id', selected_package.track_id,
      'name_ar', selected_package.name_ar,
      'name_en', selected_package.name_en,
      'sessions_per_week', selected_package.sessions_per_week,
      'duration_min', selected_package.duration_min,
      'billing_period', selected_package.billing_period,
      'features', selected_package.features,
      'captured_at', pg_catalog.clock_timestamp()
    ),
    period_sessions,
    (select auth.uid())
  )
  returning id into new_subscription_id;

  return new_subscription_id;
exception
  when unique_violation then
    if p_application is not null then
      select id into new_subscription_id
      from public.subscriptions
      where source_application_id = p_application;
      if new_subscription_id is not null then return new_subscription_id; end if;
    end if;
    raise exception using errcode = '23505', message = 'student_already_has_current_subscription';
end;
$$;

revoke execute on function public.create_subscription(uuid, uuid, char, date, uuid)
from public, anon;
grant execute on function public.create_subscription(uuid, uuid, char, date, uuid)
to authenticated;

comment on function public.create_subscription(uuid, uuid, char, date, uuid) is
'Creates a trial subscription from immutable package, policy, and resolved-price snapshots. Activation and credit grants remain payment-confirmation responsibilities.';

insert into supabase_migrations.schema_migrations(version, statements, name) values ('20261021150000', array[]::text[], 'extend_subscriptions') on conflict (version) do nothing;
-- END MIGRATION 20261021150000_extend_subscriptions.sql
-- BEGIN MIGRATION 20261021170000_create_billing_ledger.sql
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

insert into supabase_migrations.schema_migrations(version, statements, name) values ('20261021170000', array[]::text[], 'create_billing_ledger') on conflict (version) do nothing;
-- END MIGRATION 20261021170000_create_billing_ledger.sql
-- BEGIN MIGRATION 20261021190000_add_payment_notifications.sql
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

insert into supabase_migrations.schema_migrations(version, statements, name) values ('20261021190000', array[]::text[], 'add_payment_notifications') on conflict (version) do nothing;
-- END MIGRATION 20261021190000_add_payment_notifications.sql
-- BEGIN MIGRATION 20261021210000_harden_payment_methods.sql
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

insert into supabase_migrations.schema_migrations(version, statements, name) values ('20261021210000', array[]::text[], 'harden_payment_methods') on conflict (version) do nothing;
-- END MIGRATION 20261021210000_harden_payment_methods.sql
-- BEGIN MIGRATION 20261021230000_add_pricing_grid_bulk.sql
create or replace function public.bulk_append_package_prices(
  p_source_country char(2),
  p_target_country char(2),
  p_multiplier numeric,
  p_round_to numeric,
  p_valid_from timestamptz,
  p_package_ids uuid[] default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  target_currency char(3);
  inserted_count integer;
begin
  if actor_id is null or not public.is_admin() then
    raise exception using errcode = '42501', message = 'admin_mfa_required';
  end if;
  if upper(btrim(p_source_country)) !~ '^[A-Z]{2}$'
    or upper(btrim(p_target_country)) !~ '^[A-Z]{2}$'
    or p_multiplier is null or p_multiplier <= 0 or p_multiplier > 1000
    or p_round_to is null or p_round_to < 0.01 or p_round_to > 10000
    or p_valid_from is null
    or p_valid_from < pg_catalog.clock_timestamp() - interval '5 minutes'
    or p_valid_from > pg_catalog.clock_timestamp() + interval '5 years'
    or (p_package_ids is not null and cardinality(p_package_ids) = 0) then
    raise exception using errcode = '22023', message = 'pricing_bulk_input_invalid';
  end if;
  if p_package_ids is not null and cardinality(p_package_ids) <> (
    select count(distinct id) from unnest(p_package_ids) as id
  ) then
    raise exception using errcode = '22023', message = 'pricing_bulk_duplicate_package';
  end if;

  select currency into target_currency
  from public.countries
  where code = upper(btrim(p_target_country)) and is_enabled;
  if target_currency is null then
    raise exception using errcode = 'P0002', message = 'pricing_target_country_unavailable';
  end if;

  insert into public.package_prices(
    package_id, country_code, currency, amount, is_active, valid_from, created_by
  )
  select
    package.id,
    upper(btrim(p_target_country)),
    target_currency,
    (round((source_price.amount * p_multiplier) / p_round_to) * p_round_to)::numeric(12,2),
    true,
    p_valid_from,
    actor_id
  from public.packages as package
  join lateral (
    select price.amount
    from public.package_prices as price
    where price.package_id = package.id
      and price.country_code = upper(btrim(p_source_country))
      and price.valid_from <= pg_catalog.clock_timestamp()
      and price.is_active
    order by price.valid_from desc
    limit 1
  ) as source_price on true
  where package.is_active
    and (p_package_ids is null or package.id = any(p_package_ids));

  get diagnostics inserted_count = row_count;
  if inserted_count = 0 then
    raise exception using errcode = 'P0002', message = 'pricing_source_prices_not_found';
  end if;
  return inserted_count;
exception
  when unique_violation then
    raise exception using errcode = '23505', message = 'pricing_schedule_conflict';
end;
$$;

revoke execute on function public.bulk_append_package_prices(character, character, numeric, numeric, timestamptz, uuid[])
from public, anon;
grant execute on function public.bulk_append_package_prices(character, character, numeric, numeric, timestamptz, uuid[])
to authenticated, service_role;

insert into supabase_migrations.schema_migrations(version, statements, name) values ('20261021230000', array[]::text[], 'add_pricing_grid_bulk') on conflict (version) do nothing;
-- END MIGRATION 20261021230000_add_pricing_grid_bulk.sql
-- BEGIN MIGRATION 20261022010000_add_subscription_renewals.sql
alter table public.subscriptions
  add column scheduled_package_id uuid references public.packages(id) on delete restrict,
  add column pause_reason text check (pause_reason is null or char_length(btrim(pause_reason)) between 2 and 500);

alter table public.invoices
  add column purpose text not null default 'initial' check (purpose in ('initial', 'renewal', 'proration')),
  add column billing_period_start date,
  add column billing_period_end date,
  add column metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  add constraint invoices_billing_period_valid check (
    (billing_period_start is null and billing_period_end is null)
    or (billing_period_start is not null and billing_period_end >= billing_period_start)
  );

create unique index invoices_one_renewal_period_idx
on public.invoices (subscription_id, billing_period_start)
where purpose = 'renewal' and status <> 'void';
create unique index invoices_one_open_proration_idx
on public.invoices (subscription_id)
where purpose = 'proration' and status in ('draft', 'issued', 'partially_paid', 'overdue');
create unique index session_credit_ledger_invoice_proration_idx
on public.session_credit_ledger (source_invoice_id)
where reason = 'proration' and source_invoice_id is not null;

create table public.subscription_renewal_alerts (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.subscriptions(id) on delete cascade,
  period_end date not null,
  days_before smallint not null check (days_before in (7, 3, 0)),
  created_at timestamptz not null default now(),
  unique (subscription_id, period_end, days_before)
);
alter table public.subscription_renewal_alerts enable row level security;
revoke all on public.subscription_renewal_alerts from public, anon, authenticated;
grant select on public.subscription_renewal_alerts to authenticated;
grant select, insert, update, delete on public.subscription_renewal_alerts to service_role;
create policy subscription_renewal_alerts_admin_read on public.subscription_renewal_alerts
for select to authenticated using ((select public.is_admin()));

create or replace function private.subscription_target_snapshot(target_package_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', package.id, 'slug', package.slug, 'track_id', package.track_id,
    'name_ar', package.name_ar, 'name_en', package.name_en,
    'sessions_per_week', package.sessions_per_week, 'duration_min', package.duration_min,
    'billing_period', package.billing_period, 'features', package.features,
    'captured_at', pg_catalog.clock_timestamp()
  )
  from public.packages as package
  where package.id = target_package_id and package.is_active and package.is_published
$$;
revoke execute on function private.subscription_target_snapshot(uuid) from public, anon, authenticated, service_role;

create or replace function private.subscription_period(target_package_id uuid, period_start date)
returns table(period_end date, sessions integer)
language sql
stable
security definer
set search_path = ''
as $$
  select
    case package.billing_period
      when 'monthly' then (period_start + interval '1 month' - interval '1 day')::date
      when 'quarterly' then (period_start + interval '3 months' - interval '1 day')::date
      when 'yearly' then (period_start + interval '1 year' - interval '1 day')::date
    end,
    package.sessions_per_week * case package.billing_period when 'monthly' then 4 when 'quarterly' then 13 else 52 end
  from public.packages as package where package.id = target_package_id
$$;
revoke execute on function private.subscription_period(uuid, date) from public, anon, authenticated, service_role;

create or replace function private.apply_paid_invoice(target_invoice uuid, actor uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  invoice_row public.invoices%rowtype;
  subscription_row public.subscriptions%rowtype;
  target_sessions integer;
  current_balance integer;
  ledger_delta integer;
begin
  select * into invoice_row from public.invoices where id = target_invoice for update;
  if invoice_row.id is null or invoice_row.status <> 'paid' or invoice_row.subscription_id is null then return; end if;
  select * into subscription_row from public.subscriptions where id = invoice_row.subscription_id for update;
  if invoice_row.purpose = 'initial' then
    if subscription_row.status in ('trial', 'expired') then
      update public.subscriptions set status = 'active' where id = subscription_row.id;
    end if;
    insert into public.session_credit_ledger(subscription_id, delta, reason, note, created_by, source_invoice_id)
    values (subscription_row.id, subscription_row.sessions_per_period, 'grant', 'invoice:' || invoice_row.invoice_no, actor, invoice_row.id)
    on conflict (source_invoice_id) where reason = 'grant' and source_invoice_id is not null do nothing;
  elsif invoice_row.purpose = 'renewal' then
    target_sessions := (invoice_row.metadata ->> 'sessions_per_period')::integer;
    update public.subscriptions set
      package_id = (invoice_row.metadata ->> 'package_id')::uuid,
      status = 'active', current_period_start = invoice_row.billing_period_start,
      current_period_end = invoice_row.billing_period_end, renew_date = invoice_row.billing_period_end + 1,
      price_amount = (invoice_row.metadata ->> 'price_amount')::numeric,
      price_currency = invoice_row.currency, price_country = invoice_row.metadata ->> 'price_country',
      policy_snapshot = invoice_row.metadata -> 'policy_snapshot',
      package_snapshot = invoice_row.metadata -> 'package_snapshot',
      sessions_per_period = target_sessions, scheduled_package_id = null,
      paused_until = null, pause_reason = null
    where id = subscription_row.id;
    insert into public.session_credit_ledger(subscription_id, delta, reason, note, created_by, source_invoice_id)
    values (subscription_row.id, target_sessions, 'grant', 'renewal:' || invoice_row.invoice_no, actor, invoice_row.id)
    on conflict (source_invoice_id) where reason = 'grant' and source_invoice_id is not null do nothing;
  else
    target_sessions := (invoice_row.metadata ->> 'sessions_per_period')::integer;
    select coalesce(sessions_remaining, 0) into current_balance
    from public.subscription_balance where subscription_id = subscription_row.id;
    current_balance := coalesce(current_balance, 0);
    ledger_delta := target_sessions - current_balance;
    update public.subscriptions set
      package_id = (invoice_row.metadata ->> 'package_id')::uuid,
      price_amount = (invoice_row.metadata ->> 'price_amount')::numeric,
      price_currency = invoice_row.currency, price_country = invoice_row.metadata ->> 'price_country',
      policy_snapshot = invoice_row.metadata -> 'policy_snapshot',
      package_snapshot = invoice_row.metadata -> 'package_snapshot',
      sessions_per_period = target_sessions, scheduled_package_id = null
    where id = subscription_row.id;
    if ledger_delta <> 0 then
      insert into public.session_credit_ledger(subscription_id, delta, reason, note, created_by, source_invoice_id)
      values (subscription_row.id, ledger_delta, 'proration', 'proration:' || invoice_row.invoice_no, actor, invoice_row.id)
      on conflict (source_invoice_id) where reason = 'proration' and source_invoice_id is not null do nothing;
    end if;
  end if;
end;
$$;
revoke execute on function private.apply_paid_invoice(uuid, uuid) from public, anon, authenticated, service_role;

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
begin
  if new.status is not distinct from old.status then return new; end if;
  select * into invoice_row from public.invoices where id = new.invoice_id for update;
  select coalesce(sum(case when kind = 'payment' then amount else -amount end), 0)
  into paid_total from public.payments where invoice_id = new.invoice_id and status = 'confirmed';
  due_total := greatest(invoice_row.total - paid_total, 0);
  next_status := case when due_total = 0 then 'paid'::public.invoice_status when paid_total > 0 then 'partially_paid'::public.invoice_status when invoice_row.due_date < current_date then 'overdue'::public.invoice_status else 'issued'::public.invoice_status end;
  update public.invoices set status = next_status where id = invoice_row.id and status is distinct from next_status;
  if next_status = 'paid' then perform private.apply_paid_invoice(invoice_row.id, new.confirmed_by); end if;
  return new;
end;
$$;

create or replace function public.process_subscription_renewals(p_as_of date default current_date)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  subscription_row public.subscriptions%rowtype;
  target_package public.packages%rowtype;
  resolved_price record;
  next_period record;
  payer_id uuid;
  invoice_id uuid;
  alerts_created integer := 0;
  invoices_created integer := 0;
  inserted_alert uuid;
begin
  if current_user not in ('postgres', 'service_role') and not public.is_admin() then raise exception using errcode = '42501', message = 'admin_mfa_required'; end if;
  update public.subscriptions set status = 'active', paused_until = null, pause_reason = null
  where status = 'paused' and paused_until <= p_as_of and current_period_end >= p_as_of;
  update public.subscriptions set status = 'expired'
  where status in ('trial','active','paused') and current_period_end < p_as_of;

  for subscription_row in
    select * from public.subscriptions
    where status in ('trial','active','paused') and current_period_end - p_as_of in (7,3,0)
    for update
  loop
    insert into public.subscription_renewal_alerts(subscription_id, period_end, days_before)
    values (subscription_row.id, subscription_row.current_period_end, subscription_row.current_period_end - p_as_of)
    on conflict do nothing returning id into inserted_alert;
    if inserted_alert is not null then
      alerts_created := alerts_created + 1;
      select payer_profile_id into payer_id from public.invoices where subscription_id = subscription_row.id order by created_at desc limit 1;
      if payer_id is not null then
        perform private.enqueue_notification(payer_id, 'subscription_renewal_due', jsonb_build_object('subscription_id', subscription_row.id, 'days_before', subscription_row.current_period_end - p_as_of, 'period_end', subscription_row.current_period_end));
      end if;
    end if;
    inserted_alert := null;

    if subscription_row.current_period_end - p_as_of = 7 and not exists (
      select 1 from public.invoices where subscription_id = subscription_row.id and purpose = 'renewal' and billing_period_start = subscription_row.current_period_end + 1 and status <> 'void'
    ) then
      select * into target_package from public.packages where id = coalesce(subscription_row.scheduled_package_id, subscription_row.package_id);
      select * into resolved_price from public.resolve_price(target_package.id, subscription_row.price_country, pg_catalog.clock_timestamp());
      select * into next_period from private.subscription_period(target_package.id, subscription_row.current_period_end + 1);
      if resolved_price.amount is not null and next_period.period_end is not null then
        insert into public.invoices(subscription_id, student_id, payer_profile_id, currency, due_date, locale, created_by, purpose, billing_period_start, billing_period_end, metadata)
        select subscription_row.id, subscription_row.student_id, previous.payer_profile_id, resolved_price.currency,
          subscription_row.current_period_end, previous.locale, (select auth.uid()), 'renewal', subscription_row.current_period_end + 1, next_period.period_end,
          jsonb_build_object('package_id', target_package.id, 'price_amount', resolved_price.amount, 'price_country', resolved_price.country_code, 'sessions_per_period', next_period.sessions, 'policy_snapshot', target_package.policy, 'package_snapshot', private.subscription_target_snapshot(target_package.id))
        from public.invoices as previous where previous.subscription_id = subscription_row.id order by previous.created_at desc limit 1
        returning id into invoice_id;
        insert into public.invoice_items(invoice_id, kind, description_ar, description_en, quantity, unit_amount)
        values (invoice_id, 'subscription', 'تجديد اشتراك ' || target_package.name_ar, 'Subscription renewal · ' || coalesce(target_package.name_en, target_package.name_ar), 1, resolved_price.amount);
        update public.invoices set status = 'issued' where id = invoice_id;
        invoices_created := invoices_created + 1;
      end if;
    end if;
  end loop;
  return jsonb_build_object('alerts', alerts_created, 'invoices', invoices_created);
end;
$$;
revoke execute on function public.process_subscription_renewals(date) from public, anon;
grant execute on function public.process_subscription_renewals(date) to authenticated, service_role;

create or replace function public.pause_subscription(p_subscription uuid, p_until date, p_reason text)
returns void language plpgsql security definer set search_path = ''
as $$
declare subscription_row public.subscriptions%rowtype; max_days integer;
begin
  if not public.is_admin() then raise exception using errcode = '42501', message = 'admin_mfa_required'; end if;
  select * into subscription_row from public.subscriptions where id = p_subscription for update;
  if subscription_row.id is null or subscription_row.status <> 'active' then raise exception using errcode = 'P0001', message = 'subscription_not_pausable'; end if;
  max_days := coalesce((subscription_row.policy_snapshot ->> 'max_pause_days')::integer, 0);
  if p_until <= current_date or p_until > current_date + max_days or char_length(btrim(p_reason)) not between 2 and 500 then raise exception using errcode = '22023', message = 'pause_period_invalid'; end if;
  update public.subscriptions set status = 'paused', paused_until = p_until, pause_reason = btrim(p_reason) where id = p_subscription;
end;
$$;
revoke execute on function public.pause_subscription(uuid, date, text) from public, anon;
grant execute on function public.pause_subscription(uuid, date, text) to authenticated, service_role;

create or replace function public.request_subscription_change(p_subscription uuid, p_target_package uuid)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare subscription_row public.subscriptions%rowtype; target_package public.packages%rowtype; resolved_price record; target_period record; current_balance integer; credit numeric(12,2); difference numeric(12,2); invoice_id uuid; payer_id uuid; invoice_locale text;
begin
  if not public.is_admin() then raise exception using errcode = '42501', message = 'admin_mfa_required'; end if;
  select * into subscription_row from public.subscriptions where id = p_subscription for update;
  select * into target_package from public.packages where id = p_target_package and is_active and is_published;
  if subscription_row.id is null or subscription_row.status not in ('active','paused') or target_package.id is null then raise exception using errcode = 'P0001', message = 'subscription_change_invalid'; end if;
  select * into resolved_price from public.resolve_price(target_package.id, subscription_row.price_country, pg_catalog.clock_timestamp());
  if resolved_price.amount is null then raise exception using errcode = 'P0002', message = 'package_price_not_found'; end if;
  if resolved_price.amount <= subscription_row.price_amount then
    update public.subscriptions set scheduled_package_id = target_package.id where id = subscription_row.id;
    return null;
  end if;
  select coalesce(sessions_remaining, 0) into current_balance from public.subscription_balance where subscription_id = subscription_row.id;
  current_balance := coalesce(current_balance, 0);
  credit := round(current_balance * (subscription_row.price_amount / subscription_row.sessions_per_period), 2);
  difference := greatest(resolved_price.amount - credit, 0);
  select * into target_period from private.subscription_period(target_package.id, subscription_row.current_period_start);
  select payer_profile_id, locale into payer_id, invoice_locale from public.invoices where subscription_id = subscription_row.id order by created_at desc limit 1;
  insert into public.invoices(subscription_id, student_id, payer_profile_id, currency, due_date, locale, created_by, purpose, billing_period_start, billing_period_end, metadata)
  values (subscription_row.id, subscription_row.student_id, payer_id, resolved_price.currency, current_date, coalesce(invoice_locale,'ar'), (select auth.uid()), 'proration', subscription_row.current_period_start, subscription_row.current_period_end,
    jsonb_build_object('package_id', target_package.id, 'price_amount', resolved_price.amount, 'price_country', resolved_price.country_code, 'sessions_per_period', target_period.sessions, 'policy_snapshot', target_package.policy, 'package_snapshot', private.subscription_target_snapshot(target_package.id), 'credit', credit)) returning id into invoice_id;
  insert into public.invoice_items(invoice_id, kind, description_ar, description_en, quantity, unit_amount)
  values (invoice_id, 'proration', 'ترقية إلى ' || target_package.name_ar, 'Upgrade to ' || coalesce(target_package.name_en,target_package.name_ar), 1, resolved_price.amount);
  if credit > 0 then insert into public.invoice_items(invoice_id, kind, description_ar, description_en, quantity, unit_amount) values (invoice_id, 'discount', 'رصيد الحصص المتبقية', 'Remaining-session credit', 1, -credit); end if;
  update public.invoices set status = case when difference = 0 then 'paid'::public.invoice_status else 'issued'::public.invoice_status end where id = invoice_id;
  if difference = 0 then perform private.apply_paid_invoice(invoice_id, (select auth.uid())); end if;
  return invoice_id;
end;
$$;
revoke execute on function public.request_subscription_change(uuid, uuid) from public, anon;
grant execute on function public.request_subscription_change(uuid, uuid) to authenticated, service_role;

create or replace function private.guard_invoice_change()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if old.status <> 'draft' then raise exception using errcode = 'P0001', message = 'invoice_immutable'; end if;
    return old;
  end if;
  if old.status <> 'draft' and (
    new.subscription_id is distinct from old.subscription_id or new.student_id is distinct from old.student_id
    or new.payer_profile_id is distinct from old.payer_profile_id or new.currency is distinct from old.currency
    or new.subtotal is distinct from old.subtotal or new.discount_total is distinct from old.discount_total
    or new.total is distinct from old.total or new.due_date is distinct from old.due_date
    or new.locale is distinct from old.locale or new.purpose is distinct from old.purpose
    or new.billing_period_start is distinct from old.billing_period_start
    or new.billing_period_end is distinct from old.billing_period_end or new.metadata is distinct from old.metadata
  ) then raise exception using errcode = 'P0001', message = 'invoice_immutable'; end if;
  if old.status is distinct from new.status and not (
    (old.status = 'draft' and new.status in ('issued','paid','void'))
    or (old.status = 'issued' and new.status in ('partially_paid','paid','overdue','void'))
    or (old.status = 'partially_paid' and new.status in ('paid','overdue'))
    or (old.status = 'overdue' and new.status in ('partially_paid','paid','void'))
    or (old.status = 'paid' and new.status = 'partially_paid')
  ) then raise exception using errcode = 'P0001', message = 'invalid_invoice_transition'; end if;
  if old.status = 'draft' and new.status in ('issued','paid') then
    new.issued_at := coalesce(new.issued_at, pg_catalog.clock_timestamp());
    if new.due_date is null then new.due_date := current_date; end if;
  end if;
  return new;
end;
$$;

select cron.schedule('process-subscription-renewals', '15 1 * * *', $$select public.process_subscription_renewals(current_date)$$)
where not exists (select 1 from cron.job where jobname = 'process-subscription-renewals');

insert into supabase_migrations.schema_migrations(version, statements, name) values ('20261022010000', array[]::text[], 'add_subscription_renewals') on conflict (version) do nothing;
-- END MIGRATION 20261022010000_add_subscription_renewals.sql
-- BEGIN MIGRATION 20261022030000_add_expenses_and_statements.sql
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

insert into supabase_migrations.schema_migrations(version, statements, name) values ('20261022030000', array[]::text[], 'add_expenses_and_statements') on conflict (version) do nothing;
-- END MIGRATION 20261022030000_add_expenses_and_statements.sql
-- BEGIN MIGRATION 20261022050000_add_teacher_payouts.sql
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

insert into supabase_migrations.schema_migrations(version, statements, name) values ('20261022050000', array[]::text[], 'add_teacher_payouts') on conflict (version) do nothing;
-- END MIGRATION 20261022050000_add_teacher_payouts.sql
-- BEGIN MIGRATION 20261022070000_add_financial_reconciliation.sql
create table public.reconciliation_runs (
  id uuid primary key default gen_random_uuid(),
  scope text not null default 'financial' check (scope = 'financial'),
  status text not null default 'running' check (status in ('running', 'passed', 'failed')),
  issue_count integer not null default 0 check (issue_count >= 0),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  triggered_by uuid references public.profiles(id) on delete restrict,
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object')
);
create table public.reconciliation_issues (
  id bigint generated always as identity primary key,
  run_id uuid not null references public.reconciliation_runs(id) on delete cascade,
  category text not null check (category in (
    'invoice_status', 'invoice_credit', 'session_credit', 'payout_total', 'payout_expense', 'payout_item'
  )),
  entity_id uuid not null,
  expected text not null,
  actual text not null,
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  created_at timestamptz not null default now()
);
create index reconciliation_runs_started_idx on public.reconciliation_runs(started_at desc);
create index reconciliation_issues_run_category_idx on public.reconciliation_issues(run_id, category);

alter table public.reconciliation_runs enable row level security;
alter table public.reconciliation_issues enable row level security;
revoke all on public.reconciliation_runs, public.reconciliation_issues from public, anon, authenticated;
grant select on public.reconciliation_runs, public.reconciliation_issues to authenticated;
grant select, insert, update, delete on public.reconciliation_runs, public.reconciliation_issues to service_role;
create policy reconciliation_runs_admin_read on public.reconciliation_runs for select to authenticated using ((select public.is_admin()));
create policy reconciliation_issues_admin_read on public.reconciliation_issues for select to authenticated using ((select public.is_admin()));

create or replace function public.run_financial_reconciliation()
returns uuid language plpgsql security definer set search_path = ''
as $$
declare result_id uuid; issues integer; actor uuid := (select auth.uid());
begin
  if current_user not in ('postgres','service_role') and not public.is_admin() then
    raise exception using errcode = '42501', message = 'admin_mfa_required';
  end if;
  insert into public.reconciliation_runs(triggered_by) values (actor) returning id into result_id;

  insert into public.reconciliation_issues(run_id, category, entity_id, expected, actual, details)
  select result_id, 'invoice_status', invoice.id,
    case when balance.due <= 0 then 'paid' when balance.paid > 0 then 'partially_paid' when invoice.due_date < current_date then 'overdue' else 'issued' end,
    invoice.status::text, jsonb_build_object('total', balance.total, 'paid', balance.paid, 'due', balance.due, 'currency', invoice.currency)
  from public.invoices as invoice join public.invoice_balance as balance on balance.invoice_id = invoice.id
  where invoice.status not in ('draft','void') and invoice.status::text <> case when balance.due <= 0 then 'paid' when balance.paid > 0 then 'partially_paid' when invoice.due_date < current_date then 'overdue' else 'issued' end;

  insert into public.reconciliation_issues(run_id, category, entity_id, expected, actual, details)
  select result_id, 'invoice_credit', invoice.id, '1', count(ledger.id)::text,
    jsonb_build_object('invoice_no', invoice.invoice_no, 'purpose', invoice.purpose)
  from public.invoices as invoice
  left join public.session_credit_ledger as ledger on ledger.source_invoice_id = invoice.id
    and ledger.reason = case when invoice.purpose = 'proration' then 'proration'::public.credit_reason else 'grant'::public.credit_reason end
  where invoice.status = 'paid' and invoice.subscription_id is not null
  group by invoice.id having count(ledger.id) <> 1;

  insert into public.reconciliation_issues(run_id, category, entity_id, expected, actual, details)
  select result_id, 'session_credit', session.id, 'one consume ledger entry', count(ledger.id)::text,
    jsonb_build_object('attendance_status', attendance.status, 'subscription_id', subscription.id)
  from public.attendance as attendance
  join public.sessions as session on session.id = attendance.session_id
  join lateral (
    select candidate.* from public.subscriptions as candidate
    where candidate.student_id = session.student_id
      and session.scheduled_at::date between candidate.current_period_start and candidate.current_period_end
    order by candidate.current_period_start desc limit 1
  ) as subscription on true
  left join public.session_credit_ledger as ledger on ledger.session_id = session.id and ledger.reason = 'consume'
  where attendance.status in ('present','late')
    or (attendance.status = 'student_absent' and (subscription.policy_snapshot ->> 'student_no_show_consumes_credit')::boolean)
    or (attendance.status = 'student_excused'
      and not (attendance.student_notice_at is not null and attendance.student_notice_at <= session.scheduled_at - pg_catalog.make_interval(hours => (subscription.policy_snapshot ->> 'cancel_notice_hours')::integer))
      and (subscription.policy_snapshot ->> 'student_no_show_consumes_credit')::boolean)
  group by session.id, attendance.status, subscription.id having count(ledger.id) <> 1;

  insert into public.reconciliation_issues(run_id, category, entity_id, expected, actual, details)
  select result_id, 'payout_item', item.id, item.rate_snapshot::text, item.amount::text,
    jsonb_build_object('session_id', item.session_id, 'teacher_id', item.teacher_id)
  from public.teacher_payout_items as item where item.amount <> item.rate_snapshot or item.rate_id is null;

  insert into public.reconciliation_issues(run_id, category, entity_id, expected, actual, details)
  select result_id, 'payout_total', payout.id,
    jsonb_build_object('gross', totals.gross, 'bonuses', totals.bonuses, 'deductions', totals.deductions, 'net', greatest(totals.gross + totals.bonuses - totals.deductions, 0))::text,
    jsonb_build_object('gross', payout.gross, 'bonuses', payout.bonuses, 'deductions', payout.deductions, 'net', payout.net)::text,
    jsonb_build_object('payout_no', payout.payout_no, 'currency', payout.currency)
  from public.teacher_payouts as payout
  cross join lateral (
    select coalesce((select sum(amount) from public.teacher_payout_items where payout_id = payout.id),0) as gross,
      coalesce((select sum(amount) from public.teacher_adjustments where payout_id = payout.id and kind = 'bonus'),0) as bonuses,
      coalesce((select sum(amount) from public.teacher_adjustments where payout_id = payout.id and kind = 'deduction'),0) as deductions
  ) as totals
  where payout.gross <> totals.gross or payout.bonuses <> totals.bonuses or payout.deductions <> totals.deductions
    or payout.net <> greatest(totals.gross + totals.bonuses - totals.deductions, 0);

  insert into public.reconciliation_issues(run_id, category, entity_id, expected, actual, details)
  select result_id, 'payout_expense', payout.id, payout.net::text,
    coalesce(sum(expense.amount) filter (where expense.status = 'recorded'),0)::text,
    jsonb_build_object('payout_no', payout.payout_no, 'currency', payout.currency)
  from public.teacher_payouts as payout left join public.expenses as expense on expense.payout_id = payout.id
  where payout.status = 'paid' group by payout.id having coalesce(sum(expense.amount) filter (where expense.status = 'recorded'),0) <> payout.net;

  select count(*)::integer into issues from public.reconciliation_issues where run_id = result_id;
  update public.reconciliation_runs set status = case when issues = 0 then 'passed' else 'failed' end,
    issue_count = issues, finished_at = now(), details = jsonb_build_object('checked_at', now()) where id = result_id;
  return result_id;
exception when others then
  if result_id is not null then update public.reconciliation_runs set status = 'failed', finished_at = now(), details = jsonb_build_object('execution_error', sqlstate) where id = result_id; end if;
  raise;
end;
$$;
revoke execute on function public.run_financial_reconciliation() from public, anon;
grant execute on function public.run_financial_reconciliation() to authenticated, service_role;

select cron.schedule('financial-reconciliation-nightly', '45 1 * * *', $$select public.run_financial_reconciliation()$$)
where not exists (select 1 from cron.job where jobname = 'financial-reconciliation-nightly');

comment on function public.run_financial_reconciliation() is
'Runs AC-120/AC-130 reconciliation without repairing or hiding discrepancies; every difference is retained for admin review.';

insert into supabase_migrations.schema_migrations(version, statements, name) values ('20261022070000', array[]::text[], 'add_financial_reconciliation') on conflict (version) do nothing;
-- END MIGRATION 20261022070000_add_financial_reconciliation.sql
