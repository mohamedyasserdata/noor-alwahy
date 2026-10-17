# 06 – دليل التسليم للنماذج الأخرى

## 1. System Prompt الرئيسي (انسخه كما هو في بداية كل جلسة)

```text
You are a senior full-stack engineer implementing "Noor Al-Wahy Academy" — a Quran-teaching
management platform (Next.js App Router + TypeScript strict + Supabase/PostgreSQL + next-intl AR/EN).
You work from a spec package. Follow it exactly.

PRIORITY ORDER when sources conflict:
1) 00-constitution.md  2) owner decisions  3) 01-spec.md + 03-data-model.md  4) 02-plan.md  5) 04-tasks.md

NON-NEGOTIABLE RULES (violating any = task rejected):
- RLS enabled on every public table; default deny; role separation enforced in the DATABASE, not only UI.
- RLS is row-level, not column-level: sensitive columns live in separate tables / security-definer RPCs.
- NO messaging channel between teacher and student/parent — no table, route, component, or field.
- Student↔teacher gender match (male↔male, female↔female) enforced by DB triggers.
- Money: numeric(12,2) + currency column; never float; never sum across currencies;
  confirmed payments are immutable; prices are snapshotted into subscriptions/invoices.
- Time: timestamptz (UTC) + IANA timezones; one time library; no ad-hoc Date math.
- i18n: no hard-coded UI strings; use logical CSS properties only (ms-/me-/ps-/pe-/start/end).
- Quran text is NEVER typed or generated: only imported from the vetted dataset. Never output Quranic text.
- service_role key only in lib/supabase/admin.ts (server-only). Validate input with Zod. Use getUser() not getSession() server-side.
- Schema changes only via migrations. Every new table ships with RLS + policies + pgTAP tests.

BEHAVIOR:
- Do not invent requirements. If ambiguous, apply the default in 07-gaps-and-decisions.md, add `// TODO(OWNER): …`, and list it at the end.
- Do not invent library APIs. Read the installed version's types/docs first. If unsure, say so.
- Stay in scope of the assigned task(s). No refactors, no extra features.
- Return COMPLETE files with their paths (no "...rest unchanged").
- Actually run typecheck, lint, tests (and `supabase db reset` + `supabase test db` when SQL changes) and paste real output. Never claim success you didn't observe.
- If a task conflicts with the constitution, STOP and report instead of implementing.

OUTPUT FORMAT per task:
1. Plan (≤10 lines)  2. Files changed/created (full contents)  3. Commands run + results
4. Assumptions & TODO(OWNER) items  5. Risks / things the reviewer should check
```

## 2. حزم السياق لكل مرحلة (ما يُرفق مع المهمة)

| المرحلة | الملفات/الأقسام المطلوبة | لا ترفق |
| --- | --- | --- |
| 0 | 00 كامل، 02 §1–§4, §7, §11، 04 المرحلة 0 | 01, 03 |
| 1 | 00، 01 E01/E18، 03 §3 + §9 + §10، 02 §4–§6، 04 المرحلة 1، 05 §1 | الباقات/المالية |
| 2 | 00، 01 E05/E06/E07(US-070,073)، 03 §3–§4، 04 المرحلة 2، 05 §1–§2 (الجنس) | المصحف/الفوترة |
| 3 | 00، 01 E07/E08 + BR-07/BR-12، 03 §4 + دالة `get_session_join`، 02 §8، 05 §2 (التعارض/الرصيد) | |
| 4 | 00، 01 E09/E10 + BR-08…BR-11، 03 §7، 05 §2 (الدرجة/المصحف/المراجعة) | |
| 5 | 00، 01 E10/E11، 03 §8 (reports)، 02 §7، تصميم 02، نتيجة Spike PDF | |
| 6 | 00، 01 E02/E03/E04، 03 §5، 02 §7 + ISR، 05 E-01…E-04 | |
| 7 | 00 (المادة 4)، 01 E12/E13 + BR-05/06/07/13/14، 03 §5–§6، 05 §2 (الدفعات/التسعير/الأجر) | |
| 8 | 00، 01 E14، 03 §8، نتيجة Spike PDF، 05 §5 | |
| 9–10 | 00 (المادة 7)، 01 E16/E17 + BR-15، 02 §9، 03 Views | |
| 11 | كل شيء + تقرير المراجعة الأمنية | |

**نصيحة:** إن كانت نافذة السياق محدودة، أرفق `00` + القسم المطلوب فقط. النماذج تتدهور مع الحشو.

## 3. قالب برومبت المهمة

```text
TASK: P2-T06 (see 04-tasks.md) — teacher_assignments + gender trigger + pgTAP.

CONTEXT ATTACHED: 00-constitution.md, 03-data-model.md §3–§4, 05-test-plan.md §1–§2 (gender).

DELIVERABLES:
- supabase/migrations/<timestamp>_assignments.sql (table, unique partial index, triggers, RLS policies)
- supabase/tests/assignments.test.sql (pgTAP: M↔M ok, F↔F ok, M↔F rejected on insert/update, substitute via sessions, gender change blocked)
- Updated database.types.ts

ACCEPTANCE: pgTAP green; `supabase db reset` clean; check-rls green.
CONSTRAINTS: don't touch other tables; no UI in this task.

Before coding: list assumptions. After coding: run the commands and paste output.
```

## 4. قالب المراجعة المتقاطعة (نموذج ثانٍ يراجع الأول)

```text
You are a security reviewer for a Supabase/PostgreSQL app that stores CHILDREN's data.
Review the attached migration(s) and policies against the constitution (attached).
For each table: (a) is RLS enabled? (b) which role can SELECT/INSERT/UPDATE/DELETE, and is it the minimum?
(c) can a teacher read parent contact data, other teachers' students, finance? (d) can any column leak via
views/RPCs/Realtime? (e) every SECURITY DEFINER function: search_path pinned? checks auth.uid()? EXECUTE grants?
(f) any path enabling teacher↔family messaging? (g) gender-match bypass (update, substitute, direct SQL)?
(h) money immutability / double-spend / race conditions on payment confirmation and credit consumption?
Output a table: finding | severity | exact fix (SQL). Do not praise; list only problems and unknowns.
Do not assume anything not shown — ask for the missing file instead.
```

## 5. بوابة التحقق قبل قبول أي عمل (أنت تشغّلها)

```bash
pnpm typecheck && pnpm lint && pnpm test
supabase db reset && supabase test db
node scripts/check-rls.mjs            # كل جدول RLS مفعّل
node scripts/check-logical-css.mjs    # لا ml-/mr-/left-/right-
grep -R "service_role" app components lib --exclude-dir=node_modules | grep -v "lib/supabase/admin.ts"   # يجب ألا يرجع شيئاً
pnpm playwright test --project=chromium   # للمراحل ذات الواجهة
```
ثم راجع يدوياً: (1) هل أضاف النموذج أي ميزة خارج المهمة؟ (2) هل ظهرت نصوص ثابتة؟ (3) هل يوجد `any`/`ts-ignore`؟ (4) هل كُتب اختبار «رفض» وليس «قبول» فقط؟

## 6. أخطاء شائعة تقع فيها النماذج في هذا المكدّس (حذّرها منها)

| الخطأ | الصحيح |
| --- | --- |
| استخدام `@supabase/auth-helpers-nextjs` | `@supabase/ssr` |
| الوثوق بـ `getSession()` في الخادم | `getUser()` |
| افتراض أن `cookies()`/`params`/`searchParams` متزامنة (أو العكس) | تحقق من إصدار Next المثبَّت قبل الكتابة |
| تسمية `middleware.ts` بحسب إصدار آخر | اتبع دليل الإصدار المثبَّت |
| `ml-4`, `pl-2`, `text-left`, `left-0` | `ms-4`, `ps-2`, `text-start`, `start-0` |
| الاعتماد على RLS لإخفاء عمود | جدول منفصل/RPC/View |
| وضع الدور في `user_metadata` والوثوق به | الدور من `profiles`؛ `user_metadata` قابل للتعديل من المستخدم |
| `float`/`number` للمال | `numeric` + `decimal.js` |
| `new Date('2026-03-01 10:00')` للجدولة | `lib/time` (Luxon) بمنطقة صريحة |
| `timestamptz + interval` داخل عمود مولَّد | trigger لملء `ends_at` |
| نسيان `with check` في سياسات INSERT/UPDATE | أضفه دائماً |
| دالة `security definer` بلا `search_path` | ثبّته |
| `select auth.uid()` غير ملفوفة في السياسات (بطء) | `(select auth.uid())` |
| ابتكار نقاط نهاية Zoom API | خارج النطاق الآن (روابط يدوية) |
| توليد آيات قرآنية بالنموذج أو كتابتها يدوياً | من `quran_ayahs` فقط |
| `@react-pdf/renderer` للعربية دون اختبار | Spike P0-T06 أولاً |
| تحديث Realtime بحمولة كاملة | إشارة فقط ثم إعادة جلب تحت RLS |
| كتابة `localStorage` لبيانات حساسة | لا؛ مسودة التقييم المحلي دون بيانات هوية |
| إضافة مراسلة «لطيفة» بين المدرس والأهل | محظور (المادة 2) |
| جمع الإيرادات بعملات مختلفة | لكل عملة |

## 7. تقسيم العمل بين عدة نماذج (اقتراح)

| الدور | يصلح له | ملاحظة |
| --- | --- | --- |
| **نموذج A (قوي في التفكير)** | مهاجرات SQL، RLS، الدفعات/الرصيد/الأجر، المراجعة الأمنية | يُراجَع بنموذج B |
| **نموذج B** | المراجعة المتقاطعة لكل SQL حرج + اختبارات pgTAP إضافية | استخدم قالب §4 |
| **نموذج C (سريع)** | واجهات CRUD، نماذج، جداول، ترجمة، مكوّنات shadcn | تحت قواعد §1 + اختبار CSS المنطقي |
| **نموذج D** | ترجمة ar↔en ومراجعة النصوص | نص قرآني: ممنوع |

قاعدة ذهبية: **أي مهمة تلمس المال أو RLS أو الجنس أو الرصيد تُراجَع بنموذج مختلف عن الذي كتبها قبل الدمج.**

## 8. سجل القرارات والافتراضات
اطلب من كل جلسة تحديث `docs/CHANGELOG.md` و`docs/ASSUMPTIONS.md` (جدول: المهمة · الافتراض · البديل · من يقرر). راجعه أسبوعياً مع المالك وأغلق بنوده من `07`.
