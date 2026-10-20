begin;

select plan(19);

select has_function(
  'public',
  'update_evaluation_settings',
  array['session_type_t','numeric','numeric','numeric','numeric','jsonb','jsonb'],
  'atomic evaluation settings update RPC exists'
);
select function_lang_is(
  'public',
  'update_evaluation_settings',
  array['session_type_t','numeric','numeric','numeric','numeric','jsonb','jsonb'],
  'plpgsql',
  'update RPC uses plpgsql'
);
select is_definer(
  'public',
  'update_evaluation_settings',
  array['session_type_t','numeric','numeric','numeric','numeric','jsonb','jsonb'],
  'update RPC is security definer'
);
select is(
  (select proconfig @> array['search_path=""'] from pg_proc where oid = 'public.update_evaluation_settings(public.session_type_t,numeric,numeric,numeric,numeric,jsonb,jsonb)'::regprocedure),
  true,
  'update RPC fixes an empty search_path'
);
select function_privs_are(
  'public',
  'update_evaluation_settings',
  array['session_type_t','numeric','numeric','numeric','numeric','jsonb','jsonb'],
  'anon',
  array[]::text[],
  'anonymous users cannot execute the update RPC'
);
select function_privs_are(
  'public',
  'update_evaluation_settings',
  array['session_type_t','numeric','numeric','numeric','numeric','jsonb','jsonb'],
  'authenticated',
  array['EXECUTE'],
  'authenticated users reach the admin check'
);

select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select throws_ok(
  $$select public.update_evaluation_settings('recitation', 3, 1, 1, 2, '[0,25,50,75,90]', '{"commitment":1,"fluency":1,"makharij":1,"tajweed_applied":1,"waqf_ibtida":1}')$$,
  '42501',
  'evaluation_settings_forbidden',
  'teacher cannot update evaluation settings'
);
reset role;

select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select throws_ok(
  $$select public.update_evaluation_settings('recitation', 3, 1, 1, 2, '[0,25,50,75,90]', '{"commitment":1,"fluency":1,"makharij":1,"tajweed_applied":1,"waqf_ibtida":1}')$$,
  '42501',
  'evaluation_settings_forbidden',
  'AAL1 administrator cannot update evaluation settings'
);
reset role;

select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
select throws_ok(
  $$select public.update_evaluation_settings('recitation', 3, 1, 1, 2, '[0,25,50,75,90]', '{"commitment":1}')$$,
  '22023',
  'evaluation_weights_mismatch',
  'RPC rejects missing applicable criteria'
);
select throws_ok(
  $$select public.update_evaluation_settings('recitation', 3, 1, 1, 2, '[0,25,50,75,90]', '{"commitment":1,"fluency":1,"makharij":1,"memorization":1,"tajweed_applied":1,"waqf_ibtida":1}')$$,
  '22023',
  'evaluation_weights_mismatch',
  'RPC rejects an inapplicable criterion'
);
select throws_ok(
  $$select public.update_evaluation_settings('recitation', 3, 1, 1, 2, '[0,25,25,75,90]', '{"commitment":1,"fluency":1,"makharij":1,"tajweed_applied":1,"waqf_ibtida":1}')$$,
  '22023',
  'evaluation_thresholds_invalid',
  'RPC rejects unordered thresholds'
);
select throws_ok(
  $$select public.update_evaluation_settings('recitation', 3, 1, 1, 2, '[0,25,50,75,90]', '{"commitment":0,"fluency":0,"makharij":0,"tajweed_applied":0,"waqf_ibtida":0}')$$,
  '22023',
  'evaluation_weight_total_must_be_positive',
  'RPC rejects an all-zero weight set'
);
select lives_ok(
  $$select public.update_evaluation_settings('recitation', 3, 1, 0.75, 2, '[0,25,50,75,90]', '{"commitment":1,"fluency":2,"makharij":3,"tajweed_applied":4,"waqf_ibtida":5}')$$,
  'AAL2 administrator atomically updates settings and weights'
);
reset role;

select results_eq(
  $$select d_major, d_minor, d_prompt, d_forgot from public.eval_settings where session_type = 'recitation'$$,
  $$values (3::numeric, 1::numeric, 0.75::numeric, 2::numeric)$$,
  'deductions persist together'
);
select is(
  (select rating_thresholds from public.eval_settings where session_type = 'recitation'),
  '[0,25,50,75,90]'::jsonb,
  'rating thresholds persist'
);
select results_eq(
  $$select criterion_code, weight from public.eval_weights where session_type = 'recitation' order by criterion_code$$,
  $$values ('commitment'::text,1::numeric),('fluency',2),('makharij',3),('tajweed_applied',4),('waqf_ibtida',5)$$,
  'all applicable weights persist exactly'
);
select is(
  (select count(*)::integer from public.audit_logs where table_name = 'eval_settings' and action = 'UPDATE' and user_id = '10000000-0000-4000-8000-000000000001'),
  1,
  'settings update is audited once'
);
select is(
  (select count(*)::integer from public.audit_logs where table_name = 'eval_weights' and action = 'UPDATE' and user_id = '10000000-0000-4000-8000-000000000001'),
  5,
  'every applicable weight update is audited'
);

select throws_ok(
  $$update public.eval_weights set weight = 0 where session_type = 'new_memo'$$,
  '23514',
  'evaluation_weight_total_must_be_positive',
  'deferred constraint rejects a zero total even for direct administrator writes'
);

select * from finish();

rollback;
