begin;

select no_plan();

select has_table('public', 'teacher_student_notes', 'teacher internal notes table exists');
select is(
  (select relrowsecurity from pg_class where oid = 'public.teacher_student_notes'::regclass),
  true,
  'teacher internal notes enforce RLS'
);

insert into auth.users (
  id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('fb000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'notes.admin@test.local', '{"role":"admin"}', '{"full_name":"Notes Admin"}', now(), now()),
  ('fb000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'notes.teacher@test.local', '{"role":"teacher"}', '{"full_name":"Assigned Teacher"}', now(), now()),
  ('fb000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'notes.other.teacher@test.local', '{"role":"teacher"}', '{"full_name":"Other Teacher"}', now(), now()),
  ('fb000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'notes.student@test.local', '{"role":"student"}', '{"full_name":"Notes Student"}', now(), now()),
  ('fb000000-0000-4000-8000-000000000005', 'authenticated', 'authenticated', 'notes.parent@test.local', '{"role":"parent"}', '{"full_name":"Notes Parent"}', now(), now());

insert into public.tracks (id, code, name_ar, name_en)
values ('fb100000-0000-4000-8000-000000000001', 'teacher-private-notes', 'ملاحظات المعلم', 'Teacher notes');

insert into public.teachers (
  id, profile_id, gender, status, identity_verified_at, code_of_conduct_accepted_at
)
values
  ('fb200000-0000-4000-8000-000000000001', 'fb000000-0000-4000-8000-000000000002', 'male', 'active', now(), now()),
  ('fb200000-0000-4000-8000-000000000002', 'fb000000-0000-4000-8000-000000000003', 'male', 'active', now(), now());

insert into public.teacher_tracks (teacher_id, track_id)
values
  ('fb200000-0000-4000-8000-000000000001', 'fb100000-0000-4000-8000-000000000001'),
  ('fb200000-0000-4000-8000-000000000002', 'fb100000-0000-4000-8000-000000000001');

insert into public.students (id, profile_id, full_name, gender, timezone)
values ('fb300000-0000-4000-8000-000000000001', 'fb000000-0000-4000-8000-000000000004', 'Notes Student', 'male', 'Africa/Cairo');

insert into public.guardians (id, profile_id)
values ('fb400000-0000-4000-8000-000000000001', 'fb000000-0000-4000-8000-000000000005');

insert into public.student_guardians (student_id, guardian_id, is_primary)
values ('fb300000-0000-4000-8000-000000000001', 'fb400000-0000-4000-8000-000000000001', true);

insert into public.teacher_assignments (
  id, student_id, teacher_id, track_id, assigned_by, reason
)
values (
  'fb500000-0000-4000-8000-000000000001',
  'fb300000-0000-4000-8000-000000000001',
  'fb200000-0000-4000-8000-000000000001',
  'fb100000-0000-4000-8000-000000000001',
  'fb000000-0000-4000-8000-000000000001',
  'Internal notes RLS test'
);

select set_config('request.jwt.claims', '{"sub":"fb000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select lives_ok(
  $$insert into public.teacher_student_notes (student_id, teacher_id, body, created_by)
    values (
      'fb300000-0000-4000-8000-000000000001',
      'fb200000-0000-4000-8000-000000000001',
      'Internal follow-up visible only to the assigned teacher and administration.',
      'fb000000-0000-4000-8000-000000000002'
    )$$,
  'assigned teacher can add an internal note'
);
select is((select count(*)::integer from public.teacher_student_notes), 1, 'assigned teacher can read their internal note');
reset role;

select set_config('request.jwt.claims', '{"sub":"fb000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select is((select count(*)::integer from public.teacher_student_notes), 0, 'unrelated teacher cannot read the note');
select throws_ok(
  $$insert into public.teacher_student_notes (student_id, teacher_id, body, created_by)
    values (
      'fb300000-0000-4000-8000-000000000001',
      'fb200000-0000-4000-8000-000000000002',
      'This teacher is not assigned.',
      'fb000000-0000-4000-8000-000000000003'
    )$$,
  '42501',
  null,
  'unrelated teacher cannot add a note'
);
reset role;

select set_config('request.jwt.claims', '{"sub":"fb000000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select is((select count(*)::integer from public.teacher_student_notes), 0, 'student cannot read internal teacher notes');
reset role;

select set_config('request.jwt.claims', '{"sub":"fb000000-0000-4000-8000-000000000005","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select is((select count(*)::integer from public.teacher_student_notes), 0, 'parent cannot read internal teacher notes');
reset role;

select set_config('request.jwt.claims', '{"sub":"fb000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
select is((select count(*)::integer from public.teacher_student_notes), 1, 'administrator can review internal teacher notes');
reset role;

select ok(
  (select count(*) from public.audit_logs where table_name = 'teacher_student_notes' and action = 'INSERT') >= 1,
  'internal note creation is audited'
);

select * from finish();
rollback;
