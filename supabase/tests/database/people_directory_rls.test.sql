begin;

select plan(48);

insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('91000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'inactive.p2@example.test', '{"role":"teacher"}', '{"full_name":"Inactive Teacher"}', now(), now()),
  ('91000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'stranger.parent.p2@example.test', '{"role":"parent"}', '{"full_name":"Stranger Parent"}', now(), now());

update public.profiles set is_active = false where id = '91000000-0000-4000-8000-000000000001';

insert into public.tracks (id, code, name_ar, name_en, sort_order, is_active)
values
  ('92000000-0000-4000-8000-000000000001', 'quran', 'القرآن', 'Quran', 1, true),
  ('92000000-0000-4000-8000-000000000002', 'hidden', 'مسار مخفي', 'Hidden', 2, false);
insert into public.levels (id, track_id, name_ar, name_en, sort_order, is_active)
values
  ('93000000-0000-4000-8000-000000000001', '92000000-0000-4000-8000-000000000001', 'المستوى الأول', 'Level one', 1, true),
  ('93000000-0000-4000-8000-000000000002', '92000000-0000-4000-8000-000000000002', 'مستوى مخفي', 'Hidden level', 1, true);
insert into public.students (id, profile_id, gender, level_id, full_name)
values
  ('94000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000003', 'male', '93000000-0000-4000-8000-000000000001', 'Student Account'),
  ('94000000-0000-4000-8000-000000000002', null, 'female', '93000000-0000-4000-8000-000000000001', 'Child Without Account'),
  ('94000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000005', 'male', '93000000-0000-4000-8000-000000000001', 'Other Student');
insert into public.student_private_notes (student_id, health_notes, special_notes, share_with_teacher)
values ('94000000-0000-4000-8000-000000000001', 'private health', 'private note', true);
insert into public.guardians (id, profile_id)
values
  ('95000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000004'),
  ('95000000-0000-4000-8000-000000000002', '91000000-0000-4000-8000-000000000002');
insert into public.student_guardians (student_id, guardian_id, relation, is_primary)
values
  ('94000000-0000-4000-8000-000000000001', '95000000-0000-4000-8000-000000000001', 'parent', true),
  ('94000000-0000-4000-8000-000000000002', '95000000-0000-4000-8000-000000000001', 'parent', true),
  ('94000000-0000-4000-8000-000000000003', '95000000-0000-4000-8000-000000000002', 'parent', true);
insert into public.teachers (id, profile_id, gender, status, identity_verified_at, code_of_conduct_accepted_at)
values
  ('96000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', 'male', 'active', now(), now()),
  ('96000000-0000-4000-8000-000000000002', '91000000-0000-4000-8000-000000000001', 'male', 'active', now(), now());
insert into public.teacher_tracks (teacher_id, track_id)
values ('96000000-0000-4000-8000-000000000001', '92000000-0000-4000-8000-000000000001');
insert into public.teacher_availability (id, teacher_id, weekday, start_time, end_time, status)
values
  ('97000000-0000-4000-8000-000000000001', '96000000-0000-4000-8000-000000000001', 0, '09:00', '10:00', 'proposed'),
  ('97000000-0000-4000-8000-000000000002', '96000000-0000-4000-8000-000000000001', 1, '09:00', '10:00', 'approved'),
  ('97000000-0000-4000-8000-000000000003', '96000000-0000-4000-8000-000000000002', 2, '09:00', '10:00', 'proposed');

select is((select count(*)::integer from information_schema.tables where table_schema = 'public' and table_name in ('tracks','levels','students','student_private_notes','guardians','student_guardians','teachers','teacher_tracks','teacher_availability')), 9, 'all P2-T01 tables exist');
select is((select count(*)::integer from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname in ('tracks','levels','students','student_private_notes','guardians','student_guardians','teachers','teacher_tracks','teacher_availability') and c.relrowsecurity), 9, 'RLS is enabled on every P2-T01 table');
select is((select count(*)::integer from information_schema.columns where table_schema = 'public' and table_name in ('tracks','levels','students','student_private_notes','guardians','student_guardians','teachers','teacher_tracks','teacher_availability') and column_name in ('created_at','updated_at')), 18, 'every P2-T01 table has timestamps');
select is((select count(*)::integer from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'private' and p.proname in ('current_teacher_id','current_guardian_id','guards_student') and p.prosecdef), 3, 'relationship helpers are security definer');
select is((select count(*)::integer from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'private' and p.proname in ('current_teacher_id','current_guardian_id','guards_student') and 'search_path=""' = any(p.proconfig)), 3, 'relationship helpers pin an empty search path');
select is((select count(*)::integer from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'private' and p.proname in ('current_teacher_id','current_guardian_id','guards_student') and has_function_privilege('anon', p.oid, 'execute')), 0, 'anonymous callers cannot execute relationship helpers');
select is((select count(*)::integer from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'private' and p.proname in ('current_teacher_id','current_guardian_id','guards_student') and has_function_privilege('authenticated', p.oid, 'execute')), 3, 'authenticated policies can execute relationship helpers');

set local role anon;
select is((select count(*)::integer from public.tracks where id::text like '92000000-%'), 1, 'anonymous visitors see only active tracks');
select is((select count(*)::integer from public.tracks where id = '92000000-0000-4000-8000-000000000002'), 0, 'anonymous visitors do not see inactive tracks');
select is((select count(*)::integer from public.levels where id::text like '93000000-%'), 1, 'anonymous visitors see levels only under active tracks');

reset role;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
select is((select public.auth_role())::text, 'teacher', 'the teacher role is resolved from the database');
select is((select count(*)::integer from public.teachers), 1, 'a teacher sees only their teacher row');
select is((select count(*)::integer from public.students), 0, 'a teacher sees no students before assignments exist');
select is((select count(*)::integer from public.guardians), 0, 'R-03: a teacher sees no guardian records');
select is((select count(*)::integer from public.student_guardians), 0, 'R-03: a teacher sees no guardian links');
select throws_ok($$select count(*) from public.student_private_notes$$, '42501', null, 'a teacher cannot read raw private notes even when sharing is requested');
select is((select count(*)::integer from public.teacher_tracks), 1, 'a teacher sees only their track links');
select is((select count(*)::integer from public.teacher_availability), 2, 'a teacher sees only their availability');
select lives_ok($$insert into public.teacher_availability (teacher_id, weekday, start_time, end_time) values ('96000000-0000-4000-8000-000000000001', 3, '11:00', '12:00')$$, 'a teacher can propose their own availability');
select throws_ok($$update public.teacher_availability set status = 'approved' where id = '97000000-0000-4000-8000-000000000001' returning id$$, '42501', null, 'a teacher cannot approve availability');
select results_eq($$update public.teacher_availability set start_time = '08:30' where id = '97000000-0000-4000-8000-000000000001' returning start_time::text$$, $$values ('08:30:00'::text)$$, 'a teacher can edit a proposed availability row');
select is_empty($$delete from public.teacher_availability where id = '97000000-0000-4000-8000-000000000002' returning id$$, 'a teacher cannot delete approved availability');
select is((select count(*)::integer from public.profile_private where profile_id in ('10000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000004')), 0, 'R-02: a teacher cannot read student or guardian private profiles');

reset role;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select is((select count(*)::integer from public.students), 1, 'a student sees only their own student row');
select throws_ok($$select count(*) from public.student_private_notes$$, '42501', null, 'a student cannot read private notes');
select is((select count(*)::integer from public.teachers), 0, 'a student cannot read raw teacher records');
select is_empty($$update public.students set full_name = 'Blocked' where id = '94000000-0000-4000-8000-000000000001' returning id$$, 'a student cannot update their record');

reset role;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select is((select count(*)::integer from public.guardians), 1, 'a parent sees only their guardian row');
select is((select count(*)::integer from public.student_guardians), 2, 'R-11: a parent sees links for both children');
select is((select count(*)::integer from public.students), 2, 'R-11: a parent sees both children and no stranger child');
select throws_ok($$select count(*) from public.student_private_notes$$, '42501', null, 'a parent cannot read private notes');
select is_empty($$update public.students set full_name = 'Blocked' returning id$$, 'R-12: a parent cannot update students');
select throws_ok($$insert into public.student_guardians (student_id, guardian_id) values ('94000000-0000-4000-8000-000000000003','95000000-0000-4000-8000-000000000001')$$, '42501', null, 'R-12: a parent cannot add guardian links');

reset role;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select is((select public.is_admin()), false, 'an AAL1 administrator has no admin authority');
select is((select count(*)::integer from public.students), 0, 'an AAL1 administrator receives no directory-wide read');
select throws_ok($$insert into public.students (gender, full_name) values ('male','Blocked Student')$$, '42501', null, 'an AAL1 administrator cannot create students');

reset role;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
select is((select public.is_admin()), true, 'an AAL2 administrator receives admin authority');
select is((select count(*)::integer from public.students), 3, 'an AAL2 administrator sees every student fixture');
select lives_ok($$insert into public.tracks (code, name_ar) values ('admin-created','مسار إداري')$$, 'an AAL2 administrator can create a track');
select throws_ok($$select count(*) from public.student_private_notes$$, '42501', null, 'even an administrator cannot bypass audited private-note access');
select results_eq($$select student_id from public.get_student_private_notes('94000000-0000-4000-8000-000000000001')$$, $$values ('94000000-0000-4000-8000-000000000001'::uuid)$$, 'an AAL2 administrator reads private notes through the audited RPC');
select is((select count(*)::integer from public.audit_logs where action = 'ACCESS' and table_name = 'student_private_notes' and record_id = '94000000-0000-4000-8000-000000000001'), 1, 'sensitive administrative access is audited without copying note content');

reset role;
select set_config('request.jwt.claims', '{"sub":"91000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2","app_metadata":{"role":"admin"}}', true);
set local role authenticated;
select is((select private.current_teacher_id()), null, 'an inactive teacher helper returns null');
select is((select count(*)::integer from public.teachers), 0, 'an inactive teacher cannot read their teacher row');
select is((select count(*)::integer from public.teacher_availability), 0, 'an inactive teacher cannot read availability');
select is((select public.is_admin()), false, 'forged JWT metadata cannot elevate an inactive teacher');

reset role;
select throws_ok($$insert into public.student_guardians (student_id, guardian_id, is_primary) values ('94000000-0000-4000-8000-000000000001','95000000-0000-4000-8000-000000000002',true)$$, '23505', null, 'a student has at most one primary guardian');
select throws_ok($$insert into public.teacher_availability (teacher_id, weekday, start_time, end_time) values ('96000000-0000-4000-8000-000000000001',4,'12:00','11:00')$$, '23514', null, 'availability must end after it starts');

select * from finish();
rollback;
