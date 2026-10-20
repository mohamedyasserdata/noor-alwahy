begin;

select plan(47);

select has_table('public', 'eval_criteria', 'evaluation criteria table exists');
select has_table('public', 'eval_weights', 'evaluation weights table exists');
select has_table('public', 'eval_settings', 'evaluation settings table exists');

select is((select relrowsecurity from pg_class where oid = 'public.eval_criteria'::regclass), true, 'criteria have RLS');
select is((select relrowsecurity from pg_class where oid = 'public.eval_weights'::regclass), true, 'weights have RLS');
select is((select relrowsecurity from pg_class where oid = 'public.eval_settings'::regclass), true, 'settings have RLS');

select is((select count(*)::integer from public.eval_criteria), 8, 'all eight evaluation criteria are seeded');
select is((select count(*)::integer from public.eval_settings), 6, 'every session type has settings');
select is((select count(*)::integer from public.eval_weights), 33, 'only applicable criterion weights are seeded');
select results_eq(
  'select code from public.eval_criteria order by sort_order, code',
  $$values
    ('memorization'::text),
    ('tajweed_applied'::text),
    ('makharij'::text),
    ('waqf_ibtida'::text),
    ('fluency'::text),
    ('linking_mutashabihat'::text),
    ('commitment'::text),
    ('theory_understanding'::text)$$,
  'criteria use the canonical BR-08 order'
);

select is((select applies_to from public.eval_criteria where code = 'memorization'), array['new_memo','near_review','far_review','matn_theory']::public.session_type_t[], 'memorization applicability is seeded');
select is((select applies_to from public.eval_criteria where code = 'tajweed_applied'), array['new_memo','near_review','far_review','recitation','noorani']::public.session_type_t[], 'applied tajweed applicability is seeded');
select is((select applies_to from public.eval_criteria where code = 'makharij'), array['new_memo','near_review','far_review','recitation','noorani']::public.session_type_t[], 'makharij applicability is seeded');
select is((select applies_to from public.eval_criteria where code = 'waqf_ibtida'), array['new_memo','near_review','far_review','recitation']::public.session_type_t[], 'waqf applicability is seeded');
select is((select applies_to from public.eval_criteria where code = 'fluency'), array['new_memo','near_review','far_review','recitation','noorani']::public.session_type_t[], 'fluency applicability is seeded');
select is((select applies_to from public.eval_criteria where code = 'linking_mutashabihat'), array['new_memo','near_review','far_review']::public.session_type_t[], 'linking applicability is seeded');
select is((select applies_to from public.eval_criteria where code = 'commitment'), enum_range(null::public.session_type_t), 'commitment applies to every session type');
select is((select applies_to from public.eval_criteria where code = 'theory_understanding'), array['matn_theory']::public.session_type_t[], 'theory applies only to matn sessions');

select is((select count(*)::integer from public.eval_weights where session_type = 'new_memo'), 7, 'new memorization has seven weights');
select is((select count(*)::integer from public.eval_weights where session_type = 'near_review'), 7, 'near review has seven weights');
select is((select count(*)::integer from public.eval_weights where session_type = 'far_review'), 7, 'far review has seven weights');
select is((select count(*)::integer from public.eval_weights where session_type = 'recitation'), 5, 'recitation has five weights');
select is((select count(*)::integer from public.eval_weights where session_type = 'noorani'), 4, 'Noorani has four weights');
select is((select count(*)::integer from public.eval_weights where session_type = 'matn_theory'), 3, 'theory sessions have three weights');
select is((select count(*)::integer from public.eval_weights w join public.eval_criteria c on c.code = w.criterion_code where not (w.session_type = any(c.applies_to))), 0, 'no weight targets an inapplicable criterion');
select is((select count(*)::integer from public.eval_weights where weight <> 1), 0, 'temporary default weights are equal');
select is((select count(*)::integer from public.eval_settings where (d_major, d_minor, d_prompt, d_forgot) <> (2, 0.5, 0.5, 1)), 0, 'default deductions match BR-09');
select is((select count(*)::integer from public.eval_settings where rating_thresholds <> '[0,30,50,70,90]'::jsonb), 0, 'default rating thresholds match BR-09');

select is(has_table_privilege('anon', 'public.eval_criteria', 'select'), false, 'anonymous users cannot read criteria settings');
select is(has_table_privilege('anon', 'public.eval_weights', 'select'), false, 'anonymous users cannot read weights');
select is(has_table_privilege('anon', 'public.eval_settings', 'select'), false, 'anonymous users cannot read deductions');
select is(has_table_privilege('authenticated', 'public.eval_criteria', 'select'), true, 'authenticated users can read criteria');
select is(has_table_privilege('authenticated', 'public.eval_weights', 'select'), true, 'authenticated users can read weights');
select is(has_table_privilege('authenticated', 'public.eval_settings', 'select'), true, 'authenticated users can read settings');
select is(has_table_privilege('authenticated', 'public.eval_criteria', 'insert'), true, 'authenticated role reaches criteria RLS for administrators');
select is(has_table_privilege('authenticated', 'public.eval_weights', 'update'), true, 'authenticated role reaches weight RLS for administrators');
select is(has_table_privilege('authenticated', 'public.eval_settings', 'delete'), true, 'authenticated role reaches settings RLS for administrators');

select throws_ok($$update public.eval_weights set weight = -1 where session_type = 'new_memo' and criterion_code = 'memorization'$$, '23514', null, 'negative weights are rejected');
select throws_ok($$insert into public.eval_weights (session_type, criterion_code, weight) values ('noorani', 'theory_understanding', 1)$$, '23514', 'criterion_not_applicable', 'weights cannot target an inapplicable criterion');
select throws_ok($$update public.eval_settings set d_major = -1 where session_type = 'new_memo'$$, '23514', null, 'negative deductions are rejected');
select throws_ok($$update public.eval_settings set rating_thresholds = '[0,30,30,70,90]' where session_type = 'new_memo'$$, '23514', null, 'rating thresholds must be strictly increasing');

select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select is((select count(*)::integer from public.eval_settings), 6, 'a signed-in teacher can read evaluation settings');
update public.eval_weights set weight = 2 where session_type = 'new_memo' and criterion_code = 'memorization';
reset role;
select is((select weight from public.eval_weights where session_type = 'new_memo' and criterion_code = 'memorization'), 1::numeric, 'a teacher cannot change weights');

select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
update public.eval_weights set weight = 2 where session_type = 'new_memo' and criterion_code = 'memorization';
reset role;
select is((select weight from public.eval_weights where session_type = 'new_memo' and criterion_code = 'memorization'), 1::numeric, 'an AAL1 administrator cannot change weights');

select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
select lives_ok($$update public.eval_weights set weight = 2 where session_type = 'new_memo' and criterion_code = 'memorization'$$, 'an AAL2 administrator changes a weight');
reset role;
select is((select weight from public.eval_weights where session_type = 'new_memo' and criterion_code = 'memorization'), 2::numeric, 'the administrator weight change persists');
select is((select count(*)::integer from public.audit_logs where table_name = 'eval_weights' and operation = 'UPDATE' and user_id = '10000000-0000-4000-8000-000000000001'), 1, 'the administrator change is audited');

select * from finish();

rollback;
