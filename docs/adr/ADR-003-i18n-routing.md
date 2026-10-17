# ADR-003: التوجيه ثنائي اللغة واتجاه الواجهة

- **الحالة:** مقبول
- **التاريخ:** 2026-10-17
- **المهمة:** P0-T03

## السياق

يجب أن تعمل كل واجهة بالعربية والإنجليزية من مسار صريح، وأن يكون `lang` و`dir` صحيحين
قبل الترطيب، مع إبقاء المسار ومعاملات الاستعلام عند تبديل اللغة. المشروع يستخدم Next.js
16.4 مع Cache Components؛ لذلك لا يصح الاعتماد على أنماط next-intl القديمة أو قراءة
معاملات الرابط في Client Component بلا حدّ Suspense.

## القرار

1. الجذر الفعلي للتطبيق هو `app/[locale]/layout.tsx`، واللغتان المدعومتان `ar` و`en` مع
   بادئة إلزامية و`ar` كلغة افتراضية.
2. يستعمل إعداد الطلب `next/root-params` و`getRequestConfig` الحاليين؛ لا يُستخدم
   `setRequestLocale` القديم.
3. تُجمع أدوات التنقل في `i18n/navigation.ts`، وتُحمّل الرسائل من `messages/{locale}.json`.
4. يستعمل Next.js 16 الملف `proxy.ts`. في P0-T04 صار تحديث جلسة Supabase يسبق إنشاء استجابة
   next-intl حتى يرى Server Component cookie المنعشة في الطلب نفسه، ثم تُلحق cookies وترويسات
   `private/no-store` باستجابة التوجيه دون إسقاط rewrite أو redirect.
5. مبدّل اللغة رابط حقيقي، يحفظ المسار وكل قيم query المتكررة، ولا ينفذ prefetch كي لا
   يغيّر cookie اللغة في الخلفية. الجزء الذي يقرأ `useSearchParams` داخل `Suspense`.
6. أي لغة غير مدعومة تنتهي بـ404، وكل فئات الاتجاه تستخدم خصائص Tailwind المنطقية.

## النتائج

- `/` يحوّل إلى اللغة المناسبة، ثم `/[locale]` يحوّل إلى مرجع الواجهة المحلي حاليًا.
- الصفحتان `/ar/dev/ui` و`/en/dev/ui` مولدتان مسبقًا، مع `rtl/ltr` صحيحين.
- إضافة Supabase يجب أن توسّع دالة `proxy` الحالية وتحافظ على rewrite/redirect/cookies.
- يمر `/api` بتحديث جلسة Supabase وترويسات منع التخزين، لكنه لا يمر بموجه next-intl.
- حارس `scripts/check-logical-css.mjs` جزء من `pnpm lint` ويمنع utilities وخصائص CSS
  الفيزيائية ذات الاتجاه.

## التحقق

- نجح بناء الإنتاج لـ`/ar` و`/en` وصفحتي مرجع الواجهة.
- نجح اختبار Playwright على 360px: لا overflow، أصغر هدف ظاهر 44px، وتبديل اللغة حفظ
  `?tag=a&tag=b&source=qa` كاملًا.
- أعاد المسار غير المدعوم HTTP 404، وسجل المتصفح للمسارات الصحيحة خالٍ من الأخطاء.

## المصادر

- <https://next-intl.dev/docs/routing/setup>
- <https://next-intl.dev/docs/routing/middleware>
- <https://next-intl.dev/docs/routing/navigation>
- وثائق Next.js 16.4 المحلية داخل `node_modules/next/dist/docs/`.
