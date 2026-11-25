"use client";

import { BookOpen, ChevronLeft, ChevronRight, Search, Sparkles } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";

import type { AppLocale } from "@/i18n/routing";
import type { QuranMapPage, QuranMapProgress, QuranMapSurah } from "@/lib/progress/quran-map";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type Filter = "all" | "started" | "review" | "mastered";

export function QuranMap({
  locale,
  studentId,
  pages,
  surahs,
  initialProgress,
}: {
  locale: AppLocale;
  studentId: string;
  pages: QuranMapPage[];
  surahs: QuranMapSurah[];
  initialProgress: QuranMapProgress[];
}) {
  const t = useTranslations("quranMap");
  const supabase = useMemo(() => createClient(), []);
  const [progress, setProgress] = useState(initialProgress);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const numberFormat = useMemo(() => new Intl.NumberFormat(locale), [locale]);

  const refreshProgress = useCallback(async () => {
    const { data, error } = await supabase
      .from("memorization_progress")
      .select("page,status,first_memorized_at,last_reviewed_at,avg_score,review_count")
      .eq("student_id", studentId)
      .order("page");
    if (!error) setProgress(data);
  }, [studentId, supabase]);

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | undefined;
    void supabase.auth.getSession().then(({ data }) => {
      if (!data.session) return;
      supabase.realtime.setAuth(data.session.access_token);
      channel = supabase
        .channel(`quran-surah-map:${studentId}:${crypto.randomUUID()}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "memorization_progress",
            filter: `student_id=eq.${studentId}`,
          },
          () => void refreshProgress(),
        )
        .subscribe();
    });
    return () => {
      if (channel) void supabase.removeChannel(channel);
    };
  }, [refreshProgress, studentId, supabase]);

  const progressByPage = useMemo(
    () => new Map(progress.map((entry) => [entry.page, entry])),
    [progress],
  );
  const surahStats = useMemo(
    () =>
      surahs.map((surah) => {
        const surahPages = pages.filter(
          (page) => page.firstSurahId <= surah.id && page.lastSurahId >= surah.id,
        );
        let started = 0;
        let mastered = 0;
        let needsReview = 0;
        for (const page of surahPages) {
          const status = progressByPage.get(page.page)?.status;
          if (status && status !== "not_started") started += 1;
          if (status === "mastered") mastered += 1;
          if (status === "needs_review") needsReview += 1;
        }
        return {
          ...surah,
          firstPage: surahPages[0]?.page ?? 1,
          lastPage: surahPages.at(-1)?.page ?? 1,
          total: surahPages.length,
          started,
          mastered,
          needsReview,
          percent: surahPages.length ? Math.round((mastered / surahPages.length) * 100) : 0,
        };
      }),
    [pages, progressByPage, surahs],
  );

  const totals = useMemo(() => {
    let started = 0;
    let mastered = 0;
    let needsReview = 0;
    for (const page of pages) {
      const status = progressByPage.get(page.page)?.status;
      if (status && status !== "not_started") started += 1;
      if (status === "mastered") mastered += 1;
      if (status === "needs_review") needsReview += 1;
    }
    return { started, mastered, needsReview };
  }, [pages, progressByPage]);

  const visibleSurahs = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase(locale);
    return surahStats.filter((surah) => {
      const matchesQuery =
        !normalized ||
        surah.name_ar.includes(normalized) ||
        surah.name_en.toLocaleLowerCase(locale).includes(normalized) ||
        String(surah.id) === normalized;
      const matchesFilter =
        filter === "all" ||
        (filter === "started" && surah.started > 0 && surah.mastered < surah.total) ||
        (filter === "review" && surah.needsReview > 0) ||
        (filter === "mastered" && surah.total > 0 && surah.mastered === surah.total);
      return matchesQuery && matchesFilter;
    });
  }, [filter, locale, query, surahStats]);

  const Arrow = locale === "ar" ? ChevronLeft : ChevronRight;
  const filters: Filter[] = ["all", "started", "review", "mastered"];

  return (
    <div className="mt-5 grid gap-5 lg:grid-cols-[18rem_minmax(0,1fr)] lg:items-start">
      <aside className="grid gap-4 lg:sticky lg:top-24">
        <section className="overflow-hidden rounded-[1.75rem] border border-[#dfc58f] bg-[#102d58] p-5 text-white shadow-[0_18px_45px_rgba(16,45,88,0.14)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-bold text-[#f1cf7b]">{t("surahMap.overallLabel")}</p>
              <p className="mt-1 text-3xl font-black tabular-nums">
                {numberFormat.format(totals.mastered)}{" "}
                <span className="text-base font-bold text-white/65">/ 604</span>
              </p>
            </div>
            <span className="grid size-12 place-items-center rounded-2xl bg-white/10 text-[#f1cf7b]">
              <BookOpen className="size-6" aria-hidden="true" />
            </span>
          </div>
          <div className="mt-5 h-2.5 overflow-hidden rounded-full bg-white/12">
            <div
              className="h-full rounded-full bg-[#d4a943]"
              style={{ width: `${(totals.mastered / 604) * 100}%` }}
            />
          </div>
          <dl className="mt-5 grid grid-cols-3 gap-2 border-t border-white/12 pt-4 text-center">
            <Summary
              value={totals.started}
              label={t("surahMap.started")}
              numberFormat={numberFormat}
            />
            <Summary
              value={totals.mastered}
              label={t("surahMap.mastered")}
              numberFormat={numberFormat}
            />
            <Summary
              value={totals.needsReview}
              label={t("surahMap.review")}
              numberFormat={numberFormat}
            />
          </dl>
        </section>

        <section className="rounded-[1.5rem] border bg-card p-4 shadow-sm">
          <label className="relative block">
            <span className="sr-only">{t("surahMap.search")}</span>
            <Search
              className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("surahMap.search")}
              className="min-h-11 w-full rounded-xl border bg-background ps-10 pe-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>
          <div className="mt-3 grid grid-cols-2 gap-2" aria-label={t("surahMap.filterLabel")}>
            {filters.map((item) => (
              <button
                key={item}
                type="button"
                aria-pressed={filter === item}
                onClick={() => setFilter(item)}
                className={cn(
                  "min-h-10 rounded-xl border px-2 text-xs font-extrabold transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                  filter === item
                    ? "border-[#c9962d] bg-[#fff1cf] text-[#835300] dark:bg-[#4b3715] dark:text-[#f4cf78]"
                    : "bg-background text-muted-foreground hover:border-[#d8bd84]",
                )}
              >
                {t(`surahMap.filters.${item}`)}
              </button>
            ))}
          </div>
        </section>
      </aside>

      <section
        className="overflow-hidden rounded-[1.75rem] border bg-card shadow-[0_16px_45px_rgba(16,45,88,0.08)]"
        aria-labelledby="surah-list-title"
      >
        <header className="flex flex-wrap items-end justify-between gap-3 border-b px-4 py-5 sm:px-6">
          <div>
            <h2 id="surah-list-title" className="text-xl font-black text-primary">
              {t("surahMap.title")}
            </h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              {t("surahMap.description")}
            </p>
          </div>
          <span className="rounded-full bg-secondary/12 px-3 py-1.5 text-xs font-black text-primary">
            {t("surahMap.resultCount", { count: visibleSurahs.length })}
          </span>
        </header>

        {visibleSurahs.length ? (
          <ol className="divide-y">
            {visibleSurahs.map((surah) => (
              <li
                key={surah.id}
                className="[contain-intrinsic-size:96px] [content-visibility:auto]"
              >
                <Link
                  href={`/${locale}/student/progress/quran-map/${surah.id}`}
                  className="group grid min-h-24 grid-cols-[3rem_minmax(0,1fr)_auto] items-center gap-3 px-4 py-4 transition-colors outline-none hover:bg-[#fffaf0] focus-visible:bg-[#fff6df] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset sm:grid-cols-[3.5rem_minmax(0,1fr)_9rem_auto] sm:px-6 dark:hover:bg-muted/45"
                >
                  <span
                    className={cn(
                      "grid size-11 place-items-center rounded-2xl border text-sm font-black tabular-nums sm:size-12",
                      surah.mastered === surah.total
                        ? "border-success/35 bg-success/12 text-success"
                        : surah.needsReview
                          ? "border-warning/35 bg-warning/12 text-warning"
                          : "border-[#dec38b] bg-[#fff8e8] text-[#946000] dark:bg-[#493719] dark:text-[#efc66b]",
                    )}
                  >
                    {numberFormat.format(surah.id)}
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                      <h3 className="text-base font-black text-primary sm:text-lg">
                        {locale === "ar" ? surah.name_ar : surah.name_en}
                      </h3>
                      <span className="text-xs text-muted-foreground">
                        {t("surahMap.pageRange", {
                          first: numberFormat.format(surah.firstPage),
                          last: numberFormat.format(surah.lastPage),
                          count: numberFormat.format(surah.total),
                        })}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs font-bold">
                      <span className="text-[#8a650f]">
                        {t("surahMap.completedValue", {
                          count: numberFormat.format(surah.started),
                        })}
                      </span>
                      <span className="text-success">
                        {t("surahMap.masteredValue", {
                          count: numberFormat.format(surah.mastered),
                        })}
                      </span>
                      {surah.needsReview ? (
                        <span className="text-warning">
                          {t("surahMap.reviewValue", {
                            count: numberFormat.format(surah.needsReview),
                          })}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="hidden sm:block">
                    <div className="mb-1 flex items-center justify-between text-xs font-black text-primary">
                      <span>{t("surahMap.mastery")}</span>
                      <span>{numberFormat.format(surah.percent)}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-[#c9972e]"
                        style={{ width: `${surah.percent}%` }}
                      />
                    </div>
                  </div>
                  <Arrow
                    className="size-5 text-muted-foreground transition-transform group-hover:-translate-x-0.5 rtl:group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                </Link>
              </li>
            ))}
          </ol>
        ) : (
          <div className="grid min-h-64 place-items-center p-6 text-center">
            <div>
              <Sparkles className="mx-auto size-8 text-[#c9972e]" aria-hidden="true" />
              <p className="mt-3 font-black text-primary">{t("surahMap.emptyTitle")}</p>
              <p className="mt-1 text-sm text-muted-foreground">{t("surahMap.emptyDescription")}</p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function Summary({
  value,
  label,
  numberFormat,
}: {
  value: number;
  label: string;
  numberFormat: Intl.NumberFormat;
}) {
  return (
    <div>
      <dt className="text-[11px] text-white/65">{label}</dt>
      <dd className="mt-1 font-black text-[#f3d07f] tabular-nums">{numberFormat.format(value)}</dd>
    </div>
  );
}
