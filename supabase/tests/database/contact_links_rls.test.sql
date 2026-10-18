begin;

select plan(10);

insert into public.contact_links (id, type, label_ar, label_en, url, sort_order, is_visible)
values
  ('c1000000-0000-4000-8000-000000000001', 'whatsapp', 'واتساب', 'WhatsApp', 'https://wa.me/201000000000', 1, true),
  ('c1000000-0000-4000-8000-000000000002', 'email', 'بريد خاص', 'Private email', 'mailto:private@example.test', 2, false);

set local role anon;
select is((select count(*)::integer from public.contact_links), 1, 'anonymous visitors read visible links only');
select throws_ok(
  $$insert into public.contact_links (type, label_ar, url) values ('phone', 'هاتف', 'tel:+201000000000')$$,
  '42501',
  'permission denied for table contact_links',
  'anonymous visitors cannot create links'
);

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',
  true
);
set local role authenticated;

select is((select count(*)::integer from public.contact_links), 1, 'an AAL1 admin sees visible links only');
update public.contact_links set is_visible = false where id = 'c1000000-0000-4000-8000-000000000001';

reset role;
select is(
  (select is_visible from public.contact_links where id = 'c1000000-0000-4000-8000-000000000001'),
  true,
  'an AAL1 admin cannot update a link'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',
  true
);
set local role authenticated;

select is((select count(*)::integer from public.contact_links), 2, 'an AAL2 admin reads visible and hidden links');
select lives_ok(
  $$insert into public.contact_links (id, type, label_ar, url, sort_order) values ('c1000000-0000-4000-8000-000000000003', 'phone', 'الهاتف', 'tel:+201000000000', 3)$$,
  'an AAL2 admin creates a link'
);
select lives_ok(
  $$update public.contact_links set is_visible = false where id = 'c1000000-0000-4000-8000-000000000003'$$,
  'an AAL2 admin hides a link'
);
select lives_ok(
  $$delete from public.contact_links where id = 'c1000000-0000-4000-8000-000000000003'$$,
  'an AAL2 admin deletes a link'
);

select is(
  (
    select count(*)::integer
    from public.audit_logs
    where table_name = 'contact_links'
      and record_id = 'c1000000-0000-4000-8000-000000000003'
  ),
  3,
  'create, update, and delete each write an audit event'
);
select is(
  (
    select count(*)::integer
    from public.audit_logs
    where table_name = 'contact_links'
      and user_id = '10000000-0000-4000-8000-000000000001'
  ),
  3,
  'contact link audit events identify the AAL2 administrator'
);

select * from finish();

rollback;
