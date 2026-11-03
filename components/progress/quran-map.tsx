"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AppLocale } from "@/i18n/routing";
import type { QuranMapPage, QuranMapProgress, QuranMapSurah } from "@/lib/progress/quran-map";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type ProgressStatus = QuranMapProgress["status"];

const TOTAL_PAGES = 604;
const ROW_HEIGHT = 52;
const VIEWPORT_HEIGHT = 520;
const OVERSCAN_ROWS = 3;

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
  const viewportRef = useRef<HTMLDivElement>(null);
  const [columns, setColumns] = useState(5);
  const [scrollTop, setScrollTop] = useState(0);
  const [selectedPage, setSelectedPage] = useState(1);
  const [pendingFocus, setPendingFocus] = useState<number | null>(null);
  const [progress, setProgress] = useState(initialProgress);
  const [realtimeStatus, setRealtimeStatus] = useState("connecting");
  const numberFormat = useMemo(() => new Intl.NumberFormat(locale), [locale]);

  const progressByPage = useMemo(
    () => new Map(progress.map((entry) => [entry.page, entry])),
    [progress],
  );
  const surahById = useMemo(() => new Map(surahs.map((surah) => [surah.id, surah])), [surahs]);
  const firstPageBySurah = useMemo(() => {
    const result = new Map<number, number>();
    for (const page of pages) {
      for (let id = page.firstSurahId; id <= page.lastSurahId; id += 1) {
        if (!result.has(id)) result.set(id, page.page);
      }
    }
    return result;
  }, [pages]);
  const refreshProgress = useCallback(async () => {
    const { data, error } = await supabase
      .from("memorization_progress")
      .select("page,status,first_memorized_at,last_reviewed_at,avg_score,review_count")
      .eq("student_id", studentId)
      .order("page");
    if (!error) setProgress(data);
  }, [studentId, supabase]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const next = Math.max(5, Math.min(14, Math.floor((entry.contentRect.width - 16) / 50)));
      setColumns(next);
    });
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (pendingFocus === null) return;
    const frame = window.requestAnimationFrame(() => {
      const target = viewportRef.current?.querySelector<HTMLButtonElement>(
        `[data-quran-page="${pendingFocus}"]`,
      );
      if (target) {
        target.focus();
        setPendingFocus(null);
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [pendingFocus, scrollTop, columns]);

  useEffect(() => {
    let active = true;
    let channel: ReturnType<typeof supabase.channel> | undefined;
    async function subscribe() {
      const { data } = await supabase.auth.getSession();
      if (!active || !data.session) {
        if (active) setRealtimeStatus("signed_out");
        return;
      }
      supabase.realtime.setAuth(data.session.access_token);
      channel = supabase
        .channel(`quran-map:${studentId}`)
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
        .subscribe((status) => {
          if (active) setRealtimeStatus(status.toLowerCase());
        });
    }
    void subscribe();
    return () => {
      active = false;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [refreshProgress, studentId, supabase]);

  const rowCount = Math.ceil(pages.length / columns);
  const firstRow = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN_ROWS);
  const lastRow = Math.min(
    rowCount - 1,
    Math.ceil((scrollTop + VIEWPORT_HEIGHT) / ROW_HEIGHT) + OVERSCAN_ROWS,
  );
  const visibleRows = Array.from({ length: Math.max(0, lastRow - firstRow + 1) }, (_, index) =>
    Math.min(firstRow + index, rowCount - 1),
  );
  const selected = pages[selectedPage - 1];
  const selectedProgress = progressByPage.get(selectedPage);
  const counts = countStatuses(progressByPage);
  const juzStats = useMemo(
    () =>
      Array.from({ length: 30 }, (_, index) => {
        const juz = index + 1;
        const juzPages = pages.filter((page) => page.juz === juz);
        const mastered = juzPages.filter(
          (page) => progressByPage.get(page.page)?.status === "mastered",
        ).length;
        return {
          juz,
          mastered,
          total: juzPages.length,
          firstPage: juzPages[0]?.page ?? 1,
        };
      }),
    [pages, progressByPage],
  );

  function selectAndReveal(page: number, focus = false) {
    const next = Math.max(1, Math.min(TOTAL_PAGES, page));
    setSelectedPage(next);
    const row = Math.floor((next - 1) / columns);
    viewportRef.current?.scrollTo({ top: Math.max(0, row * ROW_HEIGHT - ROW_HEIGHT * 2) });
    if (focus) setPendingFocus(next);
  }

  function handlePageKey(event: React.KeyboardEvent<HTMLButtonElement>, page: number) {
    const targets: Partial<Record<string, number>> = {
      ArrowLeft: locale === "ar" ? page + 1 : page - 1,
      ArrowRight: locale === "ar" ? page - 1 : page + 1,
      ArrowUp: page - columns,
      ArrowDown: page + columns,
      Home: 1,
      End: TOTAL_PAGES,
    };
    const target = targets[event.key];
    if (target === undefined) return;
    event.preventDefault();
    selectAndReveal(target, true);
  }

  return (
    <div className="mt-5 grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_20rem] xl:gap-6">
      <Card className="min-w-0 overflow-hidden">
        <CardHeader className="gap-5 border-b bg-muted/35">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-extrabold tracking-tight text-primary">{t("mapTitle")}</h2>
            <Badge variant="secondary">{t("pageCount", { count: TOTAL_PAGES })}</Badge>
          </div>
          <div className="grid gap-2" aria-label={t("journeyProgressLabel")}>
            <div className="flex items-center justify-between gap-4 text-sm">
              <span className="font-bold text-primary">{t("journeyProgressLabel")}</span>
              <span className="font-black text-[#815300] tabular-nums dark:text-[#f0c66d]">
                {t("journeyProgressValue", {
                  completed: numberFormat.format(counts.mastered),
                  total: numberFormat.format(TOTAL_PAGES),
                })}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-secondary/15">
              <div
                className="h-full rounded-full bg-secondary transition-[width]"
                style={{ width: `${(counts.mastered / TOTAL_PAGES) * 100}%` }}
              />
            </div>
          </div>
          <div className="grid gap-3">
            <label className="grid gap-1.5 text-sm font-bold" htmlFor="quran-map-surah">
              {t("surahLabel")}
              <select
                id="quran-map-surah"
                className="min-h-11 rounded-lg border bg-card px-3 text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
                value={selected?.firstSurahId ?? 1}
                onChange={(event) =>
                  selectAndReveal(firstPageBySurah.get(Number(event.target.value)) ?? 1)
                }
              >
                {surahs.map((surah) => (
                  <option key={surah.id} value={surah.id}>
                    {surah.id}. {locale === "ar" ? surah.name_ar : surah.name_en}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div>
            <p className="mb-2 text-sm font-black text-primary">{t("allJuz")}</p>
            <div className="grid grid-cols-5 gap-2 sm:grid-cols-10 xl:grid-cols-15">
              {juzStats.map((item) => {
                const active = selected?.juz === item.juz;
                const percent = item.total ? Math.round((item.mastered / item.total) * 100) : 0;
                return (
                  <button
                    key={item.juz}
                    type="button"
                    data-testid="quran-juz-button"
                    className={cn(
                      "grid min-h-12 place-items-center rounded-xl border px-1 text-xs font-black transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none",
                      active
                        ? "border-[#c78a12] bg-[#fff3d8] text-[#9a5d00]"
                        : "border-border bg-card text-primary hover:border-[#d9b15f] hover:bg-[#fffaf0] dark:hover:bg-muted",
                    )}
                    aria-pressed={active}
                    onClick={() => selectAndReveal(item.firstPage, true)}
                  >
                    <span>{t("juzLabel", { juz: item.juz })}</span>
                    <span className="text-[10px] text-muted-foreground">{percent}%</span>
                  </button>
                );
              })}
            </div>
          </div>
          <p className="hidden text-sm leading-6 text-muted-foreground md:block">
            {t("keyboardHint")}
          </p>
          <p className="rounded-xl bg-background/75 p-3 text-sm font-bold text-primary xl:hidden">
            {t("mobileSelection", {
              page: numberFormat.format(selectedPage),
              juz: numberFormat.format(selected?.juz ?? 1),
              status: t(`statuses.${selectedProgress?.status ?? "not_started"}`),
            })}
          </p>
          <Legend />
        </CardHeader>
        <CardContent className="p-3 sm:p-4">
          <div
            ref={viewportRef}
            role="grid"
            aria-label={t("gridLabel")}
            aria-rowcount={rowCount}
            aria-colcount={columns}
            data-realtime-status={realtimeStatus}
            className="relative h-[22rem] overflow-y-auto overscroll-contain rounded-xl border bg-background/55 p-2 focus-within:ring-2 focus-within:ring-ring sm:h-[32.5rem]"
            onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
          >
            <div className="relative" style={{ height: rowCount * ROW_HEIGHT }}>
              {visibleRows.map((row) => {
                const rowPages = pages.slice(row * columns, row * columns + columns);
                return (
                  <div
                    key={row}
                    role="row"
                    aria-rowindex={row + 1}
                    className="absolute inset-x-0 grid gap-1.5"
                    style={{
                      top: row * ROW_HEIGHT,
                      gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
                    }}
                  >
                    {rowPages.map((page, column) => {
                      const item = progressByPage.get(page.page);
                      const status = item?.status ?? "not_started";
                      return (
                        <button
                          key={page.page}
                          type="button"
                          role="gridcell"
                          aria-colindex={column + 1}
                          aria-selected={selectedPage === page.page}
                          tabIndex={selectedPage === page.page ? 0 : -1}
                          aria-label={t("pageLabel", {
                            page: page.page,
                            status: t(`statuses.${status}`),
                          })}
                          data-quran-page={page.page}
                          className={cn(
                            "relative min-h-11 min-w-0 touch-manipulation rounded-lg border-2 text-xs font-black tabular-nums transition-[color,background-color,border-color,box-shadow] outline-none hover:shadow-sm focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                            statusClass(status),
                            selectedPage === page.page && "ring-2 ring-primary ring-offset-2",
                          )}
                          onClick={() => setSelectedPage(page.page)}
                          onFocus={() => setSelectedPage(page.page)}
                          onKeyDown={(event) => handlePageKey(event, page.page)}
                        >
                          <span aria-hidden="true" className="me-1 opacity-70">
                            {statusMark(status)}
                          </span>
                          {numberFormat.format(page.page)}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      <aside className="grid content-start gap-5">
        <Card aria-live="polite">
          <CardHeader className="border-b bg-muted/20 px-4 py-3 sm:px-6 sm:py-4">
            <CardTitle>{t("details.title", { page: selectedPage })}</CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            <SelectedPageDetails
              locale={locale}
              numberFormat={numberFormat}
              selected={selected}
              selectedProgress={selectedProgress}
              surahById={surahById}
            />
          </CardContent>
        </Card>

        {progress.length ? (
          <div className="grid grid-cols-2 gap-3" aria-label={t("summaryLabel")}>
            <Summary label={t("statuses.mastered")} value={numberFormat.format(counts.mastered)} />
            <Summary
              label={t("statuses.needs_review")}
              value={numberFormat.format(counts.needs_review)}
            />
            <Summary
              label={t("statuses.in_progress")}
              value={numberFormat.format(counts.in_progress)}
            />
            <Summary
              label={t("statuses.not_started")}
              value={numberFormat.format(counts.not_started)}
            />
          </div>
        ) : null}
      </aside>
    </div>
  );
}

function SelectedPageDetails({
  locale,
  numberFormat,
  selected,
  selectedProgress,
  surahById,
}: {
  locale: AppLocale;
  numberFormat: Intl.NumberFormat;
  selected: QuranMapPage | undefined;
  selectedProgress: QuranMapProgress | undefined;
  surahById: Map<number, QuranMapSurah>;
}) {
  const t = useTranslations("quranMap");
  return (
    <dl className="grid gap-x-5 gap-y-3 text-sm sm:grid-cols-2 xl:grid-cols-1">
      <Detail label={t("details.surah")} value={surahRange(selected, surahById, locale)} />
      <Detail label={t("details.juz")} value={selected ? numberFormat.format(selected.juz) : "—"} />
      <Detail
        label={t("details.status")}
        value={t(`statuses.${selectedProgress?.status ?? "not_started"}`)}
      />
      <Detail
        label={t("details.firstMemorized")}
        value={formatDate(selectedProgress?.first_memorized_at, locale)}
      />
      <Detail
        label={t("details.lastReviewed")}
        value={formatDate(selectedProgress?.last_reviewed_at, locale)}
      />
      <Detail
        label={t("details.average")}
        value={
          selectedProgress?.avg_score === null || selectedProgress?.avg_score === undefined
            ? "—"
            : t("score", { score: selectedProgress.avg_score })
        }
      />
      <Detail
        label={t("details.evaluations")}
        value={numberFormat.format(selectedProgress?.review_count ?? 0)}
      />
    </dl>
  );
}

function Legend() {
  const t = useTranslations("quranMap");
  const statuses: ProgressStatus[] = ["mastered", "needs_review", "in_progress", "not_started"];
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-2" aria-label={t("legendLabel")}>
      {statuses.map((status) => (
        <li
          key={status}
          className="flex items-center gap-2 text-xs font-bold text-muted-foreground"
        >
          <span
            className={cn(
              "grid size-7 place-items-center rounded-md border-2",
              statusClass(status),
            )}
          >
            <span aria-hidden="true">{statusMark(status)}</span>
          </span>
          {t(`statuses.${status}`)}
        </li>
      ))}
    </ul>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 border-b pb-3 last:border-0 last:pb-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="max-w-40 text-end font-bold text-primary">{value}</dd>
    </div>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-card p-3">
      <strong className="block text-2xl font-black text-primary">{value}</strong>
      <span className="text-xs leading-5 text-muted-foreground">{label}</span>
    </div>
  );
}

function statusClass(status: ProgressStatus) {
  if (status === "mastered") return "border-success bg-success/15 text-success";
  if (status === "needs_review") return "border-dashed border-warning bg-warning/12 text-warning";
  if (status === "in_progress")
    return "border-double border-secondary bg-secondary/15 text-primary";
  return "border-dotted border-muted-foreground/45 bg-card text-muted-foreground";
}

function statusMark(status: ProgressStatus) {
  if (status === "mastered") return "✓";
  if (status === "needs_review") return "↺";
  if (status === "in_progress") return "◐";
  return "–";
}

function countStatuses(progress: Map<number, QuranMapProgress>) {
  const counts = { mastered: 0, needs_review: 0, in_progress: 0, not_started: TOTAL_PAGES };
  for (const item of progress.values()) {
    counts.not_started -= 1;
    counts[item.status] += 1;
  }
  return counts;
}

function surahRange(
  page: QuranMapPage | undefined,
  surahs: Map<number, QuranMapSurah>,
  locale: AppLocale,
) {
  if (!page) return "—";
  const first = surahs.get(page.firstSurahId);
  const last = surahs.get(page.lastSurahId);
  const name = (surah: QuranMapSurah | undefined) =>
    surah ? (locale === "ar" ? surah.name_ar : surah.name_en) : "—";
  return page.firstSurahId === page.lastSurahId ? name(first) : `${name(first)} – ${name(last)}`;
}

function formatDate(value: string | null | undefined, locale: AppLocale) {
  if (!value) return "—";
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(value));
}
