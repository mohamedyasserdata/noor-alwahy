import { ArrowLeft, ArrowRight, BookOpen, CheckCircle2, RotateCcw } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { StudentPageShell } from "@/components/student/student-page-shell";
import type { AppLocale } from "@/i18n/routing";
import { getStudentQuranMap } from "@/lib/progress/quran-map";
import { cn } from "@/lib/utils";

export async function QuranSurahDetail({
  locale,
  surahId,
}: {
  locale: AppLocale;
  surahId: number;
}) {
  const [t, data] = await Promise.all([
    getTranslations({ locale, namespace: "quranMap" }),
    getStudentQuranMap(),
  ]);
  const surah = data.surahs.find((item) => item.id === surahId);
  if (!surah) return null;

  const pages = data.pages.filter(
    (page) => page.firstSurahId <= surahId && page.lastSurahId >= surahId,
  );
  const progressByPage = new Map(data.progress.map((item) => [item.page, item]));
  const started = pages.filter((page) => {
    const status = progressByPage.get(page.page)?.status;
    return status && status !== "not_started";
  }).length;
  const mastered = pages.filter(
    (page) => progressByPage.get(page.page)?.status === "mastered",
  ).length;
  const review = pages.filter(
    (page) => progressByPage.get(page.page)?.status === "needs_review",
  ).length;
  const percent = pages.length ? Math.round((mastered / pages.length) * 100) : 0;
  const numberFormat = new Intl.NumberFormat(locale);
  const Arrow = locale === "ar" ? ArrowRight : ArrowLeft;
  const surahName = locale === "ar" ? surah.name_ar : surah.name_en;

  return (
    <StudentPageShell
      locale={locale}
      eyebrow={t("surahDetail.eyebrow")}
      title={surahName}
      description={t("surahDetail.description", { count: numberFormat.format(pages.length) })}
      titleId="surah-detail-title"
      icon={BookOpen}
      compact
    >
      <section className="mx-auto w-full max-w-6xl" aria-labelledby="surah-detail-title">
        <Link
          href={`/${locale}/student/progress/quran-map`}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#e1c999] bg-card px-4 text-sm font-black text-primary hover:bg-[#fff8e9] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none dark:hover:bg-muted"
        >
          <Arrow className="size-4" aria-hidden="true" />
          {t("surahDetail.back")}
        </Link>

        <div className="mt-5 grid gap-5 lg:grid-cols-[19rem_minmax(0,1fr)] lg:items-start">
          <aside className="rounded-[1.75rem] border border-[#dec28b] bg-[#102d58] p-5 text-white shadow-[0_18px_45px_rgba(16,45,88,0.14)] lg:sticky lg:top-24">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-bold text-[#f2cf7e]">{t("surahDetail.mastery")}</p>
                <p className="mt-1 text-4xl font-black tabular-nums">
                  {numberFormat.format(percent)}%
                </p>
              </div>
              <span className="grid size-14 place-items-center rounded-2xl bg-white/10 text-2xl font-black text-[#f2cf7e]">
                {numberFormat.format(surah.id)}
              </span>
            </div>
            <div className="mt-5 h-2.5 overflow-hidden rounded-full bg-white/12">
              <div className="h-full rounded-full bg-[#d4a943]" style={{ width: `${percent}%` }} />
            </div>
            <dl className="mt-5 divide-y divide-white/12 border-t border-white/12">
              <Metric label={t("surahDetail.pages")} value={pages.length} format={numberFormat} />
              <Metric label={t("surahDetail.completed")} value={started} format={numberFormat} />
              <Metric
                label={t("surahDetail.masteredPages")}
                value={mastered}
                format={numberFormat}
              />
              <Metric
                label={t("surahDetail.reviewPages")}
                value={review}
                format={numberFormat}
                warning={review > 0}
              />
            </dl>
          </aside>

          <section className="overflow-hidden rounded-[1.75rem] border bg-card shadow-[0_16px_45px_rgba(16,45,88,0.08)]">
            <header className="border-b px-4 py-5 sm:px-6">
              <h2 className="text-xl font-black text-primary">
                {t("surahDetail.pageStatusTitle")}
              </h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                {t("surahDetail.pageStatusDescription")}
              </p>
            </header>
            <ol className="divide-y">
              {pages.map((page) => {
                const item = progressByPage.get(page.page);
                const status = item?.status ?? "not_started";
                return (
                  <li
                    key={page.page}
                    className="grid gap-3 px-4 py-4 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center sm:px-6"
                  >
                    <span
                      className={cn(
                        "grid size-11 place-items-center rounded-2xl border text-sm font-black tabular-nums",
                        statusStyle(status),
                      )}
                    >
                      {numberFormat.format(page.page)}
                    </span>
                    <div>
                      <p className="font-black text-primary">
                        {t("surahDetail.page", { page: numberFormat.format(page.page) })}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {t("surahDetail.juz", { juz: numberFormat.format(page.juz) })}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                      <span
                        className={cn(
                          "inline-flex min-h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-black",
                          statusStyle(status),
                        )}
                      >
                        {status === "needs_review" ? (
                          <RotateCcw className="size-3.5" aria-hidden="true" />
                        ) : status === "mastered" ? (
                          <CheckCircle2 className="size-3.5" aria-hidden="true" />
                        ) : null}
                        {t(`statuses.${status}`)}
                      </span>
                      {item?.avg_score !== null && item?.avg_score !== undefined ? (
                        <span className="rounded-full bg-muted px-3 py-1.5 text-xs font-bold text-primary">
                          {t("score", { score: item.avg_score })}
                        </span>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>
        </div>
      </section>
    </StudentPageShell>
  );
}

function Metric({
  label,
  value,
  format,
  warning = false,
}: {
  label: string;
  value: number;
  format: Intl.NumberFormat;
  warning?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 text-sm">
      <dt className="text-white/70">{label}</dt>
      <dd className={cn("font-black text-[#f3d07f] tabular-nums", warning && "text-[#ffca78]")}>
        {format.format(value)}
      </dd>
    </div>
  );
}

function statusStyle(status: "mastered" | "needs_review" | "in_progress" | "not_started") {
  if (status === "mastered") return "border-success/35 bg-success/12 text-success";
  if (status === "needs_review") return "border-warning/35 bg-warning/12 text-warning";
  if (status === "in_progress")
    return "border-[#d2a544] bg-[#fff3d8] text-[#8a5a00] dark:bg-[#4b3715] dark:text-[#f3cb73]";
  return "border-border bg-muted/40 text-muted-foreground";
}
