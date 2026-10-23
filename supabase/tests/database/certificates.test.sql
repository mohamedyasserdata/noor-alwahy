begin;

select plan(43);

select has_table('public', 'certificate_templates', 'certificate templates table exists');
select has_table('public', 'certificate_template_versions', 'certificate template versions table exists');
select has_table('public', 'certificates', 'issued certificates table exists');
select has_table('public', 'certificate_batches', 'certificate batches table exists');
select has_table('public', 'certificate_batch_items', 'certificate batch items table exists');
select is((select relrowsecurity from pg_class where oid = 'public.certificate_templates'::regclass), true, 'template RLS is enabled');
select is((select relrowsecurity from pg_class where oid = 'public.certificate_template_versions'::regclass), true, 'version RLS is enabled');
select is((select relrowsecurity from pg_class where oid = 'public.certificates'::regclass), true, 'certificate RLS is enabled');
select is((select relrowsecurity from pg_class where oid = 'public.certificate_batches'::regclass), true, 'batch RLS is enabled');
select is((select relrowsecurity from pg_class where oid = 'public.certificate_batch_items'::regclass), true, 'batch item RLS is enabled');
select is(has_table_privilege('anon', 'public.certificate_templates', 'select'), false, 'anonymous callers cannot read templates');
select is(has_table_privilege('authenticated', 'public.certificates', 'insert'), false, 'clients cannot insert issued certificates directly');
select is(has_function_privilege('anon', 'public.verify_certificate(text)', 'execute'), true, 'anonymous callers can use limited verification');
select is(has_table_privilege('anon', 'public.certificates', 'select'), false, 'anonymous callers cannot enumerate certificates');

insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('8a100000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'certificate.student@test.local', '{"role":"student"}', '{"full_name":"Certificate Student Long Name"}', now(), now()),
  ('8a100000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'certificate.archived@test.local', '{"role":"student"}', '{"full_name":"Archived Certificate Student"}', now(), now());

insert into public.students(id, profile_id, student_no, full_name, gender, timezone, status)
values
  ('8c100000-0000-4000-8000-000000000001', '8a100000-0000-4000-8000-000000000001', 'NW-CT0001', 'Certificate Student Long Name', 'male', 'Africa/Cairo', 'active'),
  ('8c100000-0000-4000-8000-000000000002', '8a100000-0000-4000-8000-000000000002', 'NW-CT0002', 'Archived Certificate Student', 'male', 'Africa/Cairo', 'archived');

insert into public.certificate_templates(id, kind, name_ar, name_en, created_by)
values ('8d100000-0000-4000-8000-000000000001', 'memorization', 'شهادة حفظ', 'Memorization certificate', '10000000-0000-4000-8000-000000000001');

select throws_ok(
  $$insert into public.certificate_template_versions(
      id, template_id, version, title_ar, title_en, body_ar, body_en, created_by
    ) values (
      '8e100000-0000-4000-8000-000000000099', '8d100000-0000-4000-8000-000000000001', 99,
      'شهادة حفظ', 'Memorization certificate', 'نمنح {{unsafe_value}} هذه الشهادة تقديرًا لإنجازه',
      'This certificate is awarded to {{unsafe_value}} for achievement', '10000000-0000-4000-8000-000000000001'
    )$$,
  '23514',
  'certificate_variable_not_allowed',
  'unknown template variables are rejected'
);

insert into public.certificate_template_versions(
  id, template_id, version, title_ar, title_en, body_ar, body_en, signatures, theme, created_by
) values (
  '8e100000-0000-4000-8000-000000000001', '8d100000-0000-4000-8000-000000000001', 1,
  'شهادة حفظ', 'Memorization certificate',
  'تمنح إلى {{student_name}} تقديرًا لـ {{achievement}} بتاريخ {{issued_on}} ورقم {{serial_no}}',
  'Awarded to {{student_name}} for {{achievement}} on {{issued_on}} serial {{serial_no}}',
  '[{"name":"مدير الأكاديمية","title":"المدير"}]',
  '{"style":"arabesque","primary":"#102b50","accent":"#d3aa45"}',
  '10000000-0000-4000-8000-000000000001'
);

select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select is((select count(*)::integer from public.certificate_templates), 0, 'teacher cannot read certificate templates');
select throws_ok(
  $$select public.publish_certificate_template('8e100000-0000-4000-8000-000000000001')$$,
  '42501', 'admin_mfa_required', 'teacher cannot publish a certificate template'
);
reset role;

select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
select lives_ok($$select public.publish_certificate_template('8e100000-0000-4000-8000-000000000001')$$, 'AAL2 admin publishes a template');
select is((select status from public.certificate_template_versions where id = '8e100000-0000-4000-8000-000000000001'), 'published', 'published version records its state');
select ok(public.issue_certificate('8e100000-0000-4000-8000-000000000001', '8c100000-0000-4000-8000-000000000001', 'ar', 'حفظ جزء عم بإتقان', 'certificate-one') is not null, 'admin issues an individual certificate');
select is(
  public.issue_certificate('8e100000-0000-4000-8000-000000000001', '8c100000-0000-4000-8000-000000000001', 'ar', 'حفظ جزء عم بإتقان', 'certificate-one'),
  (select id from public.certificates where idempotency_key = 'certificate-one'),
  'individual issuance is idempotent'
);
select is((select count(*)::integer from public.certificates where idempotency_key = 'certificate-one'), 1, 'idempotent issuance creates one row');
select ok((select char_length(verify_code) >= 32 from public.certificates where idempotency_key = 'certificate-one'), 'verification code has high entropy');
select is((select payload_snapshot->>'student_name' from public.certificates where idempotency_key = 'certificate-one'), 'Certificate Student Long Name', 'student data is snapshotted');
select throws_ok(
  $$update public.certificate_template_versions set title_en = 'Changed after publish' where id = '8e100000-0000-4000-8000-000000000001'$$,
  'P0001', 'published_certificate_template_immutable', 'published template versions are immutable'
);
reset role;
select throws_ok(
  $$update public.certificates set payload_snapshot = '{"student_name":"Changed"}' where idempotency_key = 'certificate-one'$$,
  'P0001', 'issued_certificate_immutable', 'issued certificate snapshots are immutable'
);
set local role authenticated;
select ok(public.clone_certificate_template_version('8e100000-0000-4000-8000-000000000001') is not null, 'admin clones a published version into a draft');
select is((select template_version_id from public.certificates where idempotency_key = 'certificate-one'), '8e100000-0000-4000-8000-000000000001'::uuid, 'cloning does not relink an old certificate');
select ok(public.enqueue_certificate_batch(
  '8e100000-0000-4000-8000-000000000001',
  array['8c100000-0000-4000-8000-000000000001'::uuid, '8c100000-0000-4000-8000-000000000002'::uuid],
  'en', 'Attendance excellence', 'certificate-batch-one'
) is not null, 'admin enqueues a mixed certificate batch');
select is(
  public.enqueue_certificate_batch(
    '8e100000-0000-4000-8000-000000000001',
    array['8c100000-0000-4000-8000-000000000001'::uuid, '8c100000-0000-4000-8000-000000000002'::uuid],
    'en', 'Attendance excellence', 'certificate-batch-one'
  ),
  (select id from public.certificate_batches where idempotency_key = 'certificate-batch-one'),
  'batch enqueue is idempotent'
);
select lives_ok(
  $$select public.process_certificate_batch((select id from public.certificate_batches where idempotency_key = 'certificate-batch-one'), 10)$$,
  'batch processing isolates a failed archived subject'
);
select ok((select status = 'partial' and completed_count = 1 and failed_count = 1 from public.certificate_batches where idempotency_key = 'certificate-batch-one'), 'batch preserves one success and one failure');
select lives_ok(
  $$select public.process_certificate_batch((select id from public.certificate_batches where idempotency_key = 'certificate-batch-one'), 10)$$,
  'retrying a partial batch is safe'
);
select is((select count(*)::integer from public.certificates), 2, 'retry does not duplicate the successful batch certificate');
select throws_ok(
  $$select public.revoke_certificate((select id from public.certificates where idempotency_key = 'certificate-one'), 'bad')$$,
  '22023', 'certificate_revoke_reason_invalid', 'revocation requires a meaningful reason'
);
select lives_ok(
  $$select public.revoke_certificate((select id from public.certificates where idempotency_key = 'certificate-one'), 'Owner requested correction')$$,
  'admin revokes without deleting the certificate'
);
reset role;

select set_config('test.certificate_code', (select verify_code from public.certificates where idempotency_key = 'certificate-one'), true);
select set_config('request.headers', '{"x-real-ip":"198.51.100.42","user-agent":"pgtap-certificate"}', true);
set local role anon;
select ok((select not valid and status = 'revoked' and student_name = 'Certificate N.' from public.verify_certificate(current_setting('test.certificate_code'))), 'public verification returns limited revoked metadata');
select ok((select not valid and status = 'not_found' and student_name is null and serial_no is null from public.verify_certificate(repeat('x', 48))), 'unknown verification code returns a uniform limited result');
reset role;

select set_config('request.jwt.claims', '{"sub":"8a100000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select is((select count(*)::integer from public.certificates), 2, 'student reads only their own certificates');
select is((select count(*)::integer from public.certificate_templates), 0, 'student cannot read certificate templates');
select throws_ok($$delete from public.certificates$$, '42501', null, 'student cannot delete issued certificates');
reset role;

select ok((select revoked_at is not null and revoke_reason = 'Owner requested correction' from public.certificates where idempotency_key = 'certificate-one'), 'revocation preserves the issued row and reason');
select ok((select count(*) >= 5 from public.audit_logs where table_name in ('certificate_templates','certificate_template_versions','certificates','certificate_batches')), 'certificate lifecycle is audited');

select * from finish();
rollback;
