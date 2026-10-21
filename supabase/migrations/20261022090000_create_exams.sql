create table public.exams (
  id uuid primary key default gen_random_uuid(),
  title_ar text not null check (char_length(btrim(title_ar)) between 2 and 200),
  title_en text check (title_en is null or char_length(btrim(title_en)) between 2 and 200),
  kind text not null check (kind in ('monthly','term','final','juz')),
  session_type public.session_type_t not null default 'new_memo',
  track_id uuid references public.tracks(id) on delete restrict,
  max_score numeric(6,2) not null check (max_score > 0 and max_score <= 10000),
  weight numeric(5,2) not null default 1 check (weight > 0 and weight <= 100),
  held_on date not null,
  status text not null default 'draft' check (status in ('draft','open','closed')),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index exams_track_date_idx on public.exams(track_id, held_on desc);

create table public.exam_results (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams(id) on delete restrict,
  student_id uuid not null references public.students(id) on delete restrict,
  scores jsonb not null check (jsonb_typeof(scores) = 'object'),
  errors jsonb not null default '{"major":0,"minor":0,"prompts":0,"forgot":0}'::jsonb check (jsonb_typeof(errors) = 'object'),
  percentage numeric(6,2) not null default 0 check (percentage between 0 and 100),
  total numeric(8,2) not null default 0 check (total >= 0),
  rating smallint not null default 1 check (rating between 1 and 5),
  grade text not null default 'repeat' check (grade in ('repeat','pass','good','very_good','excellent')),
  settings_snapshot jsonb not null default '{}'::jsonb check (jsonb_typeof(settings_snapshot) = 'object'),
  entered_by uuid not null references public.profiles(id) on delete restrict,
  is_locked boolean not null default false,
  locked_by uuid references public.profiles(id) on delete restrict,
  locked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(exam_id, student_id),
  check ((is_locked and locked_by is not null and locked_at is not null) or (not is_locked and locked_by is null and locked_at is null))
);
create index exam_results_student_idx on public.exam_results(student_id, created_at desc);

create or replace function private.prepare_exam_result()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare exam_row public.exams%rowtype; settings_row public.eval_settings%rowtype;
  score_entry record; score_value numeric; criterion_weight numeric; weighted_sum numeric := 0; total_weight numeric := 0;
  deduction numeric; computed numeric; thresholds numeric[]; snapshot_weights jsonb := '{}'::jsonb;
  major_count integer; minor_count integer; prompt_count integer; forgot_count integer;
begin
  if tg_op = 'UPDATE' and old.is_locked then raise exception using errcode = 'P0001', message = 'exam_result_locked'; end if;
  select * into exam_row from public.exams where id = new.exam_id;
  if exam_row.id is null or exam_row.status <> 'open' then raise exception using errcode = 'P0001', message = 'exam_not_open'; end if;
  if new.scores = '{}'::jsonb then raise exception using errcode = '23514', message = 'exam_scores_required'; end if;
  select * into settings_row from public.eval_settings where session_type = exam_row.session_type;
  for score_entry in select key, value from jsonb_each(new.scores) loop
    if jsonb_typeof(score_entry.value) <> 'number' then raise exception using errcode = '23514', message = 'exam_score_invalid'; end if;
    score_value := (score_entry.value #>> '{}')::numeric;
    if score_value <> trunc(score_value) or score_value < 1 or score_value > 5 then raise exception using errcode = '23514', message = 'exam_score_out_of_range'; end if;
    select weight.weight into criterion_weight from public.eval_weights as weight
    join public.eval_criteria as criterion on criterion.code = weight.criterion_code
    where weight.session_type = exam_row.session_type and weight.criterion_code = score_entry.key and exam_row.session_type = any(criterion.applies_to);
    if criterion_weight is null then raise exception using errcode = '23514', message = 'exam_criterion_not_applicable'; end if;
    weighted_sum := weighted_sum + score_value * criterion_weight; total_weight := total_weight + criterion_weight;
    snapshot_weights := snapshot_weights || jsonb_build_object(score_entry.key, criterion_weight);
  end loop;
  if total_weight <= 0 then raise exception using errcode = '23514', message = 'exam_weights_invalid'; end if;
  major_count := coalesce((new.errors ->> 'major')::integer,0); minor_count := coalesce((new.errors ->> 'minor')::integer,0);
  prompt_count := coalesce((new.errors ->> 'prompts')::integer,0); forgot_count := coalesce((new.errors ->> 'forgot')::integer,0);
  if least(major_count,minor_count,prompt_count,forgot_count) < 0 then raise exception using errcode = '23514', message = 'exam_errors_invalid'; end if;
  deduction := major_count*settings_row.d_major + minor_count*settings_row.d_minor + prompt_count*settings_row.d_prompt + forgot_count*settings_row.d_forgot;
  computed := greatest(0, least(100, (weighted_sum / total_weight) * 20 - deduction));
  thresholds := array(select (value #>> '{}')::numeric from jsonb_array_elements(settings_row.rating_thresholds));
  new.percentage := round(computed,2); new.total := round(computed / 100 * exam_row.max_score,2);
  new.rating := case when computed >= thresholds[5] then 5 when computed >= thresholds[4] then 4 when computed >= thresholds[3] then 3 when computed >= thresholds[2] then 2 else 1 end;
  new.grade := case new.rating when 5 then 'excellent' when 4 then 'very_good' when 3 then 'good' when 2 then 'pass' else 'repeat' end;
  new.settings_snapshot := jsonb_build_object('session_type',exam_row.session_type,'max_score',exam_row.max_score,'weights',snapshot_weights,'deductions',jsonb_build_object('major',settings_row.d_major,'minor',settings_row.d_minor,'prompt',settings_row.d_prompt,'forgot',settings_row.d_forgot),'rating_thresholds',settings_row.rating_thresholds);
  return new;
end;
$$;
revoke execute on function private.prepare_exam_result() from public, anon, authenticated, service_role;
create trigger exam_results_prepare before insert or update of scores, errors on public.exam_results for each row execute function private.prepare_exam_result();
create trigger exams_updated before update on public.exams for each row execute function public.set_updated_at();
create trigger exam_results_updated before update on public.exam_results for each row execute function public.set_updated_at();
create trigger exams_audit after insert or update or delete on public.exams for each row execute function public.audit_row();
create trigger exam_results_audit after insert or update on public.exam_results for each row execute function public.audit_row();

create or replace function private.guard_exam_status()
returns trigger language plpgsql set search_path = '' as $$
begin
  if old.status is distinct from new.status and not (
    (old.status='draft' and new.status='open') or (old.status='open' and new.status='closed')
  ) then raise exception using errcode='P0001',message='invalid_exam_transition'; end if;
  return new;
end;
$$;
revoke execute on function private.guard_exam_status() from public,anon,authenticated,service_role;
create trigger exams_guard_status before update of status on public.exams for each row execute function private.guard_exam_status();

create or replace function public.save_exam_result(p_exam uuid, p_student uuid, p_scores jsonb, p_errors jsonb)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare exam_row public.exams%rowtype; result uuid; current_teacher uuid := (select private.current_teacher_id()); actor uuid := (select auth.uid());
begin
  if actor is null then raise exception using errcode = '42501', message = 'authentication_required'; end if;
  select * into exam_row from public.exams where id = p_exam;
  if exam_row.id is null or exam_row.status <> 'open' then raise exception using errcode = 'P0001', message = 'exam_not_open'; end if;
  if not public.is_admin() and (current_teacher is null or not exists (
    select 1 from public.teacher_assignments as assignment where assignment.teacher_id = current_teacher and assignment.student_id = p_student
      and assignment.status = 'active' and (exam_row.track_id is null or assignment.track_id = exam_row.track_id)
  )) then raise exception using errcode = '42501', message = 'exam_student_forbidden'; end if;
  insert into public.exam_results(exam_id,student_id,scores,errors,entered_by)
  values (p_exam,p_student,p_scores,p_errors,actor)
  on conflict(exam_id,student_id) do update set scores=excluded.scores,errors=excluded.errors,entered_by=actor
  returning id into result;
  return result;
end;
$$;
revoke execute on function public.save_exam_result(uuid,uuid,jsonb,jsonb) from public, anon;
grant execute on function public.save_exam_result(uuid,uuid,jsonb,jsonb) to authenticated, service_role;

create or replace function public.lock_exam_result(p_result uuid)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception using errcode = '42501', message = 'admin_mfa_required'; end if;
  update public.exam_results set is_locked=true,locked_by=(select auth.uid()),locked_at=now() where id=p_result and not is_locked;
  if not found then raise exception using errcode = 'P0001', message = 'exam_result_not_lockable'; end if;
end;
$$;
revoke execute on function public.lock_exam_result(uuid) from public, anon;
grant execute on function public.lock_exam_result(uuid) to authenticated, service_role;

alter table public.exams enable row level security; alter table public.exam_results enable row level security;
revoke all on public.exams,public.exam_results from public,anon,authenticated;
grant select,insert,update,delete on public.exams to authenticated; grant select on public.exam_results to authenticated;
grant select,insert,update,delete on public.exams,public.exam_results to service_role;
create policy exams_admin_all on public.exams for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy exams_authenticated_read on public.exams for select to authenticated using (status <> 'draft' or (select public.is_admin()));
create policy exam_results_admin_read on public.exam_results for select to authenticated using ((select public.is_admin()));
create policy exam_results_teacher_read on public.exam_results for select to authenticated using (exists(select 1 from public.teacher_assignments where teacher_id=(select private.current_teacher_id()) and student_id=exam_results.student_id and status='active'));
create policy exam_results_student_read on public.exam_results for select to authenticated using (is_locked and exists(select 1 from public.students where id=exam_results.student_id and profile_id=(select auth.uid())));
create policy exam_results_parent_read on public.exam_results for select to authenticated using (is_locked and (select private.guards_student(student_id)));
