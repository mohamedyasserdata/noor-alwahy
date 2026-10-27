import {
  ArrowLeft,
  BookOpenCheck,
  CalendarDays,
  GraduationCap,
  LogIn,
  Monitor,
} from "lucide-react";

import { PublicHomeContent } from "@/components/public-site/public-home-content";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";

const copy = {
  ar: {
    eyebrow: "أكاديمية نور الوحي لتحفيظ القرآن الكريم",
    title: "رحلة قرآنية ملهمة",
    accent: "تبدأ من هنا",
    description:
      "تعلّم القرآن الكريم مع نخبة من المعلمين والمعلمات، في بيئة تعليمية آمنة ومرنة تناسب جميع الأعمار",
    apply: "ابدأ الآن",
    login: "تسجيل الدخول",
    imageLabel: "مصحف وفانوس في رحاب مسجد مضاء",
    features: [
      ["معلمون متخصصون", "نخبة من المعلمين والمعلمات"],
      ["تعليم عن بُعد", "من أي مكان في العالم"],
      ["مناهج منظمة", "مسارات واضحة ومتدرجة"],
      ["مواعيد مرنة", "حصص تناسب وقت الطالب"],
    ],
  },
  en: {
    eyebrow: "Noor Al-Wahy Quran Academy",
    title: "An inspiring Quran journey",
    accent: "begins right here",
    description:
      "Learn the Quran with a select team of qualified teachers in a safe, flexible environment for every age.",
    apply: "Start now",
    login: "Sign in",
    imageLabel: "A Quran and lantern in a sunlit mosque",
    features: [
      ["Specialist teachers", "A carefully selected teaching team"],
      ["Online learning", "Join from anywhere in the world"],
      ["Structured curricula", "Clear and progressive learning tracks"],
      ["Flexible schedules", "Lessons that fit the student’s time"],
    ],
  },
} as const;

const featureIcons = [GraduationCap, Monitor, BookOpenCheck, CalendarDays] as const;

export function PublicHomeHero({ locale }: { locale: AppLocale }) {
  const text = copy[locale];

  return (
    <>
      <section
        className="relative isolate -mt-[5.7rem] min-h-[47rem] overflow-hidden rounded-b-[2.75rem] bg-[#d9ae63] bg-[url('/images/public/noor-home-hero.png')] bg-cover bg-[68%_center] pt-[8.2rem] sm:min-h-[50rem] sm:bg-[72%_center] sm:pt-[9rem] lg:min-h-[46rem] lg:bg-center"
        aria-label={text.imageLabel}
      >
        <div className="absolute inset-0 -z-10 bg-[#07152b]/38 sm:bg-linear-to-r sm:from-[#fffaf0]/96 sm:via-[#fff9eb]/72 sm:to-transparent rtl:sm:bg-linear-to-l dark:bg-[#07152b]/58 dark:sm:from-[#07152b]/96 dark:sm:via-[#07152b]/70 dark:sm:to-transparent" />
        <div className="absolute inset-0 -z-10 bg-linear-to-b from-transparent via-transparent to-[#0b1930]/22" />
        <div
          className="islamic-pattern absolute inset-y-0 start-0 -z-10 w-[62%] opacity-[0.14]"
          aria-hidden="true"
        />

        <div
          className="mx-auto grid min-h-[35rem] max-w-[90rem] items-center px-5 pb-64 sm:px-8 sm:pb-52 lg:grid-cols-2 lg:px-12 lg:pb-36"
          dir="ltr"
        >
          <div
            data-testid="public-home-hero-copy"
            className={`w-full max-w-[38rem] p-1 text-start sm:p-0 ${
              locale === "ar"
                ? "justify-self-end lg:col-start-2"
                : "justify-self-start lg:col-start-1"
            }`}
            dir={locale === "ar" ? "rtl" : "ltr"}
          >
            <p className="text-sm font-black tracking-wide text-[#e5bc65] sm:text-base sm:text-[#a97019]">
              {text.eyebrow}
            </p>
            <h1 className="mt-4 text-4xl leading-[1.18] font-black text-[#fffaf0] sm:text-6xl sm:text-[#101f3b] lg:text-[4.35rem] dark:text-[#fffaf0]">
              <span className="block">{text.title}</span>
              <span className="mt-1 block text-[#af7721]">{text.accent}</span>
            </h1>
            <p className="mt-6 max-w-[36rem] text-base leading-8 font-medium text-[#fffaf0]/88 sm:text-xl sm:leading-9 sm:text-[#31415d] dark:text-[#f5f0e6]/80">
              {text.description}
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button
                asChild
                size="lg"
                variant="gold"
                className="min-h-14 rounded-xl px-8 text-base shadow-[0_14px_34px_rgba(176,119,33,.25)]"
              >
                <Link href="/apply">
                  {text.apply}
                  <ArrowLeft className="rtl:-scale-x-100" aria-hidden="true" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="min-h-14 rounded-xl border-white/55 bg-[#101f3b]/88 px-8 text-base text-white backdrop-blur hover:bg-[#101f3b] sm:border-[#b47a24]/55 sm:bg-[#fffdf8]/72 sm:text-[#101f3b] sm:hover:bg-white dark:text-[#f5f0e6]"
              >
                <Link href="/auth/login">
                  {text.login}
                  <LogIn aria-hidden="true" />
                </Link>
              </Button>
            </div>
          </div>
        </div>

        <div className="absolute inset-x-0 bottom-0 translate-y-px px-3 sm:px-6">
          <div
            data-testid="public-hero-features"
            className="mx-auto grid max-w-[84rem] grid-cols-2 overflow-hidden rounded-t-[2rem] border border-[#c7a45a]/25 bg-[#fffdf9]/96 shadow-[0_-10px_45px_rgba(16,31,59,.12)] backdrop-blur-md lg:grid-cols-4 dark:bg-[#0c1b33]/96"
          >
            {text.features.map(([title, description], index) => {
              const Icon = featureIcons[index]!;
              return (
                <article
                  key={title}
                  className="flex min-h-32 flex-col items-center justify-center gap-2 border-[#c7a45a]/20 p-3 text-center odd:border-e nth-[n+3]:border-t sm:min-h-28 sm:flex-row sm:justify-start sm:gap-4 sm:p-5 sm:text-start lg:border-e-0 lg:border-t-0 lg:not-last:border-e"
                >
                  <span className="grid size-12 shrink-0 place-items-center rounded-full border border-[#c7a45a]/25 bg-[#fbf1dc] text-[#101f3b] sm:size-14 dark:bg-[#182944] dark:text-[#e4c070]">
                    <Icon className="size-6 sm:size-7" strokeWidth={1.8} aria-hidden="true" />
                  </span>
                  <div>
                    <h2 className="text-sm font-black text-[#101f3b] sm:text-base dark:text-[#fffaf0]">
                      {title}
                    </h2>
                    <p className="mt-1 text-xs leading-5 text-[#64708a] sm:text-sm sm:leading-6 dark:text-[#f5f0e6]/65">
                      {description}
                    </p>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <PublicHomeContent locale={locale} />
    </>
  );
}
