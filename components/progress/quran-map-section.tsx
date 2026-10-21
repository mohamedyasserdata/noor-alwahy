import { getTranslations } from "next-intl/server";

import { MemorizationPlanCard } from "@/components/progress/memorization-plan-card";
import { QuranMap } from "@/components/progress/quran-map";
import type { AppLocale } from "@/i18n/routing";
import { getStudentMemorizationPlan } from "@/lib/progress/memorization-plans";
import { getStudentQuranMap } from "@/lib/progress/quran-map";

export async function QuranMapSection({ locale }: { locale: AppLocale }) {
  const [t, planT, data, plan] = await Promise.all([
    getTranslations({ locale, namespace: "quranMap" }),
    getTranslations({ locale, namespace: "memorizationPlan" }),
    getStudentQuranMap(),
    getStudentMemorizationPlan(),
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

      <MemorizationPlanCard
        locale={locale}
        plan={plan}
        copy={{
          title: planT("student.title"),
          description: planT("student.description"),
          empty: planT("student.empty"),
          weekly: planT("weekly"),
          monthly: planT("monthly"),
          achieved: (achieved, target) => planT("student.achieved", { achieved, target }),
          period: (start, end) => planT("student.period", { start, end }),
          openEnded: planT("student.openEnded"),
        }}
      />

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
