# دليل تسليم مشروع أكاديمية نور الوحي للنماذج والمطورين

> **الغرض:** أرسل هذا الملف إلى أي نموذج ذكاء اصطناعي أو مطور جديد قبل أن يغيّر المشروع. يشرح المنتج، بنية الكود، قواعد الأمان، قاعدة البيانات، التشغيل، والاختبارات.
>
> **آخر تحديث لهذا الدليل:** 2026-11-01 — Africa/Cairo.
>
> **مهم:** هذا الدليل لا يحتوي أسرارًا. لا ترسل ملف `.env.local` أو مفاتيح Supabase أو نسخ قاعدة البيانات غير المشفّرة إلى أي نموذج أو طرف ثالث.

---

## 1. تعليمات سريعة للنموذج الجديد

ابدأ بالرسالة التالية أو بما يعادلها:

```text
أنت تعمل على مشروع أكاديمية نور الوحي. اقرأ أولًا:
1) AGENTS.md
2) .specify/memory/constitution.md
3) docs/PROJECT_STATUS.md
4) هذا الملف docs/AI_PROJECT_HANDOFF.md

التزم بالقواعد غير القابلة للتفاوض، لا تعدّل أو تحذف تغييرات محلية موجودة، لا تكشف الأسرار،
ولا ترفع أو تعمل commit أو push إلا بإذن صريح من المالك. قبل أي تعديل افحص الكود الحالي
وتأكد أن المشكلة ما زالت موجودة. شغّل اختبارًا مناسبًا وسجّل نتيجته الحقيقية فقط.
```

### ترتيب المرجع عند وجود تعارض

1. طلب المالك الصريح، ما لم يخالف قاعدة أمنية أو قانونية ملزمة.
2. `AGENTS.md` و`.specify/memory/constitution.md`.
3. المواصفات تحت `specs/001-noor-alwahy/`.
4. قرارات التصميم المعمارية تحت `docs/adr/`.
5. `docs/PROJECT_STATUS.md` لحالة العمل الفعلية ونقطة الاستئناف.
6. هذا الدليل: خريطة عملية للمشروع، وليس بديلًا عن قراءة الملفات أعلاه.

---

## 2. ما هو المشروع؟

**أكاديمية نور الوحي** نظام ويب ثنائي اللغة لإدارة أكاديمية تحفيظ القرآن عن بُعد. يدعم أربعة أدوار:

| الدور     | الغرض الأساسي                                                                       |
| --------- | ----------------------------------------------------------------------------------- |
| المدير    | إدارة الطلاب والمعلمين والجدولة والتقييمات والتقارير والمالية والمحتوى والتدقيق.    |
| المدرس    | يومه الدراسي، طلابه المسندون، الحضور، التقييمات، التقارير، التوفر، Zoom، المستحقات. |
| الطالب    | الهدف والخطة والتقدم وخريطة المصحف والجدول والفواتير والشهادات وقنوات التواصل.      |
| ولي الأمر | متابعة الأبناء المرتبطين فقط، التقدم والحضور والتقارير والجدول والفواتير الأسرية.   |

المنتج ليس منصة مراسلة: **لا توجد ولا يجب إضافة دردشة مباشرة بين المدرس والأسرة أو الطالب**. التواصل يتم عبر القنوات الرسمية المنشورة من الإدارة فقط.

### النطاق الوظيفي الكبير

- موقع عام: الصفحة الرئيسية، المسارات، الباقات حسب الدولة، نموذج الالتحاق، صفحة تواصل، FAQ، تحقق الشهادات، تقديم المعلمين.
- هوية وصلاحيات: Supabase Auth، دعوات، أدوار، MFA للمدير، ملفات عامة وخاصة.
- التشغيل الأكاديمي: تعيينات مدرس/طالب، مواعيد أسبوعية، جلسات مولّدة، حضور، بدائل وتعويضات، تقويم وICS.
- التقييم والتقدم: مسودات وتقييمات مقفلة، معايير قابلة للإدارة، خريطة 604 صفحات، مراجعة متباعدة، خطط حفظ، تقارير.
- الإدارة والمال: باقات وأسعار حسب الدولة، اشتراكات، فواتير، دفعات واستردادات، مصروفات، تسويات، مستحقات مدرسين، تصديرات.
- الشهادات والاختبارات والمحتوى: قوالب ونسخ ثابتة للشهادات، QR للتحقق، اختبارات، إعلانات موجهة، قوالب محتوى، سجل تدقيق.

---

## 3. لقطة حالة العمل عند التسليم

هذه المعلومات لحظة إنشاء الملف فقط؛ افحصها دائمًا من Git قبل التصرف:

- مجلد المشروع: `D:\احدث نسخه من دار\noor-alwahy`
- الفرع الذي كان مفعلًا: `work/teacher-portal-reference-ui`
- يوجد Remote باسم `origin` إلى GitHub.
- توجد تعديلات محلية غير ملتزم بها عند إنشاء هذا الدليل، منها إصلاح محلي لعرض سعر الباقات ووثائق UAT. **لا تفترض أنها تخص مهمتك ولا تحذفها أو تعيد ضبطها.**
- قد توجد worktrees مجاورة؛ لا تنقل أو تدمج بينها تلقائيًا.

نفّذ هذه الفحوصات أولًا وبوضع القراءة فقط:

```powershell
git status --short
git branch --show-current
git log --oneline -10
git remote -v
```

**سياسة المالك الحالية:** لا تعمل `commit` أو `push` أو أي رفع إلى GitHub إلا بطلب صريح جديد من المالك، حتى لو نصت وثيقة أقدم على سير عمل مختلف.

---

## 4. التقنيات والإصدارات

| المجال                 | التقنية                                                                                  |
| ---------------------- | ---------------------------------------------------------------------------------------- |
| الواجهة والخادم        | Next.js 16.4.2، App Router، React 19.3، TypeScript 5.9 strict                            |
| التصميم                | Tailwind CSS 4، مكوّنات Radix Slot، `class-variance-authority`، `tailwind-merge`، Lucide |
| اللغة                  | `next-intl` 4.14؛ العربية والإنجليزية، والمسارات تبدأ دائمًا بـ `/ar` أو `/en`           |
| قاعدة البيانات والهوية | Supabase/PostgreSQL، Supabase Auth، RLS، Realtime، Storage                               |
| التحقق                 | Zod 4.6 على حدود Server Actions وRoute Handlers                                          |
| الزمن                  | Luxon + IANA time zones فقط                                                              |
| المال                  | `decimal.js`؛ لا تستخدم `number` أو float لحساب المال                                    |
| PDF/QR                 | Chromium محلي/مخفف، `puppeteer-core`، `@react-pdf/renderer` للاختبار المقارن، `qrcode`   |
| الاختبارات             | Vitest، Playwright + axe، pgTAP/Supabase SQL، Lighthouse CI، k6                          |
| مدير الحزم             | pnpm 11.25 (Node.js >= 22)                                                               |

لا تضف مكتبة أو خدمة خارجية قبل قراءة القواعد وسبب الحاجة. المنتج **يحظر** تكاملات الذكاء الاصطناعي وقت التشغيل.

---

## 5. خريطة المجلدات

```text
app/                    صفحات Next.js، layouts، Route Handlers وملفات SEO
  [locale]/             كل الصفحات المرئية تحت /ar و/en
  api/                  APIs للـPDF، التقويم، الصحة، exports، cron …
components/             واجهات حسب المجال + ui/ للمكوّنات الأساسية
lib/                    منطق الأعمال، الاستعلامات، Server Actions، التحقق، عملاء Supabase
messages/               ar.json وen.json؛ كل النصوص المرئية يجب أن تعيش هنا
i18n/                   تعريف locale والـnavigation
supabase/
  migrations/           مصدر حقيقة مخطط PostgreSQL؛ مهاجرات فقط وبترتيب زمني
  tests/                pgTAP وRLS/SQL tests
  seed.sql              بيانات تطوير محلية فقط
types/database.types.ts الأنواع المولدة من قاعدة البيانات؛ لا تعدل يدويًا
tests/
  unit/                 Vitest لمنطق TypeScript
  e2e/                  Playwright لرحلات التطبيق الفعلية
  performance/          k6 smoke
scripts/                أدوات تطوير، PDF، نسخ احتياطي، توليد أنواع وفحوص ثابتة
docs/                   ADRs، Runbooks، تدقيقات، الحالة، قرارات المالك
specs/001-noor-alwahy/  المواصفات، المتطلبات، مراحل العمل ومعايير القبول
public/                 الصور والملفات العامة الثابتة
.agents/skills/         مهارات محلية مُثبتة للمشروع عند الحاجة
```

### ملفات البدء المهمة

| الملف                                | لماذا تقرؤه؟                                                 |
| ------------------------------------ | ------------------------------------------------------------ |
| `AGENTS.md`                          | قواعد جلسة العمل، Git، الجودة، والتعامل مع تغييرات المستخدم. |
| `.specify/memory/constitution.md`    | قيود الأمان والمال والقرآن والخصوصية غير القابلة للتفاوض.    |
| `docs/PROJECT_STATUS.md`             | المهمة الحالية، ما اختُبر فعليًا، والمهام الخارجية العالقة.  |
| `README.md`                          | التشغيل المحلي وبوابة الجودة.                                |
| `.env.example`                       | أسماء المتغيرات المطلوبة فقط، بلا قيم.                       |
| `proxy.ts`                           | حماية المسارات وتوجيه الدور وMFA.                            |
| `i18n/routing.ts`                    | تعريف اللغات والمسارات.                                      |
| `components/portal/portal-config.ts` | أقسام كل بوابة.                                              |
| `types/database.types.ts`            | شكل قاعدة البيانات في TypeScript.                            |

---

## 6. المسارات والبوابات

### المسارات العامة والمصادقة

| المسار                                                                                  | الوظيفة                              |
| --------------------------------------------------------------------------------------- | ------------------------------------ |
| `/ar` و`/en`                                                                            | الموقع العام.                        |
| `/{locale}/tracks`                                                                      | المسارات المنشورة.                   |
| `/{locale}/apply`                                                                       | طلب التحاق طالب متعدد الخطوات.       |
| `/{locale}/offer/[accessKey]`                                                           | عرض سعر خاص؛ لا تفترض أنه صفحة عامة. |
| `/{locale}/contact`, `/faq`, `/privacy`, `/terms`                                       | المحتوى العام.                       |
| `/{locale}/verify/[code]`                                                               | تحقق شهادة.                          |
| `/{locale}/join-teachers`                                                               | طلب تقديم معلم.                      |
| `/{locale}/auth/login`, `/forgot-password`, `/reset-password`, `/accept-invite`, `/mfa` | رحلات الهوية.                        |

### بوابة المدير `/[locale]/admin/*`

`dashboard`, `control-center`, `packages`, `applications`, `teacher-applications`, `subscriptions`, `finance`, `students`, `teachers`, `assignments`, `schedule`, `attendance`, `evaluation`, `exams`, `certificates`, `reports`, `announcements`, `templates`, `users`, `audit`, `settings`.

### بوابة المدرس `/[locale]/teacher/*`

`today`, `schedule`, `students`, `attendance`, `evaluations`, `reports`, `notifications`, `requests`, `availability`, `zoom`, `earnings`, `profile`, `exams`.

المدرس يرى الطلاب المسندين إليه فقط. لا تضف صلاحية لإنشاء محادثة أو رؤية بيانات الأسرة الخاصة.

### بوابة الطالب `/[locale]/student/*`

`home`, `progress`, `schedule`, `billing`, `certificates`, `contact`.

صفحة التقدّم تستخدم `components/progress/quran-map-section.tsx` وتعرض الخطة والملخص وخريطة المصحف. لا تعرض نصوص آيات في الخريطة أو أي واجهة.

### بوابة ولي الأمر `/[locale]/parent/*`

`home`, `children`, `schedule`, `billing`, `contact`. يجب حفظ الابن المختار عبر التنقل ومنع أي قراءة لابن غير مرتبط بالحساب.

### Route Handlers المهمة

- `app/api/health/route.ts`: تحقق الصحة.
- `app/api/cron/notifications/route.ts`: معالجة التنبيهات المجدولة؛ محمي بسر cron.
- `app/api/calendar/*`: تنزيل/عرض ICS وPDF للتقويم.
- `app/api/pdf/*`: PDF للتقارير والفواتير والشهادات والاختبارات.
- `app/api/admin/*`: تصديرات الإدارة، الباقات، التقارير المتقدمة والقوالب.
- `app/api/applications/*` و`app/api/teacher-applications/route.ts`: تقديم واستعلامات عامة مقيدة.

أي Route Handler جديد يحتاج: تحقق Zod، تحقق هوية/دور قبل البيانات الحساسة، استجابات أخطاء مفهومة، وبدون تسريب استثناءات أو أسرار.

---

## 7. بنية التطبيق وكيف تنتقل البيانات

### القاعدة العامة

1. **Server Components افتراضيًا.** أضف `"use client"` فقط عندما تحتاج تفاعل متصفح أو realtime أو حالة محلية.
2. الواجهة في `components/`، ومنطق المجال والاستعلامات والإجراءات في `lib/<domain>/`.
3. التحقق من الإدخال في `lib/validators/` باستخدام Zod.
4. استعمل `lib/actions/safe-action.ts` حيث يلائم لتحويل أخطاء الأعمال المتوقعة إلى مفاتيح ترجمة.
5. لا تضع مفاتيح Supabase أو قواعد صلاحية حساسة داخل المكوّنات.

### عملاء Supabase

| الملف                        | الاستخدام                                               |
| ---------------------------- | ------------------------------------------------------- |
| `lib/supabase/server.ts`     | Server Components وServer Actions باستخدام cookies.     |
| `lib/supabase/client.ts`     | مكوّنات العميل فقط.                                     |
| `lib/supabase/admin.ts`      | service role على الخادم فقط؛ لا يستورد من العميل أبدًا. |
| `lib/supabase/middleware.ts` | تحديث/تحقق جلسة proxy.                                  |
| `lib/supabase/public.ts`     | بيانات عامة آمنة فقط.                                   |

### الحماية والتوجيه

`proxy.ts` يجمع توجيه `next-intl` مع جلسة Supabase. يفرض الآتي:

- غير المسجل يُحوّل إلى صفحة دخول اللغة المناسبة مع `next` آمن.
- صاحب الدور الخطأ يعود إلى الرئيسية المناسبة لدوره.
- المدير يحتاج AAL2/MFA قبل `/admin`.
- API لا يمر بتحويل locale.

لا تعتمد على إخفاء زر في الواجهة كصلاحية؛ قاعدة البيانات و`require-role` هي الحماية الفعلية.

---

## 8. قواعد المنتج والأمان التي لا يجوز كسرها

هذه خلاصة الدستور؛ اقرأ الأصل دائمًا قبل التعديل:

### هوية وبيانات

- RLS مفعّلة على كل جدول `public` وسياسة المنع هي الافتراضية.
- `SUPABASE_SERVICE_ROLE_KEY` يبقى على الخادم داخل `lib/supabase/admin.ts` فقط.
- قرارات الهوية على الخادم تستخدم `supabase.auth.getUser()`، لا `getSession()`.
- المدخلات تمر عبر Zod؛ البيانات الشخصية الحساسة تعزل في جداول خاصة أو RPC آمن.
- التغييرات الإدارية المهمة تسجل في `audit_logs` حيث يلزم.

### المدرس والأسرة والطفل

- لا رسائل/محادثة/تعليقات ثنائية الاتجاه بين المدرس والأسرة أو الطالب.
- التعيين بحسب الجنس مفروض في PostgreSQL على `teacher_assignments` و`sessions`، وليس فلتر واجهة فقط.
- الطالب يرى نفسه، وولي الأمر يرى أبناءه المرتبطين، والمدرس يرى المكلف بهم فقط.
- لا تحليلات خارجية تتبع الأطفال ولا لوحات ترتيب عامة.

### المال

- استخدم `numeric(12,2)` في PostgreSQL و`decimal.js` في TypeScript.
- لا تجمع عملات مختلفة.
- سعر الباقة يُؤخذ snapshot عند إنشاء الاشتراك/الفاتورة.
- الدفعات المؤكدة لا تعدّل أو تحذف؛ التصحيح باسترداد أو عكس جديد.
- رصيد الحصص دفتر قيود (`session_credit_ledger`) وليس عدادًا قابلًا للتعديل.
- مستحق الحصة للمدرس يدفع مرة واحدة لكل `session_id`.

### الوقت

- التخزين `timestamptz`/UTC.
- الإدخال والعرض عبر منطقة IANA مثل `Africa/Cairo`، لا offset مثل `+02:00`.
- استخدم `lib/time` وLuxon، ولا تنشئ منطق وقت يدويًا بـ`Date` الخام.

### القرآن والذكاء الاصطناعي

- مصدر بيانات المصحف الموثوق والمستورد فقط؛ لا تكتب أو تولّد نص آيات يدويًا.
- لا تعرض نص الآيات في UI أو PDF أو API أو تقرير؛ المسموح أرقام/أسماء سور/صفحات/أجزاء ومؤشرات مشتقة.
- لا تضف OpenAI أو Gemini أو Anthropic أو أي خدمة AI إلى المنتج أو تبعياته وقت التشغيل.

### اللغة والتصميم

- كل النص المرئي في `messages/ar.json` و`messages/en.json`.
- استخدم خصائص CSS المنطقية: `ms`/`me`/`ps`/`pe`/`start`/`end`؛ لا `left`/`right` أو `ml`/`mr`.
- كل ميزة تتأكد بالعربية والإنجليزية، RTL وLTR، الفاتح والداكن، و360/768/1440 عند تغيير UI.

---

## 9. خريطة مجالات الأعمال وقاعدة البيانات

`supabase/migrations/` هو مصدر الحقيقة. لا تعدّل مهاجرة مدمجة؛ أنشئ واحدة جديدة ببادئة زمنية، ثم حدّث الأنواع والاختبارات.

| المجال               | الجداول/الكيانات الرئيسية                                                                                              | موضع كود التطبيق                                                  |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| الهوية               | `profiles`, `profile_private`, `audit_logs`                                                                            | `lib/auth`, `lib/admin`, `components/account`                     |
| الدليل الأكاديمي     | `students`, `guardians`, `student_guardians`, `teachers`, `tracks`, `levels`                                           | `lib/students`, `lib/teachers`, `components/admin`                |
| التعيين والجدول      | `teacher_assignments`, `schedule_slots`, `sessions`, `session_credit_ledger`, `job_runs`                               | `lib/assignments`, `lib/schedules`, `lib/sessions`                |
| الحضور               | `attendance`, `teacher_rates`, `teacher_payout_items`, `makeup_entitlements`, `session_alerts`                         | `lib/attendance`, `components/attendance`                         |
| التقييم والتقدم      | `eval_criteria`, `eval_weights`, `eval_settings`, `session_evaluations`, `memorization_progress`, `memorization_plans` | `lib/evaluation`, `lib/progress`, `lib/memorization-plans`        |
| المصحف الداخلي       | `quran_surahs`, `quran_ayahs`, `quran_pages`, `quran_dataset_meta`                                                     | `lib/progress/quran-map.ts`, `components/progress/quran-map.tsx`  |
| التقارير             | `reports`                                                                                                              | `lib/reports`, `components/reports`                               |
| الباقات والتقديم     | `countries`, `packages`, `package_prices`, `coupons`, `applications`, `placement_tests`                                | `lib/packages`, `lib/public-site`, `lib/applications`             |
| الاشتراكات والفوترة  | `subscriptions`, `invoices`, `invoice_items`, `payments`, `payment_methods`, `expenses`                                | `lib/subscriptions`, `lib/billing`, `components/billing`          |
| مستحقات المعلمين     | `teacher_payouts`, `teacher_adjustments`                                                                               | `lib/payouts`, `components/payouts`                               |
| الشهادات والاختبارات | `exams`, `exam_results`, `certificate_templates`, `certificate_template_versions`, `certificates`                      | `lib/exams`, `lib/certificates`, `components/certificates`        |
| التنبيهات والمحتوى   | `notifications`, `notification_prefs`, `notification_outbox`, `announcements`, `content_templates`                     | `lib/notifications`, `lib/announcements`, `lib/content-templates` |
| الإدارة المتقدمة     | `intervention_rules`, `intervention_cases`, `export_jobs`, `reconciliation_runs`                                       | `lib/control-center`, `lib/interventions`, `lib/reconciliation`   |
| الإعدادات والقنوات   | `app_settings`, `contact_links`, `calendar_feed_tokens`                                                                | `lib/settings`, `lib/contact-links`, `lib/calendar`               |
| تقديم المعلمين       | `teacher_applications`                                                                                                 | `lib/teacher-applications`, `components/applications`             |

### RPCs/Triggers لا تتجاوزها

توجد دوال PostgreSQL حرجة مثل `record_attendance`, `generate_sessions`, `get_session_join`, `apply_evaluation_to_progress`, `create_subscription`, `transition_teacher_payout`, `issue_certificate`, `verify_certificate`, `publish_admin_announcement` و`run_financial_reconciliation`.

لا تعِد تنفيذ قواعدها في الواجهة أو تستبدلها بعمليات insert/update مباشرة، لأن سلامة المال والحضور والتقدم والصلاحيات موجودة في SQL. اقرأ المهاجرة المعنية واختبارها قبل التعديل.

---

## 10. الواجهات والهوية البصرية

- الخطوط محلية: Cairo وAmiri في `app/fonts.ts` و`app/fonts/`.
- الألوان والمكونات الأساسية في `app/globals.css` و`components/ui/`.
- مرجع التصميم الحي: `/{locale}/dev/ui`.
- غلاف البوابات: `components/portal/portal-shell.tsx`، والتنقل: `components/portal/portal-navigation.tsx`.
- اسم وشعار الأكاديمية من الإعدادات العامة؛ لا تثبت شعارًا جديدًا في مكوّن دون موافقة.
- الوضع الداكن محفوظ في المتصفح، ويجب ألا يظهر وميض أو فقد تباين عند التبديل.
- عناصر اللمس لا تقل عن الهدف المريح، والأيقونات بلا نص تحتاج اسم وصول (`aria-label`).

### تجربة الطالب الحالية (معلومة مفيدة للمهمة القادمة)

صفحة `/{locale}/student/progress` تتكون من:

1. `StudentPageShell` (عنوان وصورة الخلفية).
2. `StudentPlanCard` للخطة الأسبوعية/الشهرية.
3. `StudentProgressDashboard` للملخص والرسوم والمراجعة.
4. `QuranMap` لخريطة 604 صفحات.

الرئيسية `StudentHomeDashboard` تعرض ملخصًا مشابهًا. عند تحسين UX، لا تجعل الصفحة تكرر نفس مؤشرات الرئيسية بلا هدف؛ الرئيسية للملخص والإجراء القادم، والتقدم للتفاصيل والخطة والخريطة.

---

## 11. التشغيل على جهاز جديد (Windows)

### المتطلبات

- Git.
- Node.js 22 أو أحدث.
- Corepack/pnpm 11.25.
- Docker Desktop أو Podman قيد التشغيل لتشغيل Supabase المحلي.
- متصفح Chromium/Chrome/Edge محلي لتوليد PDF وتشغيل Playwright.
- مساحة كافية للحاويات و`node_modules`.

### الطريقة المفضلة: استنساخ Git

```powershell
git clone <REMOTE_URL> noor-alwahy
Set-Location noor-alwahy
corepack enable
pnpm install --frozen-lockfile
Copy-Item .env.example .env.local
pnpm supabase:start
node node_modules/supabase/dist/supabase.js status --output json
```

املأ القيم المحلية في `.env.local` من ناتج `supabase status --output json`:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=<API_URL>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<PUBLISHABLE_KEY>
SUPABASE_SERVICE_ROLE_KEY=<SERVICE_ROLE_KEY>
```

بعدها:

```powershell
pnpm db:types
pnpm dev
```

افتح `http://localhost:3000/ar`. صفحات المطور المحلية: `/ar/dev/ui` و`/ar/dev/supabase`.

### إذا نقلت المجلد يدويًا بدل Git

انقل ملفات المصدر و`.git` إن كنت تريد التاريخ، **ولا تنقل** `node_modules`, `.next`, `output`, `test-results`, ملفات النسخ الاحتياطي أو `.env.local` من دون سبب محدد. على الجهاز الجديد نفّذ `pnpm install --frozen-lockfile` ثم أنشئ `.env.local` جديدة كما سبق.

### ملاحظات التشغيل

- `pnpm dev` يشغّل `scripts/run-local-dev.mjs` ويبحث عن Chrome/Edge/Playwright Chromium لتوليد PDF محليًا.
- `pnpm supabase:stop` يوقف حاويات Supabase.
- `pnpm db:reset` يعيد بناء قاعدة البيانات المحلية من المهاجرات والـseed؛ هو **مدمر للبيانات المحلية** ولا يُنفذ بلا موافقة واضحة إن كان عليها عمل مهم.
- التسجيل الذاتي معطل على مستوى Supabase؛ أنشئ المستخدمين عبر رحلات الإدارة/الدعوة المتاحة، لا بإضعاف الإعدادات.

---

## 12. متغيرات البيئة

الأسماء التالية موجودة في `.env.example`. لا تضع القيم في Git أو screenshot أو prompt لنموذج خارجي.

| المتغير                                                  | الغرض                       | مكانه                      |
| -------------------------------------------------------- | --------------------------- | -------------------------- |
| `NEXT_PUBLIC_SITE_URL`                                   | عنوان الموقع العام          | العميل/الخادم، بلا أسرار   |
| `PRIVATE_PRICING_ACCESS_KEY`                             | حماية عروض السعر الخاصة     | الخادم فقط                 |
| `NEXT_PUBLIC_SUPABASE_URL`                               | URL Supabase                | عام                        |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`                          | مفتاح publishable/anon      | عام، لكنه ليس service role |
| `SUPABASE_SERVICE_ROLE_KEY`                              | وصول إداري Supabase         | خادم فقط، حساس جدًا        |
| `NEXT_PUBLIC_RECAPTCHA_SITE_KEY`, `RECAPTCHA_SECRET_KEY` | حماية نماذج عامة            | الثاني سري                 |
| `APPLICATION_LOOKUP_PEPPER`                              | تجزئة/حماية استعلامات طلبات | سري                        |
| `RESEND_API_KEY`, `EMAIL_FROM`                           | البريد                      | المفتاح سري                |
| `CRON_SECRET`, `ICS_TOKEN_PEPPER`                        | jobs وروابط التقويم         | سريان                      |
| `DEPLOYMENT_ENVIRONMENT`, `MONITORING_ALERT_WEBHOOK_URL` | التشغيل والتنبيه            | webhook حساس               |
| `CHROMIUM_PACK_URL`                                      | حزمة Chromium للإنتاج       | خادم فقط                   |

متغيرات النسخ الاحتياطي لا تعيش في `.env.example` لأنها تشغيلية فقط: `BACKUP_ENCRYPTION_KEY`, `DATABASE_URL`, `BACKUP_OUTPUT_DIR`, و(عند الاستعادة التجريبية فقط) `ALLOW_DATABASE_RESTORE=staging-drill`, `RESTORE_DATABASE_URL`, `BACKUP_FILE`.

---

## 13. أوامر الجودة والاختبارات

شغّل الحد الأدنى المناسب للمهمة أولًا، ثم البوابة الأوسع عند نهاية مرحلة أو تغيير عابر للمجالات.

```powershell
# TypeScript + Next typed routes
pnpm typecheck

# ESLint، وفحص logical CSS، ومنع مسارات المراسلة
pnpm lint

# تنسيق
pnpm format:check

# اختبارات الوحدة
pnpm test

# قاعدة البيانات المحلية وpgTAP
pnpm db:test
pnpm check:rls

# Build إنتاجي
pnpm build

# Playwright على بيئة محلية جاهزة
pnpm test:e2e:local

# اختبار ملف محدد مثالًا
pnpm test:e2e:local tests/e2e/quran-map.spec.ts
```

### ما الذي يختبر أين؟

| النوع | المكان                                              | أمثلة                                                                                 |
| ----- | --------------------------------------------------- | ------------------------------------------------------------------------------------- |
| وحدة  | `tests/unit/`                                       | المال، الوقت، الصلاحيات، التقييم، الطلاب، الباقات، التقارير.                          |
| E2E   | `tests/e2e/`                                        | الدخول، MFA، الحضور، التقييم، خريطة المصحف، البوابات، public site، ولي الأمر، المدرس. |
| SQL   | `supabase/tests/`                                   | RLS، integrity، وظائف Postgres، workflows.                                            |
| أداء  | `tests/performance/k6-smoke.js`, `lighthouserc.cjs` | الصفحات العامة ثم ملف طالب بمصادقة عند توفير cookie مؤقتة.                            |

لا تقل "نجح" إلا لأمر شغّلته في هذه الجلسة. إن تعذر اختبار بسبب Docker أو شبكة أو أسرار، اذكر السبب والبديل اليدوي بوضوح.

---

## 14. قاعدة البيانات: أسلوب التغيير الصحيح

1. اقرأ المهاجرات القريبة من المجال واختباراتها قبل كتابة SQL.
2. أضف مهاجرة جديدة فقط داخل `supabase/migrations/` باسم زمني صحيح.
3. في الجداول الجديدة أضف RLS والسياسات والفهارس و`updated_at` وتدقيقًا عند الحاجة وpgTAP.
4. استخدم `security definer` بحذر: `search_path` صريح، فحص `auth.uid()`، وGRANT محدود.
5. شغّل `pnpm db:reset` فقط على قاعدة محلية آمنة، ثم `pnpm db:types`.
6. راجع التغير الناتج في `types/database.types.ts`.
7. شغّل `pnpm db:test` و`pnpm check:rls`، ثم اختبارات التطبيق المتأثرة.

### بيانات المصحف

- المستورد في `quran_*` مرجع داخلي فقط.
- لا تلمس المصدر أو checksum أو صلاحيات الكتابة من أجل حل UI سريع.
- عند الحاجة للمعلومة في الواجهة، اعرض metadata المسموح بها فقط.

---

## 15. التقارير وPDF والملفات

- التقارير والفواتير والشهادات والاختبارات لها APIs PDF تحت `app/api/pdf/`.
- الإنتاج يعتمد Chromium المخفف؛ `CHROMIUM_PACK_URL` مطلوب في الإنتاج، وليس عادة في `pnpm dev`.
- مراجع القرار في `docs/adr/ADR-004-pdf-engine.md`.
- اختبارات PDF تستخدم fixture وفحص حجم A4، النص، الخطوط وQR.
- لا تضع بيانات طالب حقيقية في fixtures أو screenshots أو ملفات عامة.

### النسخ الاحتياطي والاستعادة

`scripts/database-backup.mjs` ينشئ dump مشفرًا بـ AES-256-GCM مع manifest SHA-256. الاستعادة محصورة في staging drill، وترفض production URL.

راجع `docs/runbooks/BACKUP_RESTORE.md` بالكامل قبل تشغيل النسخ أو الاستعادة. الاستعادة عملية مدمرة ولا تنفذ دون موافقة صريحة على البيئة الهدف.

---

## 16. النشر والتشغيل المستضاف

المسار المخطط له هو **Vercel + Supabase مستضاف** مع Chromium مخفف في بيئة عديمة الحالة. ليس معنى وجود الإعداد أن النشر أو الأسرار مكتملة.

قبل أي نشر، راجع:

- `docs/runbooks/DEPLOYMENT.md`
- `docs/runbooks/PERFORMANCE.md`
- `docs/runbooks/ACCESSIBILITY.md`
- `docs/PROJECT_STATUS.md`
- الأسرار في مزود الاستضافة، خارج Git.

أهداف الأداء المذكورة في runbook: Performance >= 90، LCP <= 2.5s، CLS <= 0.1، TBT <= 300ms للصفحات المحددة. لا تدّعِ نشرًا أو قبولًا قانونيًا أو اختبار قارئ شاشة يدويًا ما لم يُنفذ ويوثق فعلًا.

---

## 17. Git والعمل عبر جهازين

- `main` للمحطات المكتملة والمختبرة فقط.
- العمل الناقص يكون في `work/<task-id>-<short-name>`.
- كاتب واحد لكل branch/مهمة؛ لا تدمج تغييرات جهاز آخر تلقائيًا.
- قبل العمل المعتاد: `git fetch --prune`، ثم راجع `docs/PROJECT_STATUS.md` و`git status`.
- لا تستخدم `git reset --hard` أو force push أو إعادة كتابة التاريخ.
- لا تعدّل ملفات مستخدم موجودة أو تمسح تغييرات غير معروفة.
- في هذه الفترة تحديدًا: **لا commit ولا push بلا أمر صريح من المالك**.

عند نقل العمل لجهاز آخر، أفضل تسليم هو:

1. clone نظيف من remote أو نسخ المشروع مع `.git`.
2. نقل أي تغييرات غير ملتزم بها كـ patch موثق أو عبر مجلد منفصل، لا بالاعتماد على الذاكرة.
3. بناء `node_modules` وSupabase محليًا من جديد.
4. قراءة `docs/PROJECT_STATUS.md` وهذا الدليل ثم تنفيذ فحص `git status`.

---

## 18. نقاط حساسة وأخطاء شائعة

| لا تفعل                                        | افعل بدلًا من ذلك                            |
| ---------------------------------------------- | -------------------------------------------- |
| لا تضع نصوصًا عربية/إنجليزية ثابتة داخل JSX.   | أضف مفتاحًا في ملفي الرسائل واستعمل الترجمة. |
| لا تستخدم `Date` الخام أو offsets.             | استعمل `lib/time` وLuxon + IANA.             |
| لا تحسب مالًا بـ `number`.                     | استعمل `lib/money` و`decimal.js`.            |
| لا تستورد `admin.ts` في عميل أو component.     | استخدم server client وRPC/Action مؤمن.       |
| لا تعدّل مهاجرة موجودة أو قاعدة مشتركة يدويًا. | أضف مهاجرة جديدة واختبارات.                  |
| لا تجعل الواجهة مصدر الصلاحية.                 | طبّق RLS/RPC/demanded role check.            |
| لا تضف شاشة دردشة أو زر "راسل المدرس".         | استخدم التقارير والواجبات والقنوات الرسمية.  |
| لا تعرض آيات في الخريطة أو PDF.                | اعرض رقم/اسم السورة/الصفحة فقط.              |
| لا تنفذ `db:reset` أو restore بلا موافقة.      | تحقق من البيئة والبيانات أولًا.              |
| لا تدّعِ اختبارًا لم يجرِ.                     | سجّل الأمر والنتيجة أو سبب المنع.            |

---

## 19. قائمة تسليم مهمة جديدة

قبل اعتبار أي تغيير جاهزًا:

- [ ] قُرئت القواعد والحالة والمواصفة ذات الصلة.
- [ ] فُحصت المشكلة على الكود/الواجهة الحالية ولم تُفترض من تقرير قديم فقط.
- [ ] لم تُمس تغييرات محلية تخص شخصًا آخر.
- [ ] لا أسرار أو بيانات شخصية حقيقية أو نص آيات في الكود/الاختبارات/الرد.
- [ ] النصوص مترجمة بالعربية والإنجليزية، وCSS منطقي RTL/LTR.
- [ ] الصلاحيات وRLS وZod محفوظة أو حُدثت مع الاختبارات اللازمة.
- [ ] توجد حالة فارغة وخطأ مفهوم وإعادة محاولة حيث يلزم.
- [ ] اختُبر الهاتف والكمبيوتر حسب أثر التغيير.
- [ ] شُغلت الاختبارات المناسبة وسُجلت نتيجتها الحقيقية.
- [ ] حُدث `docs/PROJECT_STATUS.md` إن كانت المهمة مرحلة فعلية أو نقطة استئناف.
- [ ] لم يحدث commit أو push إلا بإذن صريح من المالك.

---

## 20. مصادر مفيدة داخل المستودع

- `docs/PROJECT_STATUS.md`: سجل الواقع ونقطة المتابعة.
- `docs/COMPLETE_MANUAL_UAT_CHECKLIST.md`: UAT يدوي شامل.
- `docs/audits/`: نتائج تدقيق UX/وظائف سابقة؛ تحقق من الكود الحديث قبل تنفيذ بند منها.
- `docs/adr/`: لماذا اتخذت القرارات التقنية الأساسية.
- `docs/runbooks/`: التشغيل، النشر، الأداء، الوصول والنسخ الاحتياطي.
- `specs/001-noor-alwahy/`: المصدر التفصيلي للمتطلبات وقبول المراحل.
- `tests/`: الدليل التنفيذي للسلوك المتوقع.

---

## 21. ملخص تنفيذي قصير جدًا للـPrompt

```text
Noor Al-Wahy is a bilingual (Arabic RTL / English LTR) Next.js 16 + React 19 + TypeScript
academy-management system backed by Supabase/Postgres. It has admin, teacher, student, and
parent portals. Treat Supabase migrations and RLS as the source of truth for authorization.
Use Zod at boundaries, Luxon/IANA for time, decimal.js for money, and next-intl for every visible
string. Never expose the service-role key, never add teacher-family messaging, never display Quran
verse text, and never add runtime AI integrations. Read AGENTS.md, the constitution, PROJECT_STATUS,
and this handoff before changing code. Preserve dirty worktree changes and do not commit or push
unless the owner explicitly requests it.
```
