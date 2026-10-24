update public.app_settings
set value = jsonb_set(
  value,
  '{logo_url}',
  to_jsonb('/images/brand/noor-alwahy-emblem.png'::text),
  true
)
where key = 'academy_profile';
