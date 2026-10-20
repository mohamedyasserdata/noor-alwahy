begin;

select plan(39);

select has_table('public', 'quran_surahs', 'Quran surahs table exists');
select has_table('public', 'quran_ayahs', 'Quran ayahs table exists');
select has_table('public', 'quran_pages', 'Quran pages table exists');
select has_table('public', 'quran_dataset_meta', 'Quran dataset metadata table exists');

select is((select relrowsecurity from pg_class where oid = 'public.quran_surahs'::regclass), true, 'surahs have RLS');
select is((select relrowsecurity from pg_class where oid = 'public.quran_ayahs'::regclass), true, 'ayahs have RLS');
select is((select relrowsecurity from pg_class where oid = 'public.quran_pages'::regclass), true, 'pages have RLS');
select is((select relrowsecurity from pg_class where oid = 'public.quran_dataset_meta'::regclass), true, 'dataset metadata has RLS');

select is((select count(*)::integer from public.quran_surahs), 114, 'dataset contains 114 surahs');
select is((select count(*)::integer from public.quran_ayahs), 6236, 'dataset contains 6236 ayahs');
select is((select count(*)::integer from public.quran_pages), 604, 'dataset contains 604 Medina Mushaf pages');
select is((select count(*)::integer from public.quran_dataset_meta), 1, 'dataset has one immutable metadata record');
select results_eq('select min(id), max(id) from public.quran_ayahs', 'values (1, 6236)', 'ayah ids are the complete canonical sequence');
select is((select sum(ayah_count)::integer from public.quran_surahs), 6236, 'surah metadata totals 6236 ayahs');
select is(
  (
    select count(*)::integer
    from public.quran_surahs as surah
    where surah.ayah_count <> (select count(*) from public.quran_ayahs as ayah where ayah.surah_id = surah.id)
  ),
  0,
  'every surah ayah count matches the imported text'
);
select is((select count(*)::integer from generate_series(1, 604) as expected(page) left join public.quran_pages using (page) where quran_pages.page is null), 0, 'all page numbers from 1 to 604 exist');
select is((select count(*)::integer from public.quran_pages where first_ayah_id > last_ayah_id), 0, 'page ayah ranges are ordered');
select is((select count(*)::integer from public.quran_pages as page where not exists (select 1 from public.quran_ayahs as ayah where ayah.page = page.page)), 0, 'every page contains ayahs');
select results_eq('select min(juz), max(juz) from public.quran_ayahs', 'values (1::smallint, 30::smallint)', 'all 30 juz boundaries are represented');
select results_eq('select min(hizb_quarter), max(hizb_quarter) from public.quran_ayahs', 'values (1::smallint, 240::smallint)', 'all 240 hizb quarters are represented');
select is((select checksum_sha256 from public.quran_dataset_meta where id = 1), '6933e133dd56db778c801bf738848454e43648105a151e8d84d86a7cae39ec5f', 'Tanzil text checksum is pinned');
select is((select metadata_checksum_sha256 from public.quran_dataset_meta where id = 1), '8867c1d88191472adec9db694b3cd9f135b1a2ef580574d32cf888dcb22c5c7a', 'Tanzil metadata checksum is pinned');
select is((select source from public.quran_dataset_meta where id = 1), 'Tanzil Project', 'source attribution is stored');
select is((select version from public.quran_dataset_meta where id = 1), '1.1', 'text version is stored');
select is((select metadata_version from public.quran_dataset_meta where id = 1), '1.0', 'metadata version is stored');
select is((select license from public.quran_dataset_meta where id = 1), 'CC BY 3.0 — verbatim text; attribution required; changes prohibited', 'license obligations are stored');
select is(has_table_privilege('anon', 'public.quran_ayahs', 'select'), true, 'anonymous users may read Quran text');
select is(has_table_privilege('authenticated', 'public.quran_ayahs', 'select'), true, 'authenticated users may read Quran text');
select is(has_table_privilege('anon', 'public.quran_ayahs', 'insert'), false, 'anonymous users cannot alter Quran text');
select is(has_table_privilege('authenticated', 'public.quran_ayahs', 'update'), false, 'authenticated users cannot alter Quran text');
select is(has_table_privilege('service_role', 'public.quran_ayahs', 'insert'), false, 'service role cannot insert Quran text');
select is(has_table_privilege('service_role', 'public.quran_ayahs', 'delete'), false, 'service role cannot delete Quran text');
select is(has_table_privilege('postgres', 'public.quran_ayahs', 'insert'), true, 'only the migration owner retains write access');
select is((select ayah_count from public.quran_surahs where id = 1), 7::smallint, 'Al-Fatihah has 7 ayahs');
select is((select ayah_count from public.quran_surahs where id = 2), 286::smallint, 'Al-Baqarah has 286 ayahs');
select is((select ayah_count from public.quran_surahs where id = 114), 6::smallint, 'An-Nas has 6 ayahs');
select is((select count(*)::integer from public.quran_ayahs where text_uthmani = ''), 0, 'no ayah text is empty');
select is((select count(*)::integer from public.quran_pages where juz not between 1 and 30), 0, 'every page records a valid juz');
select is(has_table_privilege('service_role', 'public.quran_dataset_meta', 'update'), false, 'service role cannot rewrite dataset provenance');

select * from finish();

rollback;
