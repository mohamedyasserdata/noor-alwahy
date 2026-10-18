# ADR-001: إصدارات الأساس المثبّتة

- **الحالة:** مقبول
- **التاريخ:** 2026-10-17
- **المهمة:** P0-T01، محدث في P0-T03 وP0-T04 وP0-T05 وP0-T06 وP0-T07

## القرار

تثبيت إصدارات يوم التأسيس بدقة في `package.json` و`pnpm-lock.yaml`، وعدم استخدام نطاقات
`^` أو `~` للاعتماديات المباشرة.

| الأداة                |                     الإصدار المثبّت | سبب الاختيار                                                           |
| --------------------- | ----------------------------------: | ---------------------------------------------------------------------- |
| Node.js               | `>=22.0.0` (بيئة التطوير `24.20.0`) | يحقق حد Supabase JS 2.118 ويدعم Next.js وESLint 10                     |
| pnpm                  |                           `11.25.0` | مدير الحزم المتاح والمثبت في البيئة                                    |
| Next.js               |                            `16.4.2` | أحدث إصدار مستقر عند التأسيس                                           |
| React / React DOM     |                            `19.3.0` | الإصدار الذي ثبّته منشئ Next.js 16.4.2                                 |
| TypeScript            |                             `5.9.3` | اختيار محافظ متوافق مع المنظومة الحالية؛ يؤجل TS 7 إلى ADR ترقية منفصل |
| ESLint                |                           `10.13.0` | مدعوم رسميًا في `eslint-config-next >=16.4` على Node الحالي            |
| Tailwind CSS          |                             `4.3.3` | إعداد CSS-first الرسمي الحالي                                          |
| next-intl             |                            `4.14.9` | واجهة التوجيه الحالية المتوافقة مع Next.js 16 و`next/root-params`      |
| @supabase/ssr         |                            `0.12.7` | إدارة جلسة Supabase الحالية عبر cookies في App Router                  |
| @supabase/supabase-js |                           `2.118.0` | SDK الحالي المثبت؛ يتطلب Node 22 فأعلى                                 |
| Supabase CLI          |                           `2.121.0` | init/start وتوليد الأنواع من المخطط المحلي                             |
| Zod                   |                             `4.6.7` | التحقق من متغيرات البيئة وحدود الإدخال                                 |
| server-only           |                             `0.0.1` | منع استيراد عميل الإدارة في حزمة المتصفح                               |
| @swc/core (override)  |                           `1.15.33` | حل مؤقت موثق لعطل تحميل native binding على Windows في سلسلة 1.16       |
| shadcn/ui             |                   مصدر مكوّنات محلي | لا توجد حزمة runtime؛ المكوّنات مملوكة للمشروع                         |
| Prettier              |                            `3.9.10` | تنسيق موحّد مع إضافة Tailwind                                          |
| Husky / lint-staged   |                  `9.1.7` / `17.6.0` | بوابة سريعة قبل الالتزام                                               |
| Vitest                |                             `5.0.5` | اختبارات الوحدة على Node 22.12 فأعلى                                   |
| Playwright Test       |                            `1.64.1` | smoke فعلي لـChromium مع webServer وتقارير الفشل                       |
| Gitleaks              |                            `8.30.1` | صورة Docker رسمية مثبتة لفحص أسرار تاريخ Git                           |
| @react-pdf/renderer   |                             `4.9.0` | اعتماد تطوير لمقارنة Spike؛ ليس محرك PDF المعتمد                       |
| qrcode                |                             `1.5.4` | إنشاء QR نفسه في محركي Spike                                           |
| jsQR / pngjs          |                   `1.4.0` / `7.0.0` | فك QR من PNG المطبوع آليًا وفحص المرجع البصري                          |
| Luxon                 |                             `3.7.2` | مكتبة الوقت الوحيدة وتحويل IANA/UTC مع كشف حالات DST                   |
| @types/luxon          |                             `3.7.6` | تعريفات TypeScript المطابقة لواجهة Luxon المستخدمة                     |

## ملاحظات التوافق

- Next.js 16 أزال `next lint`؛ السكربت يشغّل ESLint CLI مباشرة.
- رفع حد Node من 20.19 إلى 22 لأن `@supabase/supabase-js@2.118.0` واعتمادياته تعلن
  `engines.node >=22.0.0`؛ بيئة التطوير الفعلية 24.20.0.
- `params` و`searchParams` في App Router واجهات غير متزامنة عند استخدامها في الصفحات الديناميكية.
- Turbopack هو البنّاء الافتراضي. تم استبدال محمّل `@tailwindcss/turbopack` الذي ولّده
  `create-next-app` بتكامل `@tailwindcss/postcss` الرسمي بعد انهيار المحمّل على Windows أثناء
  `next build`؛ يظل Turbopack هو البنّاء، بينما يعالج PostCSS ملف Tailwind.
- تظهر تحذيرات peer لبعض إضافات ESLint التي لم تعلن دعم ESLint 10 بعد؛ وثائق Next.js 16.4
  تنص على أن هذا متوقع، ويُحسم القبول بنتيجة `pnpm lint` الفعلية.
- تستورد إضافة next-intl مترجم SWC عند تحميل إعداد Next.js. فشل `@swc/core` 1.16.x في
  تحميل الـnative binding من حامل مؤقت على Windows (`LoadLibraryExW failed`). لذلك يفرض
  `pnpm-workspace.yaml` الإصدار `1.15.33` مؤقتًا. يُزال هذا القيد فقط بعد ثبوت إصلاح المشكلة
  في إصدار SWC أحدث وبناء المشروع مرتين متتاليتين على Windows وCI.

## المصادر التي روجعت

- <https://nextjs.org/docs/app/getting-started/installation>
- <https://nextjs.org/docs/app/guides/upgrading/version-16>
- <https://nextjs.org/docs/app/api-reference/config/eslint>
- <https://tailwindcss.com/docs/installation/framework-guides/nextjs>
- <https://ui.shadcn.com/docs/installation/next>
- <https://next-intl.dev/docs/routing/setup>
- <https://next-intl.dev/docs/routing/middleware>
- <https://supabase.com/docs/guides/auth/server-side/creating-a-client>
- <https://supabase.com/docs/guides/local-development/cli/getting-started>
- <https://supabase.com/docs/guides/api/rest/generating-types>
- <https://supabase.com/docs/guides/getting-started/api-keys>
- <https://supabase.com/docs/guides/database/testing>
- <https://vitest.dev/guide/>
- <https://playwright.dev/docs/ci-intro>
- <https://playwright.dev/docs/test-webserver>
- <https://github.com/gitleaks/gitleaks>
- <https://github.com/swc-project/swc/issues/12442>
- <https://playwright.dev/docs/api/class-page#page-pdf>
- <https://react-pdf.org/fonts>
- <https://vercel.com/kb/guide/deploying-puppeteer-with-nextjs-on-vercel>
- <https://moment.github.io/luxon/api-docs/index.html>
- <https://github.com/moment/luxon/blob/master/docs/zones.md>

كما روجعت النسخ المحلية المطابقة داخل `node_modules/next/dist/docs/` قبل كتابة الكود.
