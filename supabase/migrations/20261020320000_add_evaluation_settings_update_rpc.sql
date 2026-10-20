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

