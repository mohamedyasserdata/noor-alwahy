import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CalendarDays,
  ClipboardList,
  ExternalLink,
  MessageSquareText,
  RotateCcw,
} from "lucide-react";
import Link from "next/link";
import type { LinkProps } from "next/link";
import { getTranslations } from "next-intl/server";

import type { AppLocale } from "@/i18n/routing";
import type { StudentProgressOverviewData } from "@/lib/progress/student-progress-overview";

type View = "summary" | "history" | "review";

export async function StudentProgressOverview({
  data,
  locale,
  view,
}: {
  data: StudentProgressOverviewData;
  locale: AppLocale;
  view: View;
}) {
  const t = await getTranslations({ locale, namespace: "studentProgressOverview" });
  const number = new Intl.NumberFormat(locale);
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "long" });
  const history = view === "history" ? data.history : data.history.slice(0, 4);
  const reviewGroups = groupReviewPages(data.reviewPages, locale);
  const reviews = view === "review" ? reviewGroups : reviewGroups.slice(0, 3);
  const Arrow = locale === "ar" ? ArrowLeft : ArrowRight;

  return (
    <div className="grid gap-4 sm:gap-5" data-testid="student-progress-overview">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,2.15fr)_minmax(18rem,0.85fr)]">
        <section className="overflow-hidden rounded-[1.75rem] border border-[#ead8b7] bg-card shadow-[0_12px_32px_rgba(88,58,15,0.08)]">
          <header className="flex items-center gap-3 border-b border-[#ead8b7] bg-[radial-gradient(circle_at_10%_10%,rgba(199,138,18,0.10),transparent_30%),linear-gradient(135deg,rgba(255,250,240,0.9),rgba(255,255,255,0.96))] px-5 py-4 sm:px-6">
            <span className="grid size-11 place-items-center rounded-full bg-[#fff3d8] text-[#b87400]">
              <BookOpen className="size-6" aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-bold text-[#b87400]">{t("currentJuz.eyebrow")}</p>
              <h2 className="text-xl font-black text-primary sm:text-2xl">
                {t("currentJuz.title")}
              </h2>
            </div>
          </header>

          <div className="grid items-center gap-6 p-5 sm:p-6 lg:grid-cols-[minmax(14rem,1fr)_minmax(0,1.4fr)]">
            <div className="rounded-[1.4rem] border-2 border-[#d99b2b] bg-[#fffaf0] px-5 py-4 text-center shadow-[inset_0_0_0_4px_#fff,0_8px_18px_rgba(174,111,0,0.10)] dark:bg-card">
              <span className="text-sm font-bold text-muted-foreground">
                {t("currentJuz.label")}
              </span>
              <strong className="mt-1 block text-2xl font-black text-[#a86400] sm:text-3xl">
                {t("currentJuz.value", { juz: number.format(data.currentJuz.number) })}
              </strong>
            </div>

            <div className="grid gap-4">
              <div className="grid grid-cols-3 divide-x divide-[#e7d3ae] divide-x-reverse rtl:divide-x-reverse">
                <Metric
                  label={t("currentJuz.progress")}
                  value={t("percent", { value: number.format(data.currentJuz.percent) })}
                />
                <Metric
                  label={t("currentJuz.pages")}
                  value={number.format(data.currentJuz.masteredPages)}
                />
                <Metric
                  label={t("currentJuz.surahs")}
                  value={t("surahCount", { count: data.currentJuz.surahCount })}
                />
              </div>
              <ProgressBar value={data.currentJuz.percent} label={t("currentJuz.progress")} />
            </div>
          </div>
        </section>

        <Link
          href={`/${locale}/student/progress/quran-map`}
          data-testid="quran-map-card"
          className="group grid min-h-48 content-between rounded-[1.75rem] border border-[#ead8b7] bg-card p-5 shadow-[0_12px_32px_rgba(88,58,15,0.08)] transition-[border-color,transform,box-shadow] hover:-translate-y-0.5 hover:border-[#c78a12] hover:shadow-[0_16px_36px_rgba(88,58,15,0.12)] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none sm:p-6"
        >
          <div className="flex items-start justify-between gap-4">
            <span className="grid size-12 place-items-center rounded-2xl bg-linear-to-b from-[#d89a27] to-[#b77200] text-white shadow-sm">
              <BookOpen className="size-7" aria-hidden="true" />
            </span>
            <Arrow
              className="size-6 text-primary transition-transform group-hover:-translate-x-1 rtl:group-hover:translate-x-1"
              aria-hidden="true"
            />
          </div>
          <div>
            <h2 className="text-2xl font-black text-primary">{t("map.title")}</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">{t("map.description")}</p>
            <div className="mt-5 flex items-end gap-4">
              <strong className="text-3xl font-black text-[#b87400] tabular-nums">
                {t("percent", { value: number.format(data.overall.percent) })}
              </strong>
              <div className="min-w-0 flex-1 pb-1">
                <ProgressBar value={data.overall.percent} label={t("map.title")} />
                <p className="mt-2 text-end text-sm font-bold text-primary">
                  {t("map.pages", {
                    completed: number.format(data.overall.masteredPages),
                    total: number.format(604),
                  })}
                </p>
              </div>
            </div>
          </div>
        </Link>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,2.15fr)_minmax(18rem,0.85fr)]">
        <section className="overflow-hidden rounded-[1.75rem] border border-[#ead8b7] bg-card shadow-[0_12px_32px_rgba(88,58,15,0.08)]">
          <SectionHeader icon={ClipboardList} title={t("history.title")}>
            {data.history.length ? (
              <TextLink
                href={
                  view === "history"
                    ? `/${locale}/student/progress`
                    : `/${locale}/student/progress?view=history`
                }
                label={view === "history" ? t("showLess") : t("history.showAll")}
                external
              />
            ) : null}
          </SectionHeader>
          {history.length ? (
            <>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full border-collapse text-sm">
                  <thead className="bg-[#f8efe0] text-primary dark:bg-muted/40">
                    <tr>
                      <Th>{t("history.date")}</Th>
                      <Th>{t("history.range")}</Th>
                      <Th>{t("history.score")}</Th>
                      <Th>{t("history.type")}</Th>
                      <Th>{t("history.note")}</Th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#eee1ca]">
                    {history.map((item) => (
                      <tr key={item.id} className="hover:bg-[#fffaf2] dark:hover:bg-muted/20">
                        <Td>
                          <span className="inline-flex items-center gap-2 font-bold whitespace-nowrap">
                            <CalendarDays className="size-4 text-[#b87400]" aria-hidden="true" />
                            {date.format(new Date(item.date))}
                          </span>
                        </Td>
                        <Td>
                          <strong className="text-primary">
                            {historyRange(item, locale, t("unknown"))}
                          </strong>
                        </Td>
                        <Td>
                          <Score value={item.score} locale={locale} />
                        </Td>
                        <Td>{t(`sessionTypes.${sessionTypeKey(item.sessionType)}`)}</Td>
                        <Td>
                          <span className="line-clamp-2 min-w-44 text-muted-foreground">
                            {item.note || t("history.noNote")}
                          </span>
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="grid divide-y divide-[#eee1ca] md:hidden">
                {history.map((item) => (
                  <article key={item.id} className="grid gap-3 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <time className="text-sm font-bold text-primary" dateTime={item.date}>
                        {date.format(new Date(item.date))}
                      </time>
                      <Score value={item.score} locale={locale} />
                    </div>
                    <strong className="text-primary">
                      {historyRange(item, locale, t("unknown"))}
                    </strong>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <BookOpen className="size-4 text-[#b87400]" aria-hidden="true" />
                      {t(`sessionTypes.${sessionTypeKey(item.sessionType)}`)}
                    </div>
                    {item.note ? (
                      <p className="text-sm leading-6 text-muted-foreground">{item.note}</p>
                    ) : null}
                  </article>
                ))}
              </div>
            </>
          ) : (
            <EmptyState text={t("history.empty")} />
          )}
        </section>

        <section className="overflow-hidden rounded-[1.75rem] border border-[#ead8b7] bg-card shadow-[0_12px_32px_rgba(88,58,15,0.08)]">
          <SectionHeader icon={RotateCcw} title={t("review.title")} />
          <p className="px-5 pt-4 text-sm leading-6 text-muted-foreground sm:px-6">
            {t("review.description")}
          </p>
          {reviews.length ? (
            <ul className="mt-3 divide-y divide-[#eee1ca] px-5 sm:px-6">
              {reviews.map((item) => (
                <li key={`${item.surah}-${item.fromPage}`} className="flex items-center gap-3 py-3">
                  <BookOpen className="size-5 shrink-0 text-[#b87400]" aria-hidden="true" />
                  <strong className="min-w-0 flex-1 truncate text-primary">{item.surah}</strong>
                  <span className="rounded-full bg-muted px-3 py-1 text-sm font-black text-primary tabular-nums">
                    {item.fromPage === item.toPage
                      ? number.format(item.fromPage)
                      : `${number.format(item.fromPage)}–${number.format(item.toPage)}`}
                  </span>
                  <span className="rounded-full bg-[#ffe0d8] px-3 py-1 text-xs font-black text-[#bd2c1b] dark:bg-[#5a211b] dark:text-[#ffd2ca]">
                    {t("review.badge")}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState text={t("review.empty")} compact />
          )}
          {reviewGroups.length ? (
            <div className="border-t px-5 py-4 sm:px-6">
              <TextLink
                href={
                  view === "review"
                    ? `/${locale}/student/progress`
                    : `/${locale}/student/progress?view=review`
                }
                label={
                  view === "review"
                    ? t("showLess")
                    : t("review.showAll", { count: reviewGroups.length })
                }
              />
            </div>
          ) : null}
        </section>
      </div>

      <section className="grid overflow-hidden rounded-[1.75rem] border border-[#ead8b7] bg-card shadow-[0_12px_32px_rgba(88,58,15,0.08)] md:grid-cols-[15rem_minmax(0,1fr)]">
        <header className="flex items-center gap-4 border-b border-[#ead8b7] bg-[linear-gradient(135deg,#fff9ec,#fff)] p-5 sm:p-6 md:border-e md:border-b-0 dark:bg-card">
          <span className="grid size-12 place-items-center rounded-full bg-[#fff3d8] text-[#b87400]">
            <MessageSquareText className="size-7" aria-hidden="true" />
          </span>
          <h2 className="text-2xl font-black text-primary">{t("teacherNote.title")}</h2>
        </header>
        <div className="grid min-h-32 place-items-center p-5 sm:p-6">
          <p className="max-w-4xl text-center text-base leading-8 font-bold text-primary sm:text-lg">
            {data.latestTeacherNote ?? t("teacherNote.empty")}
          </p>
        </div>
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-2 text-center sm:px-4">
      <span className="block text-xs font-bold text-muted-foreground sm:text-sm">{label}</span>
      <strong className="mt-1 block text-xl font-black text-primary tabular-nums sm:text-2xl">
        {value}
      </strong>
    </div>
  );
}

function ProgressBar({ label, value }: { label: string; value: number }) {
  return (
    <div
      className="h-3 overflow-hidden rounded-full bg-[#f0e2ca] dark:bg-muted"
      role="progressbar"
      aria-label={label}
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full rounded-full bg-linear-to-l from-[#d79a25] to-[#b87300]"
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

function SectionHeader({
  children,
  icon: Icon,
  title,
}: {
  children?: React.ReactNode;
  icon: typeof ClipboardList;
  title: string;
}) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#ead8b7] px-5 py-4 sm:px-6">
      <div className="flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-full bg-[#fff3d8] text-[#b87400]">
          <Icon className="size-5" aria-hidden="true" />
        </span>
        <h2 className="text-xl font-black text-primary sm:text-2xl">{title}</h2>
      </div>
      {children}
    </header>
  );
}

function TextLink({
  href,
  label,
  external = false,
}: {
  href: string;
  label: string;
  external?: boolean;
}) {
  return (
    <Link
      href={href as LinkProps<string>["href"]}
      className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#e1c999] px-3 text-sm font-black text-primary hover:bg-[#fff8e9] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none dark:hover:bg-muted"
    >
      {label}
      {external ? <ExternalLink className="size-4" aria-hidden="true" /> : null}
    </Link>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-3 text-start font-black whitespace-nowrap">{children}</th>;
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-4 py-3 align-middle">{children}</td>;
}

function Score({ value, locale }: { value: number; locale: AppLocale }) {
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  const tone =
    value >= 90
      ? "bg-[#dff2d8] text-[#16811f]"
      : value >= 75
        ? "bg-[#fff0c9] text-[#a96600]"
        : "bg-[#ffe0d8] text-[#bd2c1b]";
  return (
    <span className={`inline-flex rounded-full px-3 py-1 font-black tabular-nums ${tone}`}>
      {number.format(value)}%
    </span>
  );
}

function EmptyState({ text, compact = false }: { text: string; compact?: boolean }) {
  return (
    <p
      className={`text-center leading-7 text-muted-foreground ${compact ? "px-5 py-8" : "px-6 py-14"}`}
    >
      {text}
    </p>
  );
}

function historyRange(
  item: StudentProgressOverviewData["history"][number],
  locale: AppLocale,
  unknown: string,
) {
  const first = locale === "ar" ? item.firstSurahAr : item.firstSurahEn;
  const last = locale === "ar" ? item.lastSurahAr : item.lastSurahEn;
  const surah = first && last && first !== last ? `${first} – ${last}` : first || last || unknown;
  if (item.fromPage === null || item.toPage === null) return surah;
  const number = new Intl.NumberFormat(locale);
  const pages =
    item.fromPage === item.toPage
      ? number.format(item.fromPage)
      : `${number.format(item.fromPage)}–${number.format(item.toPage)}`;
  return `${surah} (${pages})`;
}

function sessionTypeKey(value: string) {
  const supported = [
    "new_memo",
    "near_review",
    "far_review",
    "recitation",
    "tajweed",
    "tafsir",
  ] as const;
  return supported.find((item) => item === value) ?? "other";
}

function groupReviewPages(pages: StudentProgressOverviewData["reviewPages"], locale: AppLocale) {
  const groups: Array<{ surah: string; fromPage: number; toPage: number }> = [];
  for (const page of pages) {
    const surah = (locale === "ar" ? page.surahAr : page.surahEn) ?? "—";
    const previous = groups.at(-1);
    if (previous && previous.surah === surah && previous.toPage + 1 === page.page) {
      previous.toPage = page.page;
    } else {
      groups.push({ surah, fromPage: page.page, toPage: page.page });
    }
  }
  return groups;
}
