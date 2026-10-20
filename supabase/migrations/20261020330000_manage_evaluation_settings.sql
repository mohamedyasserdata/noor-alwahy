create or replace function public.update_evaluation_settings(
  p_session_type public.session_type_t,
  p_weights jsonb,
  p_d_major numeric,
  p_d_minor numeric,
  p_d_prompt numeric,
  p_d_forgot numeric,
  p_rating_thresholds jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  expected_weight_count integer;
begin
  if not (select public.is_admin()) then
    raise exception using errcode = '42501', message = 'evaluation_settings_forbidden';
  end if;

  if p_d_major < 0 or p_d_minor < 0 or p_d_prompt < 0 or p_d_forgot < 0 then
    raise exception using errcode = '23514', message = 'invalid_evaluation_deductions';
  end if;

  if not private.is_valid_rating_thresholds(p_rating_thresholds) then
    raise exception using errcode = '23514', message = 'invalid_rating_thresholds';
  end if;

  if jsonb_typeof(p_weights) <> 'object' then
    raise exception using errcode = '23514', message = 'invalid_evaluation_weights';
  end if;

  select count(*)::integer
  into expected_weight_count
  from public.eval_criteria
  where p_session_type = any(applies_to);

  if (select count(*) from jsonb_object_keys(p_weights)) <> expected_weight_count
    or exists (
      select 1
      from public.eval_criteria
      where p_session_type = any(applies_to)
        and not (p_weights ? code)
    )
    or exists (
      select 1
      from jsonb_each(p_weights) as supplied(code, weight)
      where jsonb_typeof(weight) <> 'number'
        or (weight #>> '{}')::numeric < 0
        or not exists (
          select 1
          from public.eval_criteria
          where eval_criteria.code = supplied.code
            and p_session_type = any(applies_to)
        )
    )
    or coalesce((select sum((value #>> '{}')::numeric) from jsonb_each(p_weights)), 0) <= 0
  then
    raise exception using errcode = '23514', message = 'invalid_evaluation_weights';
  end if;

  update public.eval_settings
  set d_major = p_d_major,
      d_minor = p_d_minor,
      d_prompt = p_d_prompt,
      d_forgot = p_d_forgot,
      rating_thresholds = p_rating_thresholds
  where session_type = p_session_type;

  update public.eval_weights as weights
  set weight = supplied.weight
  from (
    select key as code, (value #>> '{}')::numeric as weight
    from jsonb_each(p_weights)
  ) as supplied
  where weights.session_type = p_session_type
    and weights.criterion_code = supplied.code;
end;
$$;

revoke execute on function public.update_evaluation_settings(public.session_type_t, jsonb, numeric, numeric, numeric, numeric, jsonb)
from public, anon, authenticated, service_role;
grant execute on function public.update_evaluation_settings(public.session_type_t, jsonb, numeric, numeric, numeric, numeric, jsonb)
to authenticated;
