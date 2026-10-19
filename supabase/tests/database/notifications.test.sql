begin;

select plan(39);

select ok(to_regclass('public.notifications') is not null, 'notifications table exists');
select ok(to_regclass('public.notification_prefs') is not null, 'notification preferences table exists');
select ok(to_regclass('public.notification_outbox') is not null, 'notification outbox table exists');
select is((select relrowsecurity from pg_class where oid = 'public.notifications'::regclass), true, 'notifications has RLS');
select is((select relrowsecurity from pg_class where oid = 'public.notification_prefs'::regclass), true, 'preferences have RLS');
select is((select relrowsecurity from pg_class where oid = 'public.notification_outbox'::regclass), true, 'outbox has RLS');
select ok(exists(select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'), 'notifications is in realtime publication');
select ok(exists(select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'sessions'), 'sessions is in realtime publication');
select ok(to_regclass('public.notifications_user_unread_idx') is not null, 'notifications has user unread index');
select is(has_table_privilege('public', 'public.notifications', 'SELECT'), false, 'public cannot select notifications');
select is(has_table_privilege('anon', 'public.notifications', 'SELECT'), false, 'anonymous cannot select notifications');
select is(has_table_privilege('authenticated', 'public.notifications', 'SELECT'), true, 'authenticated can select under RLS');
select is(has_column_privilege('authenticated', 'public.notifications', 'read_at', 'UPDATE'), true, 'authenticated can mark notifications read');
select is(has_column_privilege('authenticated', 'public.notifications', 'payload', 'UPDATE'), false, 'authenticated cannot alter notification payloads');
select is(has_table_privilege('authenticated', 'public.notification_prefs', 'SELECT'), true, 'authenticated can select preferences under RLS');
select is(has_table_privilege('authenticated', 'public.notification_prefs', 'INSERT'), true, 'authenticated can insert own preferences');
select is(has_column_privilege('authenticated', 'public.notification_prefs', 'prefs', 'UPDATE'), true, 'authenticated can update own preferences');
select is(has_table_privilege('authenticated', 'public.notification_outbox', 'SELECT'), false, 'authenticated cannot read delivery outbox');
select ok(to_regprocedure('private.enqueue_notification(uuid,text,jsonb)') is not null, 'private notification helper exists');
select ok(to_regprocedure('private.notify_zoom_link_change()') is not null, 'Zoom notification trigger exists');
select ok(to_regprocedure('private.notify_session_change()') is not null, 'session notification trigger exists');

insert into public.notifications (id, user_id, type, payload)
values
  ('d8100000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000003', 'seed_notice', '{"safe":true}'),
  ('d8100000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000004', 'seed_notice', '{"safe":true}');

select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select is((select count(*)::integer from public.notifications), 1, 'user sees only own notifications');
select is((select count(*)::integer from public.notifications where user_id = '10000000-0000-4000-8000-000000000004'), 0, 'user cannot see another user notification');
select lives_ok($$update public.notifications set read_at = now() where id = 'd8100000-0000-4000-8000-000000000001'$$, 'user can mark own notification read');
select ok((select read_at is not null from public.notifications where id = 'd8100000-0000-4000-8000-000000000001'), 'own notification is marked read');
update public.notifications set read_at = now() where id = 'd8100000-0000-4000-8000-000000000002';
reset role;
select ok((select read_at is null from public.notifications where id = 'd8100000-0000-4000-8000-000000000002'), 'RLS prevents updating another notification');
set local role authenticated;
select throws_ok($$insert into public.notifications(user_id,type) values ('10000000-0000-4000-8000-000000000003','forged')$$, '42501', null, 'non-admin cannot forge notifications');
select lives_ok($$insert into public.notification_prefs(user_id,prefs) values ('10000000-0000-4000-8000-000000000003','{"in_app":true}')$$, 'user can create own preferences');
select is((select count(*)::integer from public.notification_prefs), 1, 'user sees own preferences');
select is((select count(*)::integer from public.notification_prefs where user_id = '10000000-0000-4000-8000-000000000004'), 0, 'user cannot see another preference row');
select throws_ok($$insert into public.notification_prefs(user_id,prefs) values ('10000000-0000-4000-8000-000000000004','{}')$$, '42501', null, 'user cannot create preferences for another account');
reset role;

insert into public.tracks (id, code, name_ar, name_en)
values ('d8200000-0000-4000-8000-000000000001', 'notify-test', 'تنبيهات', 'Notifications');
insert into public.teachers (id, profile_id, gender, status, identity_verified_at, code_of_conduct_accepted_at)
values ('d8300000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', 'male', 'active', now(), now());
insert into public.teacher_tracks (teacher_id, track_id)
values ('d8300000-0000-4000-8000-000000000001', 'd8200000-0000-4000-8000-000000000001');
insert into public.students (id, profile_id, full_name, gender, timezone)
values ('d8400000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000003', 'Notify Student', 'male', 'Africa/Cairo');
insert into public.guardians (id, profile_id)
values ('d8500000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000004');
insert into public.student_guardians (student_id, guardian_id, is_primary)
values ('d8400000-0000-4000-8000-000000000001', 'd8500000-0000-4000-8000-000000000001', true);
insert into public.teacher_assignments (id, student_id, teacher_id, track_id, assigned_by, reason)
values ('d8600000-0000-4000-8000-000000000001', 'd8400000-0000-4000-8000-000000000001', 'd8300000-0000-4000-8000-000000000001', 'd8200000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Notification test');
insert into public.sessions (id, assignment_id, student_id, teacher_id, scheduled_at, duration_min)
values ('d8700000-0000-4000-8000-000000000001', 'd8600000-0000-4000-8000-000000000001', 'd8400000-0000-4000-8000-000000000001', 'd8300000-0000-4000-8000-000000000001', now() + interval '1 day', 30);

insert into public.teacher_zoom_settings (teacher_id, join_url, meeting_id, passcode)
values ('d8300000-0000-4000-8000-000000000001', 'https://academy.zoom.us/j/notify-one', 'notify-id', 'never-leak');
select is((select count(*)::integer from public.notifications where type = 'zoom_link_changed'), 2, 'initial Zoom link notifies student and guardian');
select is((select count(*)::integer from public.notifications where type = 'zoom_link_changed' and user_id in ('10000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000004')), 2, 'Zoom notifications target only session family');
select ok((select bool_and(not (payload ?| array['join_url','meeting_id','passcode','zoom_override_url','zoom_meeting_id','zoom_passcode'])) from public.notifications), 'notification payloads contain no Zoom secrets');

update public.teacher_zoom_settings set join_url = 'https://academy.zoom.us/j/notify-two' where teacher_id = 'd8300000-0000-4000-8000-000000000001';
select is((select count(*)::integer from public.notifications where type = 'zoom_link_changed'), 4, 'Zoom link update creates one notification per family account');
update public.notification_prefs set prefs = '{"in_app":true,"zoom_link_changed":false,"schedule_changed":true}' where user_id = '10000000-0000-4000-8000-000000000003';
select is((select (prefs ->> 'zoom_link_changed')::boolean from public.notification_prefs where user_id = '10000000-0000-4000-8000-000000000003'), false, 'user can disable a notification event');
update public.teacher_zoom_settings set join_url = 'https://academy.zoom.us/j/notify-three' where teacher_id = 'd8300000-0000-4000-8000-000000000001';
select is((select count(*)::integer from public.notifications where type = 'zoom_link_changed'), 5, 'disabled event suppresses only that user notification');
update public.sessions set scheduled_at = scheduled_at + interval '1 hour' where id = 'd8700000-0000-4000-8000-000000000001';
select is((select count(*)::integer from public.notifications where type = 'schedule_changed'), 2, 'schedule change notifies student and guardian');
select is((select count(*)::integer from public.notifications where type = 'schedule_changed' and payload ->> 'session_id' = 'd8700000-0000-4000-8000-000000000001'), 2, 'schedule notifications identify only the affected session');

select * from finish();
rollback;
