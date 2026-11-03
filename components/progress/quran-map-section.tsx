import { ChartNoAxesCombined } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { StudentProgressOverview } from "@/components/progress/student-progress-overview";
import { StudentPageShell } from "@/components/student/student-page-shell";
import type { AppLocale } from "@/i18n/routing";
import { getStudentProgressOverview } from "@/lib/progress/student-progress-overview";

export async function QuranMapSection({
  locale,
  view = "summary",
}: {
  locale: AppLocale;
  view?: "summary" | "history" | "review";
}) {
  const [t, data] = await Promise.all([
    getTranslations({ locale, namespace: "quranMap" }),
    getStudentProgressOverview(),
  ]);

  return (
    <StudentPageShell
      locale={locale}
      eyebrow={t("eyebrow")}
      title={t("title")}
      description={t("description", { name: data.student.name })}
      titleId="quran-map-title"
      icon={ChartNoAxesCombined}
    >
      <section
        className="student-progress-page mx-auto w-full max-w-[94rem]"
        aria-label={t("title")}
      >
        <StudentProgressOverview locale={locale} data={data} view={view} />
      </section>
    </StudentPageShell>
  );
}
