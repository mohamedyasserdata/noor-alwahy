import type { AppLocale } from "@/i18n/routing";

export const publicFaqContent = {
  ar: [
    {
      question: "كيف أقدّم للطالب؟",
      answer:
        "افتح نموذج الالتحاق، وأدخل البيانات المطلوبة، ثم تراجع الإدارة الطلب وتتواصل عبر القنوات الرسمية.",
    },
    {
      question: "كيف يُحدد المستوى؟",
      answer: "تحدد الأكاديمية نقطة البداية المناسبة قبل اعتماد المسار والخطة التعليمية.",
    },
    {
      question: "كيف تُنظم الحصص؟",
      answer: "تظهر المواعيد في بوابة الطالب بالتوقيت المحلي مع أدوات التقويم المعتمدة.",
    },
    {
      question: "كيف يتابع ولي الأمر؟",
      answer: "تتيح بوابة ولي الأمر الاطلاع على البيانات المصرح بها للطلاب المرتبطين بحسابه.",
    },
    {
      question: "كيف تظهر الأسعار؟",
      answer: "اختر الدولة في قسم الباقات لعرض العملة والسعر الساري المسجل في النظام.",
    },
    {
      question: "كيف أحصل على شهادة؟",
      answer: "تظهر الشهادات في البوابة بعد إصدارها واعتمادها، ويمكن تنزيلها والتحقق منها.",
    },
  ],
  en: [
    {
      question: "How do I apply?",
      answer:
        "Open the application form, enter the required details, and the academy will review it and contact you through official channels.",
    },
    {
      question: "How is the level assessed?",
      answer:
        "The academy identifies the right starting point before confirming the track and learning plan.",
    },
    {
      question: "How are lessons organised?",
      answer:
        "Times appear in the student portal in the local timezone, alongside approved calendar tools.",
    },
    {
      question: "How can a parent follow progress?",
      answer:
        "The parent portal shows authorised information for students linked to the parent’s account.",
    },
    {
      question: "How are prices displayed?",
      answer:
        "Choose a country in the packages section to see the active system price and currency.",
    },
    {
      question: "How do certificates work?",
      answer: "Certificates appear after issue and approval, ready to download and verify.",
    },
  ],
} as const satisfies Record<AppLocale, ReadonlyArray<{ question: string; answer: string }>>;
