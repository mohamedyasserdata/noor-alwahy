begin;

select plan(54);

select has_table('public', 'announcements', 'announcements table exists');
select has_table('public', 'announcement_deliveries', 'announcement deliveries table exists');
select is((select relrowsecurity from pg_class where oid = 'public.announcements'::regclass), true, 'announcement RLS is enabled');
select is((select relrowsecurity from pg_class where oid = 'public.announcement_deliveries'::regclass), true, 'delivery RLS is enabled');
select has_function('public', 'get_admin_dashboard', array['date','date','text','text'], 'dashboard metric RPC exists');
select has_function('public', 'get_admin_student_risk_flags', array['text','integer'], 'risk flag RPC exists');
select has_function('public', 'get_admin_operations_metrics', array['date','date','text','uuid','uuid','text','text'], 'operations metric RPC exists');
select has_function('public', 'get_admin_learning_metrics', array['date','date','text','uuid','uuid','text','text'], 'learning metric RPC exists');
select has_function('public', 'get_admin_finance_metrics', array['date','date','text','uuid','uuid','text','text'], 'finance metric RPC exists');
select has_table('public', 'export_jobs', 'private export queue exists');
select is((select relrowsecurity from pg_class where oid = 'public.export_jobs'::regclass), true, 'export queue RLS is enabled');
select ok((select not public from storage.buckets where id = 'admin-exports'), 'admin export storage bucket is private');
select has_table('public', 'content_templates', 'content template registry exists');
select has_table('public', 'content_template_versions', 'content template versions exist');
select is((select relrowsecurity from pg_class where oid = 'public.content_templates'::regclass), true, 'content template RLS is enabled');
select is((select relrowsecurity from pg_class where oid = 'public.content_template_versions'::regclass), true, 'content version RLS is enabled');
select is(has_function_privilege('anon', 'public.save_admin_announcement(text,text,text,text,jsonb,timestamp with time zone,timestamp with time zone,uuid)', 'execute'), false, 'anonymous callers cannot manage announcements');
select is(has_table_privilege('anon', 'public.export_jobs', 'select'), false, 'anonymous callers cannot enumerate export jobs');

insert into public.students(id, profile_id, student_no, full_name, gender, country_code, timezone, status)
values ('9c100000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000003', 'NW-AC0001', 'Admin Center Student', 'male', 'EG', 'Africa/Cairo', 'active');

select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select throws_ok(
  $$select public.get_admin_dashboard(current_date - 30, current_date, null, null)$$,
  '42501', 'admin_mfa_required', 'teacher cannot read dashboard metrics'
);
select throws_ok(
  $$select public.get_admin_student_risk_flags(null, 100)$$,
  '42501', 'admin_mfa_required', 'teacher cannot read risk flags'
);
select throws_ok(
  $$select public.queue_admin_export('students', 'pdf', jsonb_build_object('from', current_date - 30, 'to', current_date), array['student_no','full_name'], 'en', 'Africa/Cairo')$$,
  '42501', 'admin_mfa_required', 'teacher cannot queue an admin export'
);
select is((select count(*)::integer from public.content_templates), 0, 'teacher cannot read unpublished or non-report templates');
reset role;

select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
select is(jsonb_typeof(public.get_admin_dashboard(current_date - 30, current_date, null, null)), 'object', 'AAL2 admin receives dashboard metrics');
select is((public.get_admin_dashboard(current_date - 30, current_date, null, null)->'totals'->>'students')::integer, 1, 'dashboard student total matches source data');
select is((public.get_admin_dashboard(current_date - 30, current_date, 'EG', null)->'totals'->>'students')::integer, 1, 'dashboard country filter matches source data');
select is(jsonb_typeof(public.get_admin_student_risk_flags('EG', 100)), 'array', 'risk flags use a bounded JSON array');
select is(jsonb_typeof(public.get_admin_operations_metrics(current_date - 30, current_date, 'EG', null, null, 'active', 'Africa/Cairo')), 'object', 'operations metrics return a structured snapshot');
select is(jsonb_typeof(public.get_admin_learning_metrics(current_date - 30, current_date, 'EG', null, null, 'active', 'Africa/Cairo')), 'object', 'learning metrics return a structured snapshot');
select is(jsonb_typeof(public.get_admin_finance_metrics(current_date - 30, current_date, 'EG', null, null, 'active', 'Africa/Cairo')), 'object', 'finance metrics return a structured snapshot');
select is(jsonb_typeof(public.get_admin_advanced_report('students', current_date - 30, current_date, 'EG', null, null, 'active', 'student_no', 'asc', 1, 50, 'en', 'Africa/Cairo')), 'object', 'advanced report returns a structured result');
select is((public.get_admin_advanced_report('students', current_date - 30, current_date, 'EG', null, null, 'active', 'student_no', 'asc', 1, 50, 'en', 'Africa/Cairo')->>'total')::integer, 1, 'advanced report count matches filtered source data');
select throws_ok(
  $$select public.get_admin_advanced_report('students', current_date - 30, current_date, null, null, null, null, 'unsafe_sort', 'asc', 1, 50, 'en', 'Africa/Cairo')$$,
  '22023', 'advanced_report_sort_invalid', 'advanced reports reject non-allowlisted sorting'
);
select ok(public.queue_admin_export(
  'students', 'pdf', jsonb_build_object('from', current_date - 30, 'to', current_date, 'country', 'EG'),
  array['student_no','full_name','country','status'], 'en', 'Africa/Cairo'
) is not null, 'admin queues a private export snapshot');
select is((select count(*)::integer from public.export_jobs), 1, 'admin sees only the queued export owned by them');
select ok((select filters_snapshot->>'country' = 'EG' and selected_columns = array['student_no','full_name','country','status'] from public.export_jobs), 'export filters and columns are snapshotted');

select ok(set_config('test.announcement_id', public.save_admin_announcement(
  'تنبيه للطلاب', 'Student notice', 'محتوى التنبيه', 'Notice body',
  '{"roles":["student"]}', now() - interval '1 minute', now() + interval '1 day', null
)::text, true) <> '', 'admin saves a targeted announcement draft');
select is(public.publish_admin_announcement(current_setting('test.announcement_id')::uuid), 2, 'publishing targets the two active student accounts exactly once');
select is((select count(*)::integer from public.announcement_deliveries where announcement_id = current_setting('test.announcement_id')::uuid), 2, 'announcement delivery ledger matches recipients');
reset role;
select is((select count(*)::integer from public.notifications where type = 'announcement' and payload->>'announcement_id' = current_setting('test.announcement_id')), 2, 'publishing creates one in-app notification per recipient');
set local role authenticated;
select throws_ok(
  $$select public.publish_admin_announcement(current_setting('test.announcement_id')::uuid)$$,
  '55000', 'announcement_not_publishable', 'a published announcement cannot be published twice'
);
reset role;
select throws_ok(
  $$update public.announcements set body_en = 'Changed after publication' where id = current_setting('test.announcement_id')::uuid$$,
  '55000', 'published_announcement_immutable', 'published announcement content is immutable'
);
set local role authenticated;

select ok(set_config('test.content_template_id', public.save_content_template(
  'announcement', 'قالب إعلان', 'Announcement template',
  'مرحبًا {{recipient_name}}', 'أهلًا {{recipient_name}} في {{academy_name}}',
  'Hello {{recipient_name}}', 'Welcome {{recipient_name}} to {{academy_name}}', null
)::text, true) <> '', 'admin saves both locales of a deterministic template');
select is(public.publish_content_template(current_setting('test.content_template_id')::uuid), 2, 'publishing locks both localized template versions');
select is(
  public.render_content_template(
    (select id from public.content_template_versions where template_id = current_setting('test.content_template_id')::uuid and locale = 'en' and published_at is not null),
    '{"recipient_name":"Mona"}', 'en'
  )->>'body',
  'Welcome Mona to أكاديمية نور الوحي',
  'renderer substitutes provided values and deterministic fallback'
);
select is(
  jsonb_array_length(public.render_content_template(
    (select id from public.content_template_versions where template_id = current_setting('test.content_template_id')::uuid and locale = 'en' and published_at is not null),
    '{"recipient_name":"Mona"}', 'en'
  )->'missing'),
  0,
  'fallback values are not reported as missing'
);
select throws_ok(
  $$select public.render_content_template(
    (select id from public.content_template_versions where template_id = current_setting('test.content_template_id')::uuid and locale = 'en' and published_at is not null),
    '{"recipient_name":"Mona","unknown":"unsafe"}', 'en'
  )$$,
  '22023', 'content_template_values_unknown', 'renderer rejects unknown payload keys'
);
select throws_ok(
  $$update public.content_template_versions set body_template = 'Changed' where template_id = current_setting('test.content_template_id')::uuid and published_at is not null$$,
  '55000', 'published_content_template_immutable', 'published content template versions are immutable'
);
select lives_ok(
  $$select public.save_content_template(
    'announcement', 'قالب إعلان محدث', 'Updated announcement template',
    'مرحبًا {{recipient_name}}', 'تحديث {{recipient_name}} من {{academy_name}}',
    'Hello {{recipient_name}}', 'Update for {{recipient_name}} from {{academy_name}}',
    current_setting('test.content_template_id')::uuid
  )$$,
  'editing after publication creates a new draft version'
);
select is((select count(*)::integer from public.content_template_versions where template_id = current_setting('test.content_template_id')::uuid), 4, 'published and draft localized versions coexist');
reset role;

select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select is((select count(*)::integer from public.announcements), 0, 'non-recipient teacher cannot read the student announcement');
reset role;

select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select is((select count(*)::integer from public.announcements), 1, 'student recipient reads the active published announcement');
select is((select count(*)::integer from public.announcement_deliveries), 1, 'student reads only their own delivery row');
select is((select count(*)::integer from public.export_jobs), 0, 'student cannot read private admin export jobs');
select is((select count(*)::integer from public.content_templates), 0, 'student cannot read deterministic template management data');
reset role;

select * from finish();
rollback;
