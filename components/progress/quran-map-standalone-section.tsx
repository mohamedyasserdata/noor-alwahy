import { ArrowLeft, ArrowRight, Map } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { QuranMap } from "@/components/progress/quran-map";
import { StudentPageShell } from "@/components/student/student-page-shell";
import type { AppLocale } from "@/i18n/routing";
import { getStudentQuranMap } from "@/lib/progress/quran-map";

export async function QuranMapStandaloneSection({ locale }: { locale: AppLocale }) {
  const [t, data] = await Promise.all([
    getTranslations({ locale, namespace: "quranMap" }),
    getStudentQuranMap(),
  ]);
  const Arrow = locale === "ar" ? ArrowRight : ArrowLeft;

  return (
    <StudentPageShell
      locale={locale}
      eyebrow={t("mapPageEyebrow")}
      title={t("mapPageTitle")}
      description={t("mapPageDescription")}
      titleId="quran-map-page-title"
      icon={Map}
      compact
    >
      <section className="mx-auto w-full max-w-[94rem]" aria-labelledby="quran-map-page-title">
        <Link
          href={`/${locale}/student/progress`}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#e1c999] bg-card px-4 text-sm font-black text-primary hover:bg-[#fff8e9] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none dark:hover:bg-muted"
        >
          <Arrow className="size-4" aria-hidden="true" />
          {t("backToProgress")}
        </Link>
        <QuranMap
          locale={locale}
          studentId={data.studentId}
          pages={data.pages}
          surahs={data.surahs}
          initialProgress={data.progress}
        />
      </section>
    </StudentPageShell>
  );
}
