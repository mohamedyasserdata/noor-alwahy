# 03 – نموذج قاعدة البيانات

> **كيف تستخدم هذا الملف:** الـ SQL أدناه **مرجعي**. على المنفّذ تقسيمه إلى مهاجرات مرتبة، وتشغيله فعلياً على قاعدة نظيفة، وإصلاح أي خطأ صياغة قبل الدمج. المنطق والقيود هي الملزِمة، لا الحرفية.
> أسماء الجداول تتوافق مع SRC §7 مع الإضافات المعلَّمة `[+]` (غير موجودة في SRC وسببها في `07`).

## 1. الاصطلاحات
- المفاتيح `uuid default gen_random_uuid()`، والطوابع `timestamptz`، و`created_at/updated_at` على كل جدول (+ trigger `set_updated_at`).
- الحذف: لا حذف فعلي للكيانات الأساسية (`is_active`/`status`/`archived_at`)؛ `on delete restrict` افتراضياً.
- الأعمدة النصية الثنائية: `*_ar` (إلزامي) و`*_en` (اختياري).
- الدولة `char(2)` ISO-3166 كبيرة الأحرف، و`'ZZ'` = بقية العالم.

## 2. الأنواع والامتدادات
```sql
create extension if not exists btree_gist;
create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

create type user_role          as enum ('admin','teacher','student','parent');
create type gender_t           as enum ('male','female');
create type student_status     as enum ('active','dropped','graduated','suspended','archived');
create type assignment_status  as enum ('active','paused','ended');
create type session_status     as enum ('scheduled','held','missed','cancelled','rescheduled');
create type session_kind       as enum ('regular','trial','makeup','extra');
create type attendance_status  as enum ('present','late','student_absent','student_excused','teacher_absent','cancelled_teacher','cancelled_admin');
create type session_type_t     as enum ('new_memo','near_review','far_review','recitation','noorani','matn_theory');
create type subscription_status as enum ('trial','active','paused','expired','cancelled');
create type invoice_status     as enum ('draft','issued','partially_paid','paid','overdue','void');
create type payment_status     as enum ('pending_confirmation','confirmed','rejected');
create type payment_kind       as enum ('payment','refund');
create type payout_status      as enum ('accruing','due','approved','paid');
create type progress_status    as enum ('not_started','in_progress','mastered','needs_review');
create type application_status as enum ('new','contacted','trial_booked','accepted','rejected','postponed');
create type billing_period     as enum ('monthly','quarterly','yearly');
create type report_status      as enum ('draft','approved','admin_review','visible');
```

## 3. الهوية والخصوصية

```sql
create table profiles (
  id uuid primary key references auth.users(id) on delete restrict,
  role user_role not null,
  full_name text not null,
  display_name text,                     -- ما يراه الطرف الآخر (اسم أول فقط للمدرس مثلاً)
  avatar_url text,
  country_code char(2),
  timezone text not null default 'Africa/Cairo',
  preferred_locale text not null default 'ar' check (preferred_locale in ('ar','en')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- [+] بيانات الاتصال في جدول منفصل لأن RLS لا تخفي الأعمدة (الدستور 1.3)
create table profile_private (
  profile_id uuid primary key references profiles(id) on delete cascade,
  phone text, contact_email text, address text
);

create sequence student_no_seq;   -- يُنشأ قبل الجدول
-- ملاحظة ترتيب: أنشئ levels قبل students (أو أضف FK لاحقاً بـ ALTER)
create table students (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid unique references profiles(id),     -- قد يكون null لطفل بلا حساب (G-04)
  student_no text unique not null default ('NW-' || lpad(nextval('student_no_seq')::text, 6, '0')),
  gender gender_t not null,
  birth_date date,
  status student_status not null default 'active',
  level_id uuid references levels(id),
  joined_at date not null default current_date,
  country_code char(2), timezone text not null default 'Africa/Cairo',
  full_name text not null,                             -- يُستخدم إن لم يكن له profile
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
-- [+] ملاحظات حساسة: admin فقط افتراضياً
create table student_private_notes (
  student_id uuid primary key references students(id) on delete cascade,
  health_notes text, special_notes text,
  share_with_teacher boolean not null default false
);

create table guardians (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid unique not null references profiles(id)
);
create table student_guardians (
  student_id uuid references students(id) on delete cascade,
  guardian_id uuid references guardians(id) on delete cascade,
  relation text, is_primary boolean not null default false, is_payer boolean not null default false,
  primary key (student_id, guardian_id)
);

create table teachers (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid unique not null references profiles(id),
  gender gender_t not null,
  specialization text,
  ijazah_info jsonb not null default '[]',          -- [{riwaya, sanad, ...}]
  max_students int not null default 15 check (max_students > 0),
  status text not null default 'pending' check (status in ('pending','active','on_leave','inactive')),
  identity_verified_at timestamptz,
  code_of_conduct_accepted_at timestamptz
);
create table tracks (id uuid primary key default gen_random_uuid(), code text unique not null,
  name_ar text not null, name_en text, sort_order int default 0, is_active boolean default true);
create table levels (id uuid primary key default gen_random_uuid(), track_id uuid references tracks(id),
  name_ar text not null, name_en text, sort_order int default 0);
create table teacher_tracks (teacher_id uuid references teachers(id) on delete cascade,
  track_id uuid references tracks(id), primary key (teacher_id, track_id));

create table teacher_availability (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references teachers(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),       -- 0=الأحد [DECISION-AI: وثّق الاصطلاح]
  start_time time not null, end_time time not null check (end_time > start_time),
  status text not null default 'proposed' check (status in ('proposed','approved','rejected'))
);   -- الأوقات بمنطقة المدرس (profiles.timezone)

-- [+] إعدادات Zoom الافتراضية للمدرس
create table teacher_zoom_settings (
  teacher_id uuid primary key references teachers(id) on delete cascade,
  join_url text not null check (join_url ~* '^https://([a-z0-9-]+\.)*(zoom\.us|zoom\.com|zoomgov\.com)(/|$)'),
  meeting_id text, passcode text, updated_at timestamptz not null default now()
);
```

### Trigger: تطابق الجنس (إلزامي)
```sql
create function enforce_gender_match() returns trigger language plpgsql as $$
declare s gender_t; t gender_t;
begin
  select gender into s from students where id = new.student_id;
  select gender into t from teachers where id = new.teacher_id;
  if s is distinct from t then
    raise exception 'gender_mismatch' using errcode = 'P0001';
  end if;
  return new;
end $$;

create trigger trg_gender_assign before insert or update of student_id, teacher_id
  on teacher_assignments for each row execute function enforce_gender_match();
create trigger trg_gender_session before insert or update of student_id, teacher_id
  on sessions for each row execute function enforce_gender_match();   -- يغطي المدرس البديل

-- منع تغيير الجنس إن أنتج تعارضاً مع تعيين نشط
create function block_gender_change() returns trigger language plpgsql as $$
begin
  if new.gender is distinct from old.gender and exists (
     select 1 from teacher_assignments a
     where a.status in ('active','paused') and (a.student_id = old.id or a.teacher_id = old.id)) then
    raise exception 'gender_change_blocked_active_assignment' using errcode='P0001';
  end if;
  return new;
end $$;
-- أرفقه على students و teachers (للتوضيح: عند teachers يقارن a.teacher_id = old.id فقط)
```

## 4. التعيين والجدولة والحصص

```sql
create table teacher_assignments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id),
  teacher_id uuid not null references teachers(id),
  track_id uuid not null references tracks(id),
  status assignment_status not null default 'active',
  start_date date not null default current_date, end_date date,
  assigned_by uuid not null references profiles(id),
  reason text not null,
  created_at timestamptz not null default now()
);
-- تعيين واحد فعّال/موقوف لكل (طالب، مسار)  [REQ:ASN-01]
create unique index uq_active_assignment on teacher_assignments(student_id, track_id)
  where status in ('active','paused');

create table schedule_slots (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references teacher_assignments(id),
  weekday smallint not null check (weekday between 0 and 6),
  local_start_time time not null,
  duration_min int not null check (duration_min between 10 and 120),
  anchor_timezone text not null,                 -- BR-12
  is_active boolean not null default true
);

create table sessions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid references teacher_assignments(id),
  student_id uuid not null references students(id),
  teacher_id uuid not null references teachers(id),           -- المدرس الفعلي (قد يكون بديلاً)
  original_teacher_id uuid references teachers(id),
  slot_id uuid references schedule_slots(id),
  kind session_kind not null default 'regular',
  makeup_of uuid references sessions(id),
  scheduled_at timestamptz not null,
  duration_min int not null check (duration_min between 10 and 120),
  ends_at timestamptz not null,                                -- يُملأ بـ trigger لأن timestamptz+interval ليس immutable
  status session_status not null default 'scheduled',
  zoom_override_url text check (zoom_override_url is null or zoom_override_url ~* '^https://([a-z0-9-]+\.)*(zoom\.us|zoom\.com|zoomgov\.com)(/|$)'),
  zoom_meeting_id text, zoom_passcode text,
  started_at timestamptz, ended_at timestamptz,
  created_at timestamptz not null default now(),
  unique (slot_id, scheduled_at)                               -- idempotency للتوليد
);
create function set_session_ends_at() returns trigger language plpgsql as $$
begin new.ends_at := new.scheduled_at + make_interval(mins => new.duration_min); return new; end $$;
create trigger trg_session_ends before insert or update of scheduled_at, duration_min on sessions
  for each row execute function set_session_ends_at();

-- منع التعارض على مستوى قاعدة البيانات [REQ:TCH-05]
alter table sessions add constraint no_teacher_overlap exclude using gist
  (teacher_id with =, tstzrange(scheduled_at, ends_at) with &&) where (status in ('scheduled','held'));
alter table sessions add constraint no_student_overlap exclude using gist
  (student_id with =, tstzrange(scheduled_at, ends_at) with &&) where (status in ('scheduled','held'));

create table attendance (
  session_id uuid primary key references sessions(id) on delete cascade,
  status attendance_status not null,
  student_joined_at timestamptz, teacher_joined_at timestamptz, minutes int,
  student_notice_at timestamptz,                -- متى أخطر الطالب بغيابه (BR-07)
  recorded_by uuid not null references profiles(id), recorded_at timestamptz not null default now(),
  locked_at timestamptz
);
```

### الرصيد: دفتر حركات
```sql
create type credit_reason as enum ('grant','consume','refund','adjust','expire','proration');
create table session_credit_ledger (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references subscriptions(id),
  delta int not null,
  reason credit_reason not null,
  session_id uuid references sessions(id),
  note text, created_by uuid references profiles(id), created_at timestamptz not null default now(),
  check ((reason = 'consume' and delta < 0 and session_id is not null) or reason <> 'consume')
);
-- لا خصم مزدوج لنفس الحصة
create unique index uq_consume_once on session_credit_ledger(session_id) where reason = 'consume';

create view subscription_balance as
  select subscription_id, coalesce(sum(delta),0)::int as sessions_remaining
  from session_credit_ledger group by subscription_id;
```
`apply_attendance_effects(session_id)` (security definer): تقرأ `attendance` و`subscriptions.policy_snapshot` وتطبق مصفوفة BR-07: تكتب حركة `consume` إن لزم، وتُنشئ صف `teacher_payout_items` إن استحق الأجر، وتضبط `sessions.status` (`held`/`missed`/`cancelled`)، وتكتب `notifications` اللازمة. تُستدعى من RPC `record_attendance()` ولا تُستدعى من العميل مباشرة. idempotent.

## 5. الباقات والتسعير والاشتراكات والتقديم

```sql
create table countries (
  code char(2) primary key, name_ar text not null, name_en text,
  currency char(3) not null, default_timezone text, is_enabled boolean not null default true
);   -- 'ZZ' = بقية العالم؛ العملة الافتراضية له [OWNER?] (مثلاً USD)

create table packages (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  track_id uuid references tracks(id),
  name_ar text not null, name_en text, description_ar text, description_en text,
  audience text check (audience in ('child','adult','women')),
  teacher_gender gender_t,                       -- null = بحسب جنس الطالب تلقائياً
  sessions_per_week smallint not null check (sessions_per_week between 1 and 14),
  duration_min int not null default 30 check (duration_min between 10 and 120),
  billing_period billing_period not null default 'monthly',
  features jsonb not null default '[]',          -- [{ar,en,icon}]
  policy jsonb not null default '{}',            -- BR-06
  is_published boolean not null default false, is_active boolean not null default true,
  sort_order int not null default 0,
  created_by uuid references profiles(id), created_at timestamptz default now(), updated_at timestamptz default now()
);

-- [+] append-only: السجل التاريخي هو الصفوف نفسها (PRC-09)
create table package_prices (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references packages(id),
  country_code char(2) not null references countries(code),
  currency char(3) not null,
  amount numeric(12,2) not null check (amount >= 0),
  min_amount numeric(12,2), max_amount numeric(12,2),
  is_active boolean not null default true,        -- false = إيقاف الدولة لهذه الباقة
  valid_from timestamptz not null default now(),
  created_by uuid references profiles(id), created_at timestamptz default now(),
  unique (package_id, country_code, valid_from),
  check (min_amount is null or amount >= min_amount),
  check (max_amount is null or amount <= max_amount)
);
-- منع تعديل/حذف: لا UPDATE/DELETE عبر trigger (التصحيح بصف جديد)

create function resolve_price(p_package uuid, p_country char(2), p_at timestamptz default now())
returns table(amount numeric, currency char(3), country_code char(2)) language sql stable as $$
  select amount, currency, country_code from (
    select distinct on (country_code) *, case when country_code = p_country then 0 else 1 end as pri
    from package_prices
    where package_id = p_package and country_code in (p_country,'ZZ') and valid_from <= p_at
    order by country_code, valid_from desc
  ) t where is_active order by pri limit 1;
$$;
-- ملاحظة للمنفّذ: اختبر الحالات: دولة بسعر مفعّل، دولة موقوفة (تسقط إلى ZZ؟ قرار: تسقط إلى ZZ)، سعر مستقبلي.

create table coupons (
  id uuid primary key default gen_random_uuid(), code text unique not null,
  kind text not null check (kind in ('percent','fixed','sibling','annual','seasonal')),
  value numeric(12,2) not null, currency char(3),
  starts_at timestamptz, ends_at timestamptz, max_redemptions int, redeemed_count int not null default 0,
  package_id uuid references packages(id), is_active boolean not null default true
);

create table applications (
  id uuid primary key default gen_random_uuid(),
  order_no text unique not null,                  -- عشوائي غير قابل للتخمين
  status application_status not null default 'new',
  student_name text not null, student_gender gender_t not null, student_birth_date date,
  guardian_name text, contact_email text, contact_phone text,        -- بيانات شخصية: admin فقط
  country_code char(2), timezone text not null,
  track_id uuid references tracks(id), package_id uuid references packages(id),
  self_level text, preferred_times jsonb, preferred_teacher_gender gender_t,
  consent_version text not null, consent_at timestamptz not null,    -- موافقة ولي الأمر
  source text, internal_notes text, converted_student_id uuid references students(id),
  created_at timestamptz default now(), updated_at timestamptz default now(),
  check (preferred_teacher_gender is null or preferred_teacher_gender = student_gender)
);

create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id),
  package_id uuid not null references packages(id),
  status subscription_status not null default 'trial',
  start_date date, current_period_start date, current_period_end date, renew_date date,
  auto_renew boolean not null default false,       -- مؤجل لحين بوابة دفع
  paused_until date,
  price_amount numeric(12,2) not null, price_currency char(3) not null, price_country char(2) not null,
  policy_snapshot jsonb not null, package_snapshot jsonb not null,
  coupon_id uuid references coupons(id),
  sessions_per_period int not null,
  created_at timestamptz default now(), updated_at timestamptz default now()
);
-- حصة تجريبية واحدة للطالب
create unique index uq_one_trial on sessions(student_id) where kind = 'trial' and status <> 'cancelled';
```

## 6. الفوترة والدفع والأجور

```sql
create sequence invoice_no_seq; create sequence receipt_no_seq;

create table invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_no text unique not null default ('INV-' || to_char(now(),'YYYY') || '-' || lpad(nextval('invoice_no_seq')::text,6,'0')),
  subscription_id uuid references subscriptions(id),
  student_id uuid not null references students(id),
  payer_profile_id uuid references profiles(id),
  currency char(3) not null,
  subtotal numeric(12,2) not null, discount_total numeric(12,2) not null default 0,
  total numeric(12,2) not null check (total >= 0),
  status invoice_status not null default 'draft',
  due_date date, issued_at timestamptz, locale text not null default 'ar',
  created_at timestamptz default now(), updated_at timestamptz default now()
);
create table invoice_items (
  id uuid primary key default gen_random_uuid(), invoice_id uuid not null references invoices(id) on delete cascade,
  kind text not null check (kind in ('subscription','registration','exam','certificate','extra_session','other','discount','proration')),
  description_ar text not null, description_en text,
  quantity numeric(10,2) not null default 1, unit_amount numeric(12,2) not null, amount numeric(12,2) not null
);

create table payment_methods (
  id uuid primary key default gen_random_uuid(), country_code char(2) not null references countries(code),
  type text not null check (type in ('bank','wallet','instapay','cash','other')),
  label_ar text not null, label_en text, details jsonb not null default '{}',
  instructions_ar text, instructions_en text, is_active boolean not null default true, sort_order int default 0
);

create table payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references invoices(id),
  kind payment_kind not null default 'payment',
  amount numeric(12,2) not null check (amount > 0),
  currency char(3) not null,                      -- trigger: = invoices.currency
  status payment_status not null default 'pending_confirmation',
  provider text not null default 'manual',
  payment_method_id uuid references payment_methods(id),
  paid_at timestamptz, proof_note text, proof_file_path text,
  recorded_by uuid not null references profiles(id),
  confirmed_by uuid references profiles(id), confirmed_at timestamptz,
  receipt_no text unique,
  created_at timestamptz default now()
);
-- Trigger payment_immutable: بعد status='confirmed' يُمنع UPDATE/DELETE (errcode 'payment_immutable').
-- Trigger payment_confirm: عند الانتقال إلى confirmed → يُملأ confirmed_by/at/receipt_no، ويُعاد حساب حالة الفاتورة،
--   وإن غطّت الفاتورة وكان لها subscription في trial/expired → تفعيل + حركة grant في الدفتر + إشعار.
create view invoice_balance as
  select i.id as invoice_id, i.total,
    coalesce(sum(case when p.status='confirmed' and p.kind='payment' then p.amount end),0)
  - coalesce(sum(case when p.status='confirmed' and p.kind='refund'  then p.amount end),0) as paid,
    i.total - (coalesce(sum(case when p.status='confirmed' and p.kind='payment' then p.amount end),0)
  - coalesce(sum(case when p.status='confirmed' and p.kind='refund' then p.amount end),0)) as due
  from invoices i left join payments p on p.invoice_id = i.id group by i.id;

create table expenses (
  id uuid primary key default gen_random_uuid(), category text not null,
  amount numeric(12,2) not null, currency char(3) not null, spent_at date not null,
  note text, attachment_path text, source text default 'manual',           -- 'teacher_payout' عند الصرف
  payout_id uuid, created_by uuid references profiles(id)
);

create table teacher_rates (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references teachers(id),
  track_id uuid references tracks(id), duration_min int,
  rate_per_session numeric(12,2) not null check (rate_per_session >= 0), currency char(3) not null,
  valid_from date not null, created_by uuid references profiles(id),
  unique (teacher_id, track_id, duration_min, valid_from)
);
create table teacher_payouts (
  id uuid primary key default gen_random_uuid(), teacher_id uuid not null references teachers(id),
  period_start date not null, period_end date not null, currency char(3) not null,
  gross numeric(12,2) not null default 0, bonuses numeric(12,2) not null default 0,
  deductions numeric(12,2) not null default 0, net numeric(12,2) not null default 0,
  status payout_status not null default 'accruing',
  approved_by uuid references profiles(id), paid_at timestamptz,
  unique (teacher_id, period_start, period_end, currency)
);
create table teacher_payout_items (
  id uuid primary key default gen_random_uuid(), payout_id uuid not null references teacher_payouts(id),
  session_id uuid not null unique references sessions(id),          -- مرة واحدة لكل حصة
  amount numeric(12,2) not null, rate_snapshot numeric(12,2) not null,
  kind text not null check (kind in ('session','makeup','substitute','no_show'))
);
create table teacher_adjustments (
  id uuid primary key default gen_random_uuid(), payout_id uuid not null references teacher_payouts(id),
  kind text not null check (kind in ('bonus','deduction')), amount numeric(12,2) not null check (amount > 0),
  reason text not null, created_by uuid references profiles(id)
);
```

## 7. المصحف والتقييم والتقدم

```sql
create table quran_surahs (
  id smallint primary key check (id between 1 and 114),
  name_ar text not null, name_en text, ayah_count smallint not null,
  revelation text check (revelation in ('meccan','medinan'))
);
create table quran_ayahs (
  id int primary key,                               -- 1..6236 تسلسلي
  surah_id smallint not null references quran_surahs(id), ayah_no smallint not null,
  page smallint not null check (page between 1 and 604),   -- مصحف المدينة
  juz smallint not null check (juz between 1 and 30), hizb_quarter smallint,
  text_uthmani text not null,
  unique (surah_id, ayah_no)
);
create table quran_pages (page smallint primary key, juz smallint not null,
  first_ayah_id int not null references quran_ayahs(id), last_ayah_id int not null references quran_ayahs(id),
  lines_count smallint);                            -- اختياري، يحتاج مصدراً إضافياً (G-09)
create table quran_dataset_meta (id int primary key default 1, source text not null, version text, license text,
  checksum_sha256 text not null, imported_at timestamptz not null default now());
-- بعد الاستيراد: REVOKE INSERT/UPDATE/DELETE على الجداول الأربعة عن كل الأدوار (ما عدا postgres)

create table eval_criteria (code text primary key, name_ar text not null, name_en text,
  applies_to session_type_t[] not null, sort_order int not null default 0);
create table eval_weights (session_type session_type_t not null, criterion_code text references eval_criteria(code),
  weight numeric(5,2) not null check (weight >= 0), primary key (session_type, criterion_code));
create table eval_settings (session_type session_type_t primary key,
  d_major numeric(5,2) not null default 2, d_minor numeric(5,2) not null default 0.5,
  d_prompt numeric(5,2) not null default 0.5, d_forgot numeric(5,2) not null default 1,
  rating_thresholds jsonb not null default '[0,30,50,70,90]');

create table session_evaluations (
  id uuid primary key default gen_random_uuid(),
  session_id uuid unique not null references sessions(id),
  session_type session_type_t not null,
  from_ayah_id int references quran_ayahs(id), to_ayah_id int references quran_ayahs(id),
  pages numeric(5,2), lines_count int,
  scores jsonb not null,                            -- {"memorization":4,...}  القيم 1..5 والمفاتيح ⊆ المعايير المنطبقة
  errors_major int not null default 0 check (errors_major >= 0),
  errors_minor int not null default 0 check (errors_minor >= 0),
  prompts_count int not null default 0 check (prompts_count >= 0),
  forgot_count int not null default 0 check (forgot_count >= 0),
  weak_tags text[] not null default '{}',
  decision text check (decision in ('passed','repeat','next')),
  homework jsonb, family_note text,
  settings_snapshot jsonb,
  total_score numeric(5,2), rating smallint check (rating between 1 and 5),     -- يحسبها trigger فقط
  is_locked boolean not null default false, locked_at timestamptz,
  created_by uuid not null references profiles(id), updated_at timestamptz default now(),
  check (from_ayah_id is null or to_ayah_id is null or from_ayah_id <= to_ayah_id)
);
-- Trigger BEFORE INSERT/UPDATE: يتحقق scores (مفاتيح/مدى) ويحسب total_score/rating وفق BR-09 ويحفظ settings_snapshot.
--   يتجاهل أي قيمة total_score/rating قادمة من العميل. إن was is_locked → يرفض إلا is_admin() (errcode 'evaluation_locked').
-- Trigger AFTER UPDATE OF is_locked → true: ينفّذ apply_evaluation_to_progress() (BR-10) وينشئ إشعاراً.

create table memorization_progress (
  student_id uuid references students(id) on delete cascade,
  page smallint references quran_pages(page),
  status progress_status not null default 'not_started',
  first_memorized_at timestamptz, last_reviewed_at timestamptz,
  avg_score numeric(5,2), review_count int not null default 0,
  review_stage smallint not null default 0, next_review_due date,
  primary key (student_id, page)
);
create index on memorization_progress (student_id, next_review_due);
-- Views: v_surah_progress, v_juz_progress, v_review_queue(student_id) (BR-11)
-- الكتابة على الجدول من apply_evaluation_to_progress فقط (security definer)؛ لا سياسة INSERT/UPDATE لأي دور.

create table study_plans (id uuid primary key default gen_random_uuid(), student_id uuid references students(id),
  period text check (period in ('weekly','monthly')), start_date date, target_pages numeric(5,2), created_by uuid references profiles(id));
create table student_badges (student_id uuid references students(id), badge_code text, earned_at timestamptz default now(), primary key (student_id, badge_code));
create table placement_tests (id uuid primary key default gen_random_uuid(), application_id uuid references applications(id),
  student_id uuid references students(id), result jsonb, suggested_track_id uuid, suggested_package_id uuid, tested_by uuid references profiles(id), tested_at timestamptz default now());
```

## 8. التقارير والاختبارات والشهادات والإشعارات والإعدادات

```sql
create table reports (
  id uuid primary key default gen_random_uuid(), student_id uuid not null references students(id),
  teacher_id uuid not null references teachers(id),
  period_type text not null check (period_type in ('weekly','monthly')), period_start date not null, period_end date not null,
  body jsonb not null,                              -- {metrics:{...auto}, summary, strengths, improve, plan, recommendation}
  status report_status not null default 'draft', approved_at timestamptz, made_visible_at timestamptz,
  content_template_version_id uuid, pdf_path text,
  unique (student_id, teacher_id, period_type, period_start)
);
create table exams (id uuid primary key default gen_random_uuid(), title_ar text not null, title_en text,
  kind text check (kind in ('monthly','term','final','juz')), track_id uuid references tracks(id),
  max_score numeric(6,2) not null, weight numeric(5,2) default 1, held_on date, created_by uuid references profiles(id));
create table exam_results (id uuid primary key default gen_random_uuid(), exam_id uuid references exams(id), student_id uuid references students(id),
  scores jsonb not null, errors jsonb, total numeric(6,2), grade text, entered_by uuid references profiles(id),
  is_locked boolean default false, unique (exam_id, student_id));
create table certificate_templates (
  id uuid primary key default gen_random_uuid(), kind text not null, name_ar text not null, name_en text,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  created_by uuid not null references profiles(id), created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table certificate_template_versions (
  id uuid primary key default gen_random_uuid(), template_id uuid not null references certificate_templates(id),
  version_no int not null check (version_no > 0), locale text not null check (locale in ('ar','en')),
  layout jsonb not null, -- schema ثابت: ألوان/إطار/زخرفة/مناطق النص والصور؛ لا HTML/CSS تنفيذي
  content jsonb not null, -- نصوص + متغيرات من allowlist فقط
  assets_snapshot jsonb not null, -- logo/seal/signatures: paths + hashes وقت النشر
  published_by uuid references profiles(id), published_at timestamptz,
  created_at timestamptz not null default now(), unique (template_id, version_no, locale)
); -- النسخة المنشورة immutable بTrigger؛ التعديل ينشئ version_no جديداً
create table certificate_batches (
  id uuid primary key default gen_random_uuid(), template_version_id uuid not null references certificate_template_versions(id),
  requested_by uuid not null references profiles(id), idempotency_key text not null unique,
  status text not null check (status in ('queued','processing','partial','completed','failed')),
  total_count int not null check (total_count > 0), success_count int not null default 0,
  failure_count int not null default 0, created_at timestamptz not null default now(), finished_at timestamptz
);
create table certificates (
  id uuid primary key default gen_random_uuid(), template_id uuid not null references certificate_templates(id),
  template_version_id uuid not null references certificate_template_versions(id),
  batch_id uuid references certificate_batches(id),
  student_id uuid not null references students(id), kind text not null,
  serial_no text unique not null, verify_code text unique not null,      -- عشوائي ≥ 16 محرفاً
  issued_by uuid references profiles(id), issued_at timestamptz default now(),
  pdf_path text not null, pdf_sha256 text not null, locale text default 'ar',
  payload_snapshot jsonb not null, template_snapshot jsonb not null,
  revoked_at timestamptz, revoked_by uuid references profiles(id), revoke_reason text,
  check ((revoked_at is null and revoked_by is null and revoke_reason is null)
      or (revoked_at is not null and revoked_by is not null and length(trim(revoke_reason)) >= 5))
);

create table notifications (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references profiles(id),
  type text not null, payload jsonb not null default '{}', created_at timestamptz default now(), read_at timestamptz
);
create table notification_prefs (user_id uuid primary key references profiles(id), prefs jsonb not null default '{}');
create table notification_outbox (id uuid primary key default gen_random_uuid(), notification_id uuid references notifications(id),
  channel text not null, status text not null default 'pending', attempts int default 0, next_attempt_at timestamptz default now(), last_error text);
create table announcements (id uuid primary key default gen_random_uuid(), title_ar text not null, title_en text, body_ar text, body_en text,
  audience jsonb not null default '{"all":true}', starts_at timestamptz default now(), ends_at timestamptz, created_by uuid references profiles(id));
create table contact_links (id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('whatsapp','phone','email','facebook','instagram','telegram','youtube','tiktok','other')),
  label_ar text not null, label_en text, url text not null, sort_order int default 0, is_visible boolean default true);
create table app_settings (key text primary key, value jsonb not null, updated_by uuid references profiles(id), updated_at timestamptz default now());
create table intervention_rules (
  id uuid primary key default gen_random_uuid(), rule_type text not null unique,
  is_enabled boolean not null default true, priority smallint not null check (priority between 1 and 5),
  thresholds jsonb not null, window_interval interval not null, cooldown_interval interval not null,
  updated_by uuid not null references profiles(id), updated_at timestamptz not null default now()
); -- rule_type من registry ثابت؛ trigger/validator يرفض مفاتيح وحدوداً غير معروفة
create table intervention_cases (
  id uuid primary key default gen_random_uuid(), rule_id uuid not null references intervention_rules(id),
  subject_type text not null, subject_id uuid not null, dedupe_key text not null,
  status text not null default 'open' check (status in ('open','acknowledged','resolved','dismissed')),
  priority smallint not null check (priority between 1 and 5), reason_code text not null,
  evidence jsonb not null, first_detected_at timestamptz not null, last_detected_at timestamptz not null,
  acknowledged_by uuid references profiles(id), acknowledged_at timestamptz,
  resolved_by uuid references profiles(id), resolved_at timestamptz,
  disposition_reason text, created_at timestamptz not null default now()
);
create unique index intervention_cases_one_active on intervention_cases (dedupe_key)
  where status in ('open','acknowledged');
create table content_templates (
  id uuid primary key default gen_random_uuid(), kind text not null check (kind in ('student_report','admin_message','announcement')),
  name_ar text not null, name_en text, status text not null default 'draft' check (status in ('draft','published','archived')),
  created_by uuid not null references profiles(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table content_template_versions (
  id uuid primary key default gen_random_uuid(), template_id uuid not null references content_templates(id),
  version_no int not null check (version_no > 0), locale text not null check (locale in ('ar','en')),
  subject_template text, body_template text not null, variables_schema jsonb not null,
  published_by uuid references profiles(id), published_at timestamptz, created_at timestamptz not null default now(),
  unique (template_id, version_no, locale)
); -- النسخة المنشورة immutable ولا تقبل إلا allowlist الخاصة بنوع القالب
create table export_jobs (
  id uuid primary key default gen_random_uuid(), requested_by uuid not null references profiles(id),
  report_type text not null, format text not null check (format in ('pdf','xlsx')),
  filters_snapshot jsonb not null, locale text not null, timezone text not null,
  status text not null default 'queued' check (status in ('queued','processing','completed','failed','expired')),
  storage_path text, file_sha256 text, row_count int, error_code text,
  created_at timestamptz not null default now(), started_at timestamptz, finished_at timestamptz, expires_at timestamptz
);
create table job_runs (id bigserial primary key, job text not null, started_at timestamptz default now(), finished_at timestamptz, ok boolean, details jsonb);
create table audit_logs (id bigserial primary key, user_id uuid, action text not null, table_name text, record_id text,
  before jsonb, after jsonb, ip inet, created_at timestamptz not null default now());
create index on audit_logs (table_name, record_id, created_at desc);
```
`audit_row()` trigger عام (security definer) يُرفق على: `package_prices`, `payments`, `invoices`, `teacher_assignments`, `session_evaluations`, `exam_results`, `teacher_rates`, `teacher_payouts`, `profiles` (تغيّر الدور/التفعيل)، `app_settings`، `eval_*`, `certificate_templates`, `certificate_template_versions`, `certificates`, `intervention_rules`, `intervention_cases`, `content_templates`, `content_template_versions`, `export_jobs`. لا أحد يملك UPDATE/DELETE على `audit_logs` (admin قراءة فقط). لا تحفظ سجلات التدقيق رابط signed أو محتوى ملف؛ تحفظ المسار/المعرّف والحدث فقط.

## 9. الدوال المساعدة لـ RLS

```sql
create function auth_role() returns user_role language sql stable security definer set search_path = public as
$$ select role from profiles where id = auth.uid() and is_active $$;
create function is_admin() returns boolean language sql stable security definer set search_path = public as
$$ select coalesce(auth_role() = 'admin', false) $$;
create function my_teacher_id() returns uuid language sql stable security definer set search_path = public as
$$ select id from teachers where profile_id = auth.uid() $$;
create function teaches_student(p_student uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from teacher_assignments a where a.student_id = p_student and a.teacher_id = my_teacher_id() and a.status in ('active','paused'))
  or exists (  -- مدرس بديل: حصص قريبة فقط
    select 1 from sessions s where s.student_id = p_student and s.teacher_id = my_teacher_id()
      and s.scheduled_at between now() - interval '1 day' and now() + interval '14 days')
$$;
create function guards_student(p_student uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from student_guardians sg join guardians g on g.id = sg.guardian_id
                 where sg.student_id = p_student and g.profile_id = auth.uid()) $$;
create function is_my_student_row(p_student uuid) returns boolean language sql stable security definer set search_path = public as
$$ select exists (select 1 from students s where s.id = p_student and s.profile_id = auth.uid()) $$;
```

## 10. مصفوفة RLS (الحد الأدنى الملزِم)

الرموز: **C**=insert · **R**=select · **U**=update · **D**=delete · `—` ممنوع · `own` سجلاته · `asg` طلابه المعيّنون · `kids` أبناؤه.

| الجدول | anon | admin | teacher | student | parent |
| --- | --- | --- | --- | --- | --- |
| profiles | — | CRUD | R own + R (display_name, avatar فقط) للمعيّنين عبر View | R own + مدرسه (View) | R own + مدرسو الأبناء (View) |
| profile_private | — | CRUD | R/U own فقط | R/U own | R/U own |
| students | — | CRUD | R asg | R own | R kids |
| student_private_notes | — | CRUD | R asg **إن** `share_with_teacher` | — | — |
| guardians, student_guardians | — | CRUD | — | — | R own |
| teachers | — | CRUD | R own | R مدرسه (View محدود) | R مدرسو الأبناء (View محدود) |
| teacher_availability | — | CRUD | CRUD own (اقتراح) | — | — |
| teacher_zoom_settings | — | R/U | CRU own | — (RPC فقط) | — (RPC فقط) |
| teacher_assignments, schedule_slots | — | CRUD | R own | R own | R kids |
| sessions | — | CRUD | R/U(حقول Zoom فقط) للحصص التي هو مدرسها | R own (بدون أعمدة Zoom) | R kids (بدون أعمدة Zoom) |
| attendance | — | CRUD | C/U حصصه ضمن نافذة التعديل | R own | R kids |
| session_credit_ledger | — | R + C(adjust) | — | — | R kids (عبر View) |
| session_evaluations | — | CRUD (unlock) | C/U asg وغير مقفل | R own | R kids |
| memorization_progress | — | R | R asg | R own | R kids |
| reports | — | CRUD | CRU own؛ `status` ≠ visible | R own حين `visible` | R kids حين `visible` |
| packages, package_prices (المنشور/السارية), countries, contact_links, quran_* , eval_criteria | R | CRUD (الأسعار: C فقط) | R | R | R |
| applications | — (RPC/Route فقط) | CRUD | — | — | — |
| subscriptions, invoices, invoice_items, payments | — | CRUD | — | R own | R kids/payer |
| payment_methods | R (المفعّلة) | CRUD | — | R | R |
| teacher_rates, teacher_payouts, teacher_payout_items, teacher_adjustments | — | CRUD | R **own فقط** (View `my_earnings`) | — | — |
| expenses | — | CRUD | — | — | — |
| exams, exam_results | — | CRUD | C/U نتائج asg | R own | R kids |
| certificate_templates, certificate_template_versions | — | CRUD (النسخة المنشورة لا تعدّل/تحذف) | — | — | — |
| certificate_batches | — | CRU (لا حذف) | — | — | — |
| certificates | R عبر RPC `verify_certificate(code)` فقط | CR + revoke RPC (لا UPDATE عام/DELETE) | R asg | R own | R kids |
| intervention_rules, intervention_cases | — | CRUD عبر RPCs انتقال محددة | — | — | — |
| content_templates, content_template_versions | — | CRUD (النسخة المنشورة لا تعدّل/تحذف) | R لقوالب تقرير مسموحة فقط | — | — |
| export_jobs | — | CRU own/admin workers؛ لا مسار Storage مباشر | — | — | — |
| notifications | — | R own + C | R/U(read_at) own | R/U(read_at) own | R/U(read_at) own |
| audit_logs | — | R | — | — | — |
| app_settings | R مفاتيح عامة محددة | CRUD | — | — | — |

### أمثلة سياسات (للنسخ والتعديل)
```sql
alter table sessions enable row level security;
create policy sessions_admin on sessions for all to authenticated
  using ((select is_admin())) with check ((select is_admin()));
create policy sessions_teacher_read on sessions for select to authenticated
  using (teacher_id = (select my_teacher_id()));
create policy sessions_student_read on sessions for select to authenticated
  using ((select is_my_student_row(student_id)));
create policy sessions_parent_read on sessions for select to authenticated
  using ((select guards_student(student_id)));
-- الأعمدة zoom_*: REVOKE SELECT (zoom_override_url, zoom_meeting_id, zoom_passcode) ON sessions FROM authenticated;
--   ثم GRANT SELECT على نفس الأعمدة للمدرس عبر View `teacher_sessions` أو يُقرأ عبر RPC.

create function get_session_join(p_session uuid) returns table(url text, meeting_id text, passcode text)
language plpgsql stable security definer set search_path = public as $$
declare s sessions%rowtype;
begin
  select * into s from sessions where id = p_session;
  if not found then return; end if;
  if not ( is_admin() or s.teacher_id = my_teacher_id() or is_my_student_row(s.student_id) or guards_student(s.student_id) ) then return; end if;
  -- الطلاب والأهل: ضمن النافذة فقط
  if not (is_admin() or s.teacher_id = my_teacher_id())
     and not (now() between s.scheduled_at - interval '10 minutes' and s.ends_at + interval '15 minutes') then return; end if;
  return query select coalesce(s.zoom_override_url, z.join_url), coalesce(s.zoom_meeting_id, z.meeting_id), coalesce(s.zoom_passcode, z.passcode)
    from teacher_zoom_settings z where z.teacher_id = s.teacher_id;
end $$;
```
> سياسات المدرس على `profiles` للطلاب تتم عبر Views (`v_my_students` تعرض `student_id, display_name, birth_date…` بلا هاتف/بريد).

## 11. بيانات البذر (seed.sql)
- الدول (22 + ZZ) بعملاتها ومناطقها الزمنية الافتراضية.
- المسارات الستة والمستويات الأساسية.
- معايير التقييم والأوزان المتساوية والإعدادات الافتراضية (BR-08/09).
- حسابات تجريبية: admin، مدرس + مدرسة، طالب + طالبة، ولي أمر بابنين (ذكر وأنثى)، **لاختبار RLS** (كلمات مرور تجريبية محلية فقط).
- باقتان بأسعار لمصر والسعودية و`ZZ`، وطرق تحويل لمصر.
- روابط تواصل نموذجية.
