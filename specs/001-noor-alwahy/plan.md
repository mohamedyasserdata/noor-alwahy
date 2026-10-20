# 02 – الخطة التقنية (Plan)

> **كيف** نبني. القرارات هنا ملزمة للمنفّذ ما لم يُعدَّل ADR صراحةً.

## 1. المكدّس

| الطبقة | الاختيار | ملاحظة تنفيذية |
| --- | --- | --- |
| الواجهة | Next.js (App Router) + React + TypeScript strict | **ثبّت الإصدارات الدقيقة في اليوم 0** في `package.json` وسجّلها في `docs/adr/ADR-001-versions.md` بعد قراءة دليل الترقية للنسخة المختارة (أسماء ملفات مثل `middleware.ts`، وكون `cookies()`/`headers()`/`params` متزامنة أم غير متزامنة، تتغير بين الإصدارات). |
| التنسيق | Tailwind CSS + shadcn/ui | تحقق من طريقة إعداد Tailwind للنسخة المثبّتة (ملف إعداد أم CSS-first)؛ مكوّنات shadcn تُراجع يدوياً لتكون RTL-safe. |
| i18n | next-intl | التوجيه `/[locale]`، الرسائل `messages/{ar,en}.json`، ومساحات أسماء لكل بوابة. |
| النماذج | React Hook Form + Zod | المخططات في `lib/validators` تُستخدم في الخادم والعميل. |
| البيانات | TanStack Query (للتفاعلية) + Server Components (للقراءة الأولية) + TanStack Table | ترقيم صفحات وفرز وفلترة **من الخادم**. |
| الرسوم | Recharts | ألوان الهوية؛ بدائل نصية/جدول لإمكانية الوصول. |
| قاعدة البيانات | Supabase (Docker محلي) / PostgreSQL | مهاجرات SQL خالصة؛ `btree_gist`, `pgcrypto`, `pg_trgm`, `pg_cron`. |
| المصادقة | `@supabase/ssr` | **لا تستخدم** `@supabase/auth-helpers-*` (مهملة). |
| الوقت الفعلي | Supabase Realtime | قنوات `postgres_changes` على `notifications` و`sessions`، وتخضع لـ RLS. |
| الملفات | Supabase Storage | حاويات: `avatars` (عام للقراءة)، `proofs` (خاص)، `certificates` (خاص)، `reports` (خاص)، `imports` (خاص مؤقت). |
| PDF | **Chromium/Puppeteer (HTML→PDF)** أساسي — انظر ADR-04 | حل بديل: `@react-pdf/renderer` إن اجتاز اختبار العربية. |
| البريد | Resend + قوالب React Email ثنائية اللغة | |
| مركز الإدارة | Postgres Views/RPCs + وظائف قواعد حتمية + Outbox | بلا مزود أو نموذج ذكاء اصطناعي؛ يعيد استخدام منطق الأعمال والدفاتر المعتمدة؛ راجع §9. |
| الاختبار | Vitest · Playwright · **pgTAP** (`supabase test db`) | |
| الجودة | ESLint + Prettier + Husky + lint-staged + gitleaks | |
| الوقت | **Luxon** (أو date-fns-tz) — ADR-07 | |
| المال | `decimal.js` | |
| Excel | `exceljs` (الخادم) | رفع/تنزيل القوالب. |
| QR | `qrcode` | |

## 2. قرارات معمارية (ADR)

| ADR | القرار | السبب |
| --- | --- | --- |
| 01 | **Monolith**: تطبيق Next.js واحد + Supabase؛ لا خدمات مصغّرة | حجم الفريق/المشروع |
| 02 | **منطق الأعمال الحرج في Postgres** (دوال/تريجرات/قيود): الجنس، التعارض، الرصيد، الدرجة، الدفعات المؤكدة | يصمد أمام أي واجهة أو منفّذ؛ يمكن اختباره بـ pgTAP |
| 03 | **القراءة**: Server Components + Supabase client بجلسة المستخدم (يخضع لـ RLS). **الكتابة**: Server Actions → إما RPC على Postgres أو استعلام مباشر تحت RLS. **admin client** فقط لعمليات `auth.admin` والمهام المجدولة والتقديم العام | تقليل سطح الخطر |
| 04 | **PDF بـ Chromium**: يضمن تشكيل العربية والاتجاه والخطوط المضمنة؛ مكتبات PDF البرمجية قد تفشل في اتصال الحروف/RTL المختلط. **المهمة P0-T06 (Spike) إلزامية** وتحسم القرار بنتيجة فحص بصري (راجع 05) | مخاطرة موثّقة في SRC §11 |
| 05 | **الإشعارات بنمط Outbox**: كل حدث يكتب صفاً في `notifications` (داخل المعاملة نفسها)؛ عامل خلفي يرسل البريد من `notification_outbox` | موثوقية وعدم فقد أحداث |
| 06 | **الوظائف المجدولة**: `pg_cron` للمهام داخل قاعدة البيانات (توليد الحصص، وضع الفواتير متأخرة)، وRoute Handlers `/api/cron/*` (محمية بسر ومُستدعاة من cron خارجي) للمهام التي تحتاج بريداً/PDF | |
| 07 | **مكتبة وقت واحدة (Luxon)** + دوال `lib/time/*` وحيدة لتحويل (تاريخ+وقت+منطقة)→UTC والعكس؛ ممنوع `new Date(string)` في منطق الجدولة | أخطاء DST |
| 08 | **مفاتيح الدور**: الدور من جدول `profiles` عبر دوال `security definer` مخزَّنة مؤقتاً للاستعلام (`(select auth_role())`) — لا نعتمد على claims مخصصة في JWT في الإصدار الأول | تفادي تأخر انعكاس تغيير الدور |
| 09 | **رابط Zoom**: يُخزَّن في جدول خاص بلا قراءة مباشرة للطلاب/الأهل؛ يُسلَّم عبر RPC `get_session_join(session_id)` في نافذة الانضمام | TCH-07 + أمان |
| 10 | **تسعير**: جدول `package_prices` append-only بـ `valid_from`؛ الحل الأحدث الساري يُحسب في دالة `resolve_price()` | سجل تغييرات تلقائي + جدولة |
| 11 | **الدفعات والرصيد دفاتر (ledger) غير قابلة للتعديل** | المادة 4 |
| 12 | **Realtime يحمل إشارة فقط** (id + نوع)؛ العميل يعيد الجلب (تحت RLS) | تفادي تسريب payload |

## 3. هيكل المستودع

```
noor-alwahy/
├─ app/[locale]/
│  ├─ (public)/  page, packages/, apply/, contact/, order-status/, faq/
│  ├─ (auth)/    login/, forgot-password/, reset-password/, mfa/
│  ├─ (admin)/   dashboard/ applications/ students/ teachers/ assignments/ schedule/
│  │             packages/ subscriptions/ finance/ exams/ certificates/ reports/ interventions/ analytics/ exports/ templates/ settings/
│  ├─ (teacher)/ today/ students/ sessions/[id]/evaluate/ reports/ availability/ zoom/ earnings/
│  ├─ (student)/ home/ progress/ schedule/ certificates/ contact/
│  ├─ (parent)/  children/ billing/ contact/
│  └─ verify/[code]/
├─ app/api/      applications/ pdf/ exports/ ics/[token]/ cron/ webhooks/
├─ components/   ui/ (shadcn) · charts/ · forms/ · quran-map/ · layout/ · domain/
├─ lib/
│  ├─ supabase/  client.ts server.ts admin.ts(server-only) middleware.ts
│  ├─ domain/    scoring/ credits/ pricing/ review-queue/ payouts/ scheduling/ interventions/ templates/ ← منطق نقي + اختبارات
│  ├─ validators/  ← Zod
│  ├─ time/ money/ i18n/ pdf/ email/ excel/ exports/ authz/
│  └─ utils/
├─ messages/     ar.json en.json (+ مقسّمة بحسب البوابة)
├─ supabase/     migrations/ seed.sql config.toml tests/ (pgTAP) functions/
├─ scripts/      import-quran.ts check-logical-css.mjs check-rls.mjs
├─ tests/        e2e/ unit/ fixtures/
├─ docs/         adr/ CHANGELOG.md runbooks/
└─ types/        database.types.ts (مولَّد)
```

## 4. المصادقة والتوجيه
1. `middleware`: (أ) تركيب next-intl (ب) تحديث جلسة Supabase (ج) حماية المسارات بحسب مجموعة الـ Route (د) إعادة توجيه الدور الخطأ.
2. الدور يُقرأ مرة لكل طلب في Layout الخادمي ويُمرَّر للأبناء (لا يُجلب في كل مكوّن).
3. `lib/authz`: `requireRole(['admin'])`, `requireStudentAccess(studentId)` تستخدم في Server Actions كطبقة دفاع ثانية فوق RLS.
4. دور admin ← MFA مطلوب قبل بلوغ مسارات الإدارة (فحص AAL2).

## 5. الأدوار وRLS (ملخص — التفصيل في 03)
- دوال مساعدة: `auth_role()`, `is_admin()`, `my_teacher_id()`, `teaches_student(uuid)`, `guards_student(uuid)`, `is_my_student(uuid)`.
- في السياسات استخدم `(select auth.uid())` و`(select is_admin())` (التفاف الدالة بـ select يتيح للمُخطِّط تخزين النتيجة) .
- كل سياسة تحدد الدور `to authenticated` وتفصل INSERT/UPDATE/DELETE/SELECT.
- الجداول العامة (`packages`, `contact_links`…) `to anon, authenticated` قراءة بشروط (`is_published`).

## 6. الأخطاء ونمط الاستجابة
- Server Actions ترجع `Result<T> = { ok: true, data } | { ok: false, code, message_key, fieldErrors? }`؛ لا تُرمى استثناءات للمستخدم.
- أخطاء Postgres المعروفة تُحوَّل لرموز: `gender_mismatch`, `schedule_overlap`, `insufficient_credits`, `evaluation_locked`, `payment_immutable`, `price_out_of_bounds`.
- التسجيل: JSON مهيكل، بلا بيانات شخصية. (Sentry أو بديل يُخفي PII — ADR لاحق.)

## 7. الواجهة وإمكانية الوصول
- تصميم الجوال أولاً؛ نقاط الكسر 360/768/1024/1280.
- نماذج التقييم: مكوّنات touch-friendly (≥ 44px)، تقدّم تلقائي، حفظ مسودة محلي عند انقطاع الشبكة (IndexedDB) ثم مزامنة.
- خريطة المصحف: Canvas أو SVG افتراضي (virtualized)، 604 خلية؛ تفاعل بلوحة المفاتيح؛ ARIA.
- الوضع الداكن اختياري بالكحلي؛ التباين AA في الوضعين.
- خطوط: Cairo/IBM Plex Sans Arabic للنص، Amiri/Scheherazade للآيات والشهادات — مستضافة ذاتياً (`next/font/local`) لا من CDN؛ تحقق من رخصة كل خط.

## 8. الوظائف المجدولة

| الوظيفة | التوقيت | الآلية | الوصف |
| --- | --- | --- | --- |
| `generate_sessions` | يومياً 02:00 UTC | pg_cron → دالة SQL | BR-12، أفق 28 يوماً، idempotent بقيد فريد (slot_id, scheduled_at) |
| `mark_invoices_overdue` | كل ساعة | pg_cron | `issued/partially_paid` وتجاوز `due_date` |
| `subscription_reminders` | يومياً | cron → `/api/cron/reminders` | 7/3/0 أيام + فاتورة التجديد |
| `pending_payment_alerts` | كل 6 ساعات | cron | فواتير بانتظار التأكيد > N ساعة |
| `late_reports_nudge` | أسبوعياً | cron | تذكير المدرسين |
| `attendance_lock` | كل ساعة | pg_cron | يضبط `locked_at` |
| `dst_change_notices` | أسبوعياً | cron | حصص تتغير توقيتها المحلي خلال 14 يوماً |
| `outbox_dispatch` | كل دقيقة | cron/Edge Function | إرسال البريد وإعادة المحاولة (backoff) |
| `payout_accrual` | عند الحدث + ليلي للمطابقة | SQL | يملأ `teacher_payout_items` |

كل وظيفة idempotent، ولها سجل تشغيل `job_runs` (الاسم، البدء/الانتهاء، النتيجة).

## 9. مركز الإدارة والمتابعة
- **لا تكامل AI:** لا `app/api/ai` ولا `lib/ai` ولا مفاتيح أو SDK أو Prompt أو vector store. يمنع CI الأنماط والتبعيات المعروفة، وتبقى بيانات الأكاديمية داخل حدود الخدمات المعتمدة.
- **مصدر واحد للحقيقة:** كل KPI أو حالة تدخل تقرأ من Views/RPCs فوق الجداول والدفاتر الحالية؛ لا تُعاد صياغة BR-07/09/11/15 أو حسابات المال في React. المال يرجع صفًا لكل عملة، والفترة تُحوّل في الخادم وفق IANA ثم تُنفذ على `timestamptz`.
- **قواعد التدخل:** registry معروف للأنواع يربط كل نوع باستعلام أدلة وإجراء مسموح. العتبات والنوافذ والأولوية وcooldown بيانات مضبوطة بقيود؛ evaluator مجدول يقفل نطاق تشغيله، ويستخدم مفتاح dedupe حتميًا، ويدعم open/resolve/reopen دون حذف التاريخ.
- **الواجهة:** Server Component للملخص الأولي، وفلاتر/ترقيم خادمي للصفوف؛ Realtime إشارة لإعادة الجلب فقط. كل بطاقة تحمل تعريفًا، وقت حداثة، وحالة unavailable مستقلة حتى لا يُعرض صفر كاذب.
- **التصدير:** الطلب يحفظ snapshot للفلاتر والأعمدة واللغة والمنطقة والعملات. النتائج الصغيرة آنية، والكبيرة `export_jobs` خلفية محدودة التوازي، تكتب إلى bucket خاص بمسار UUID ورابط signed قصير، ثم تنظفها وظيفة احتفاظ. Chromium المعتمد للـPDF و`exceljs` للـExcel.
- **القوالب:** schema ثابت ذو نسخ immutable ومتغيرات allowlist typed وfallbacks؛ renderer نقي مشترك للمعاينة والإخراج. تعقم النصوص والروابط، ولا يسمح CSS/HTML أو تعبيرات قابلة للتنفيذ، ولا نشر/إرسال دون اعتماد بشري.
- **الأمان:** كل RPC إداري يتحقق من `is_admin()` وAAL2، يثبت `search_path` ويضع `statement_timeout` و`LIMIT`. RLS deny-by-default على القواعد والحالات والقوالب والتصديرات، وتدقيق للتغييرات والانتقالات والتنزيلات الحساسة.

## 10. الملفات والتخزين
- المسارات: `{bucket}/{owner_profile_id}/{uuid}-{filename}`. سياسات Storage تربط المسار بالمالك والدور. أنواع/أحجام مسموحة محددة (إثبات التحويل: صور/PDF ≤ 5MB).
- إثبات التحويل: مع أن الأصل أن يُرسل عبر روابط التواصل (SRC §FIN-08)، يُهيّأ حقل `proof_file_path` للإدارة لرفع لقطة يستلمها المدير يدوياً.
- فحص الامتداد وmagic bytes عند الرفع.

## 11. البيئات والمتغيرات

```
# .env.example (القيم أمثلة فارغة)
NEXT_PUBLIC_SITE_URL=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=          # خادم فقط
NEXT_PUBLIC_RECAPTCHA_SITE_KEY=
RECAPTCHA_SECRET_KEY=
RESEND_API_KEY=
EMAIL_FROM=
CRON_SECRET=
ICS_TOKEN_PEPPER=
```
التحقق من المتغيرات عند الإقلاع بـ Zod (`lib/env.ts`)، ويفشل البناء إن نقص متغير مطلوب.

## 12. النشر والتشغيل
- **بيئات:** local (Docker) → staging → production. مهاجرات تُطبَّق بـ `supabase db push` عبر CI بموافقة يدوية للإنتاج.
- **الاستضافة:** الخيار (أ) Vercel + Supabase مُستضاف؛ الخيار (ب) VPS (Docker Compose) + Supabase ذاتي الاستضافة. القرار [OWNER?] — **تنبيه:** Chromium/Puppeteer على Vercel له قيود حجم؛ إن اختير (أ) فاستخدم حزمة Chromium مخصصة للخوادم عديمة الحالة أو خدمة PDF منفصلة صغيرة.
- **النسخ الاحتياطي:** `pg_dump` يومي + احتفاظ 30 يوماً + نسخة Storage؛ **تدريب استعادة** مجدول شهرياً ومُوثَّق في `docs/runbooks/restore.md`.
- **المراقبة:** health endpoint، تنبيه على فشل الوظائف المجدولة، سجل أخطاء.
- **الامتثال والخصوصية:** سياسة خصوصية وشروط استخدام بلغتين، وموافقة ولي الأمر على بيانات القاصر عند التقديم (مخزَّنة بالتاريخ والنسخة)، ومسار حذف/تصدير بيانات عند الطلب [OWNER? قانونياً بحسب دول الطلاب].

## 13. الأداء
- الصفحات العامة ISR مع `revalidateTag` عند تغيير الباقات/الأسعار.
- فهارس: كل FK، و`sessions(teacher_id, scheduled_at)`, `sessions(student_id, scheduled_at)`, `attendance(session_id)`, `memorization_progress(student_id, next_review_due)`, `notifications(user_id, read_at, created_at desc)`, `audit_logs(table_name, record_id, created_at)`، وفهرس GIN trigram على أسماء البحث.
- Views مجمّعة (أو materialized بتحديث مجدول) للوحة الإدارة.
- ميزانية: أول تحميل < 2.5s على 4G، حزمة JS للصفحات العامة < 150KB (gzip) تقريباً [هدف].
