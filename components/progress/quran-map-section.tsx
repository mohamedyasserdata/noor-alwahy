import { ChartNoAxesCombined } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { QuranMap } from "@/components/progress/quran-map";
import { StudentPlanCard } from "@/components/progress/student-plan-card";
import { StudentProgressDashboard } from "@/components/progress/student-progress-dashboard";
import { StudentPageShell } from "@/components/student/student-page-shell";
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
    <StudentPageShell
      locale={locale}
      eyebrow={t("eyebrow")}
      title={t("title")}
      description={t("description", { name: data.studentName })}
      titleId="quran-map-title"
      icon={ChartNoAxesCombined}
    >
      <section
        className="student-progress-page mx-auto w-full max-w-[94rem]"
        aria-label={t("title")}
      >
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
    </StudentPageShell>
  );
}
