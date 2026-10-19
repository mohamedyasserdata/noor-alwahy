begin;
select plan(13);

insert into auth.users(id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
 ('fa000000-0000-4000-8000-000000000001','authenticated','authenticated','zoom.other@test.local','{"role":"teacher"}','{"full_name":"Other Zoom Teacher"}',now(),now());
insert into public.teachers(id,profile_id,gender,status) values
 ('fa100000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','male','pending'),
 ('fa100000-0000-4000-8000-000000000002','fa000000-0000-4000-8000-000000000001','female','pending');

select has_table('public','teacher_zoom_settings','teacher Zoom settings table exists');
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}',true);
set local role authenticated;
select lives_ok($$insert into public.teacher_zoom_settings(teacher_id,join_url) values ('fa100000-0000-4000-8000-000000000001','https://academy.zoom.us/j/123')$$,'teacher saves own approved Zoom URL');
select is((select count(*)::integer from public.teacher_zoom_settings),1,'teacher reads own Zoom setting');
select throws_ok($$update public.teacher_zoom_settings set join_url='http://zoom.us/j/123' where teacher_id='fa100000-0000-4000-8000-000000000001'$$,'23514',null,'non-HTTPS Zoom URL is rejected');
select throws_ok($$update public.teacher_zoom_settings set join_url='https://zoom.us.evil.test/j/123' where teacher_id='fa100000-0000-4000-8000-000000000001'$$,'23514',null,'lookalike Zoom host is rejected');
select lives_ok($$update public.teacher_zoom_settings set join_url='https://zoom.com/j/456' where teacher_id='fa100000-0000-4000-8000-000000000001'$$,'exact zoom.com host is accepted');

reset role;
select set_config('request.jwt.claims','{"sub":"fa000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);
set local role authenticated;
select is((select count(*)::integer from public.teacher_zoom_settings),0,'other teacher cannot read another link');
select is_empty($$update public.teacher_zoom_settings set join_url='https://zoom.us/j/999' returning teacher_id$$,'other teacher cannot update another link');

reset role;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}',true);
set local role authenticated;
select is((select count(*)::integer from public.teacher_zoom_settings),0,'student cannot read teacher links directly');
select throws_ok($$insert into public.teacher_zoom_settings(teacher_id,join_url) values ('fa100000-0000-4000-8000-000000000002','https://zoom.us/j/777')$$,'42501',null,'student cannot create teacher Zoom settings');

reset role;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
set local role authenticated;
select is((select count(*)::integer from public.teacher_zoom_settings),1,'administrator can read configured links');
select ok((select count(*) >= 2 from public.audit_logs where table_name='teacher_zoom_settings' and coalesce(before::text,'') !~ 'zoom' and coalesce(after::text,'') !~ 'zoom'),'changes are audited without storing the URL');

reset role;
set local role anon;
select throws_ok($$select * from public.teacher_zoom_settings$$,'42501',null,'anonymous cannot read Zoom settings');

select * from finish();
rollback;
