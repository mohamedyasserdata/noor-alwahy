begin;

select plan(14);

select has_function('public', 'update_evaluation_settings', array['public.session_type_t','jsonb','numeric','numeric','numeric','numeric','jsonb'], 'atomic evaluation settings RPC exists');
select is(has_function_privilege('anon', 'public.update_evaluation_settings(public.session_type_t,jsonb,numeric,numeric,numeric,numeric,jsonb)', 'execute'), false, 'anonymous callers cannot execute the settings RPC');
select is(has_function_privilege('authenticated', 'public.update_evaluation_settings(public.session_type_t,jsonb,numeric,numeric,numeric,numeric,jsonb)', 'execute'), true, 'authenticated callers reach the RPC for authorization');

select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select throws_ok($$select public.update_evaluation_settings('new_memo', '{"memorization":1}', 2, 0.5, 0.5, 1, '[0,30,50,70,90]')$$, '42501', 'evaluation_settings_forbidden', 'a teacher cannot update evaluation settings');

reset role;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select throws_ok($$select public.update_evaluation_settings('new_memo', '{"memorization":1}', 2, 0.5, 0.5, 1, '[0,30,50,70,90]')$$, '42501', 'evaluation_settings_forbidden', 'an AAL1 administrator cannot update evaluation settings');

reset role;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
select throws_ok($$select public.update_evaluation_settings('new_memo', '{"memorization":1}', 2, 0.5, 0.5, 1, '[0,30,50,70,90]')$$, '23514', 'invalid_evaluation_weights', 'all applicable criteria are required');
select throws_ok($$select public.update_evaluation_settings('new_memo', '{"memorization":0,"tajweed_applied":0,"makharij":0,"waqf_ibtida":0,"fluency":0,"linking_mutashabihat":0,"commitment":0}', 2, 0.5, 0.5, 1, '[0,30,50,70,90]')$$, '23514', 'invalid_evaluation_weights', 'the total weight must be positive');
select lives_ok($$select public.update_evaluation_settings('new_memo', '{"memorization":2,"tajweed_applied":2,"makharij":2,"waqf_ibtida":2,"fluency":2,"linking_mutashabihat":2,"commitment":2}', 3, 1, 0.75, 1.25, '[0,25,50,75,90]')$$, 'an AAL2 administrator updates one session type atomically');

reset role;
select results_eq(
  $$select d_major, d_minor, d_prompt, d_forgot, rating_thresholds from public.eval_settings where session_type = 'new_memo'$$,
  $$values (3::numeric, 1::numeric, 0.75::numeric, 1.25::numeric, '[0,25,50,75,90]'::jsonb)$$,
  'deductions and thresholds are updated together'
);
select is((select count(*)::integer from public.eval_weights where session_type = 'new_memo' and weight = 2), 7, 'all applicable weights are updated');
select is((select count(*)::integer from public.audit_logs where table_name in ('eval_settings','eval_weights') and action = 'UPDATE' and user_id = '10000000-0000-4000-8000-000000000001'), 8, 'the atomic update audits the settings row and seven weights');

set local role authenticated;
select throws_ok($$select public.update_evaluation_settings('new_memo', '{"memorization":4,"tajweed_applied":4,"makharij":4,"waqf_ibtida":4,"fluency":4,"linking_mutashabihat":4,"commitment":4}', 9, 9, 9, 9, '[0,30,30,70,90]')$$, '23514', 'invalid_rating_thresholds', 'invalid thresholds reject the atomic update');
reset role;
select is((select d_major from public.eval_settings where session_type = 'new_memo'), 3::numeric, 'a rejected update leaves prior settings unchanged');
select is((select count(*)::integer from public.eval_weights where session_type = 'new_memo' and weight = 2), 7, 'a rejected update leaves prior weights unchanged');

select * from finish();

rollback;
