import { getTranslations } from "next-intl/server";

import { QuranMap } from "@/components/progress/quran-map";
import { StudentPlanCard } from "@/components/progress/student-plan-card";
import { StudentProgressDashboard } from "@/components/progress/student-progress-dashboard";
import type { AppLocale } from "@/i18n/routing";
import { getStudentQuranMap } from "@/lib/progress/quran-map";
import { getStudentProgressDashboard } from "@/lib/progress/dashboard";
import { getStudentMemorizationPlan } from "@/lib/memorization-plans/queries";

export async function QuranMapSection({ locale }: { locale: AppLocale }) {
  const [t, data, plan, dashboard] = await Promise.all([
    getTranslations({ locale, namespace: "quranMap" }),
    getStudentQuranMap(),
    getStudentMemorizationPlan(),
    getStudentProgressDashboard(),
  ]);

  return (
    <section className="mx-auto w-full max-w-6xl" aria-labelledby="quran-map-title">
      <header className="max-w-3xl">
        <p className="mb-3 text-sm font-black text-secondary">{t("eyebrow")}</p>
        <h1
          id="quran-map-title"
          className="text-3xl font-black text-balance text-primary sm:text-4xl"
        >
          {t("title")}
        </h1>
        <p className="mt-4 leading-8 text-muted-foreground">
          {t("description", { name: data.studentName })}
        </p>
      </header>

      <StudentPlanCard locale={locale} plan={plan} />

      <StudentProgressDashboard locale={locale} data={dashboard} />

      <QuranMap
        locale={locale}
        studentId={data.studentId}
        pages={data.pages}
        surahs={data.surahs}
        initialProgress={data.progress}
      />
    </section>
  );
}
