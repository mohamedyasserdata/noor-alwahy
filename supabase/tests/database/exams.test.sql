begin;

select plan(20);

select has_table('public', 'exams', 'exams table exists');
select has_table('public', 'exam_results', 'exam results table exists');
select has_function('public', 'save_exam_result', array['uuid','uuid','jsonb','jsonb'], 'guarded result function exists');
select has_function('public', 'lock_exam_result', array['uuid'], 'guarded lock function exists');
select is((select relrowsecurity from pg_class where oid = 'public.exams'::regclass), true, 'exam RLS is enabled');
select is((select relrowsecurity from pg_class where oid = 'public.exam_results'::regclass), true, 'result RLS is enabled');
select is(has_table_privilege('anon', 'public.exams', 'select'), false, 'anonymous callers cannot read exams');
select is(has_table_privilege('authenticated', 'public.exam_results', 'insert'), false, 'clients cannot bypass result RPC');

insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('8a000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'exam.student@test.local', '{"role":"student"}', '{"full_name":"Exam Student"}', now(), now()),
  ('8a000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'exam.other@test.local', '{"role":"student"}', '{"full_name":"Other Exam Student"}', now(), now());

insert into public.tracks(id, code, name_ar, name_en)
values ('8b000000-0000-4000-8000-000000000001', 'exam-test', 'مسار الاختبار', 'Exam test');
insert into public.students(id, profile_id, full_name, gender, timezone)
values
  ('8c000000-0000-4000-8000-000000000001', '8a000000-0000-4000-8000-000000000001', 'Exam Student', 'male', 'Africa/Cairo'),
  ('8c000000-0000-4000-8000-000000000002', '8a000000-0000-4000-8000-000000000002', 'Other Exam Student', 'male', 'Africa/Cairo');
insert into public.teacher_assignments(id, student_id, teacher_id, track_id, assigned_by, reason)
select '8d000000-0000-4000-8000-000000000001', '8c000000-0000-4000-8000-000000000001', id,
  '8b000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Exam test'
from public.teachers where profile_id = '10000000-0000-4000-8000-000000000002';

insert into public.exams(id,title_ar,title_en,kind,session_type,track_id,max_score,weight,held_on,status,created_by)
values ('8e000000-0000-4000-8000-000000000001','اختبار تجريبي','Test exam','monthly','recitation','8b000000-0000-4000-8000-000000000001',50,1,current_date,'open','10000000-0000-4000-8000-000000000001');

select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select lives_ok($$select public.save_exam_result('8e000000-0000-4000-8000-000000000001','8c000000-0000-4000-8000-000000000001','{"tajweed_applied":5,"makharij":5,"waqf_ibtida":5,"fluency":5,"commitment":5}','{"major":0,"minor":0,"prompts":0,"forgot":0}')$$, 'assigned teacher saves a result');
select is((select percentage from public.exam_results), 100::numeric, 'database computes the percentage');
select is((select total from public.exam_results), 50::numeric, 'database scales the total to maximum score');
select is((select grade from public.exam_results), 'excellent', 'database derives the grade');
select ok((select settings_snapshot ? 'weights' and settings_snapshot ? 'deductions' from public.exam_results), 'calculation inputs are snapshotted');
select throws_ok($$select public.save_exam_result('8e000000-0000-4000-8000-000000000001','8c000000-0000-4000-8000-000000000002','{"commitment":5}','{}')$$, '42501', 'exam_student_forbidden', 'teacher cannot grade an unassigned student');
reset role;

select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
select lives_ok($$select public.lock_exam_result((select id from public.exam_results limit 1))$$, 'MFA administrator locks a result');
reset role;
select ok((select is_locked and locked_at is not null from public.exam_results), 'lock metadata is complete');
select throws_ok($$update public.exam_results set scores='{"commitment":1}' where exam_id='8e000000-0000-4000-8000-000000000001'$$, 'P0001', 'exam_result_locked', 'approved result is immutable');

select set_config('request.jwt.claims', '{"sub":"8a000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select is((select count(*)::integer from public.exam_results), 1, 'student reads their own approved result');
select is_empty($$delete from public.exam_results returning id$$, 'student cannot delete results');
reset role;

select ok((select count(*) >= 3 from public.audit_logs where table_name in ('exams','exam_results')), 'exam changes are audited');
select * from finish();
rollback;
