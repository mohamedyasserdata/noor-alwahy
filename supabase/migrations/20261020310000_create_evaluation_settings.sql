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
