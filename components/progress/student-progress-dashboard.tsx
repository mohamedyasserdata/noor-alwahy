import {
  Award,
  BookMarked,
  CalendarClock,
  FileText,
  Gauge,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { AppLocale } from "@/i18n/routing";
import type { PlanAdherence } from "@/lib/memorization-plans/queries";
import type { getStudentProgressDashboard } from "@/lib/progress/dashboard";

type Data = Awaited<ReturnType<typeof getStudentProgressDashboard>>;

export async function StudentProgressDashboard({
  locale,
  data,
  plan,
}: {
  locale: AppLocale;
  data: Data;
  plan: PlanAdherence | null;
}) {
  const t = await getTranslations({ locale, namespace: "studentProgress" });
  const current = Object.values(data.radar.current);
  const previous = Object.values(data.radar.previous);
  const criteria = t.raw("criteria") as string[];
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
  const expectedCompletion = data.metrics.expectedCompletion
    ? date.format(new Date(`${data.metrics.expectedCompletion}T12:00:00Z`))
    : t("noData");
  const hasMeaningfulData = Boolean(
    plan ||
    data.metrics.masteredPages ||
    data.history.length ||
    data.homework ||
    data.review.due ||
    data.latestReport,
  );

  if (!hasMeaningfulData) {
    return (
      <section className="overflow-hidden rounded-3xl border border-secondary/25 bg-card shadow-card">
        <div className="flex items-start gap-4 p-5 sm:items-center sm:p-6">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-primary text-secondary shadow-sm">
            <BookMarked className="size-6" aria-hidden="true" />
          </span>
          <div>
            <p className="text-xs font-black text-secondary">{t("emptyStatus")}</p>
            <h2 className="mt-1 text-xl font-black text-primary sm:text-2xl">{t("emptyTitle")}</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
              {t("emptyDescription")}
            </p>
          </div>
        </div>
        <div className="grid border-t bg-muted/20 sm:grid-cols-2">
          <div className="flex gap-3 border-b p-4 sm:border-e sm:border-b-0 sm:p-5">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-secondary text-sm font-black text-primary">
              1
            </span>
            <div>
              <p className="font-black text-primary">{t("emptyCurrentTitle")}</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                {t("emptyCurrentDescription")}
              </p>
            </div>
          </div>
          <div className="flex gap-3 p-4 sm:p-5">
            <span className="grid size-8 shrink-0 place-items-center rounded-full border border-secondary/35 bg-card text-sm font-black text-secondary">
              2
            </span>
            <div>
              <p className="font-black text-primary">{t("emptyNextTitle")}</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                {t("emptyNextDescription")}
              </p>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <div className="student-progress-dashboard mt-5 grid gap-5">
      {plan ? (
        <section className="rounded-3xl border border-secondary/30 bg-primary p-5 text-primary-foreground shadow-card sm:p-6">
          <h2 className="text-xl font-black text-primary-foreground">{t("goalTitle")}</h2>
          <p className="mt-1 text-sm leading-6 text-primary-foreground/70">
            {t("goalDescription")}
          </p>
          <dl className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl bg-white/8 p-4">
              <dt className="text-sm text-primary-foreground/70">{t("weeklyGoal")}</dt>
              <dd className="mt-1 text-2xl font-black text-secondary">
                {t("pagesValue", { count: plan.weekly_target_pages ?? 0 })}
              </dd>
            </div>
            <div className="rounded-2xl bg-white/8 p-4">
              <dt className="text-sm text-primary-foreground/70">{t("monthlyGoal")}</dt>
              <dd className="mt-1 text-2xl font-black text-secondary">
                {t("pagesValue", { count: plan.monthly_target_pages ?? 0 })}
              </dd>
            </div>
          </dl>
        </section>
      ) : null}
      <section aria-labelledby="journey-summary-title">
        <div className="mb-4 flex items-center gap-3">
          <Gauge className="size-6 text-secondary" aria-hidden="true" />
          <h2 id="journey-summary-title" className="text-2xl font-black text-primary">
            {t("title")}
          </h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            value={
              plan
                ? t("percentValue", {
                    value: number.format(Number(plan.weekly_adherence_percent ?? 0)),
                  })
                : t("noData")
            }
            label={t("planProgress")}
            icon={Gauge}
            tone="violet"
            progressValue={plan ? Number(plan.weekly_adherence_percent ?? 0) : undefined}
          />
          <Stat
            value={number.format(data.metrics.masteredPages)}
            label={t("pages")}
            icon={BookMarked}
            tone="blue"
          />
          <Stat
            value={number.format(data.metrics.weeklySpeed)}
            label={t("speed")}
            icon={TrendingUp}
            tone="green"
          />
          <Stat
            value={expectedCompletion}
            label={t("expectedEstimate")}
            icon={CalendarClock}
            tone="gold"
          />
        </div>
        <p className="mt-3 text-xs leading-6 text-muted-foreground">{t("estimateHint")}</p>
      </section>

      <section className="rounded-3xl border border-secondary/20 bg-card p-5 shadow-card sm:p-6">
        <h2 className="text-xl font-black text-primary">{t("currentWork")}</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Detail
            icon={<BookMarked />}
            label={t("review")}
            value={t("reviewValue", { due: data.review.due, overdue: data.review.overdue })}
          />
          <Detail icon={<FileText />} label={t("homework")} value={data.homework ?? t("noData")} />
        </div>
      </section>

      <details className="group rounded-3xl border border-secondary/20 bg-card shadow-card">
        <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 font-black text-primary marker:hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none [&::-webkit-details-marker]:hidden">
          <span className="flex items-center gap-2">
            <Sparkles className="size-5 text-secondary" aria-hidden="true" />
            {t("analyticsTitle")}
          </span>
          <span className="text-sm font-bold text-muted-foreground group-open:hidden">
            {t("open")}
          </span>
          <span className="hidden text-sm font-bold text-muted-foreground group-open:inline">
            {t("close")}
          </span>
        </summary>
        <div className="grid gap-5 border-t p-5 sm:p-6">
          <div className="grid gap-5 lg:grid-cols-2">
            <Panel title={t("radar")} icon={<Sparkles />}>
              <RadarChart
                labels={criteria}
                current={current}
                previous={previous}
                currentLabel={t("current")}
                previousLabel={t("previous")}
              />
            </Panel>
            <Panel title={t("curve")} icon={<TrendingUp />}>
              <ProgressCurve points={data.curve} emptyLabel={t("noData")} />
            </Panel>
          </div>
          <div className="grid gap-5 lg:grid-cols-2">
            <Panel title={t("history")} icon={<CalendarClock />}>
              {data.history.length ? (
                <ol className="divide-y">
                  {data.history.map((item) => (
                    <li key={item.id} className="flex items-center justify-between gap-4 py-3">
                      <time className="text-sm text-muted-foreground" dateTime={item.date}>
                        {date.format(new Date(`${item.date}T12:00:00Z`))}
                      </time>
                      <strong className="text-primary tabular-nums">
                        {item.score == null
                          ? t("noData")
                          : t("percentValue", { value: number.format(item.score) })}
                      </strong>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-muted-foreground">{t("noData")}</p>
              )}
            </Panel>
            <Panel title={t("badges")} icon={<Award />}>
              <div className="flex flex-wrap gap-3">
                {data.badges.completedJuz.map((juz) => (
                  <Badge key={juz} variant="secondary">
                    {t("completedJuzBadge", { juz })}
                  </Badge>
                ))}
                {data.badges.weeklyConsistency ? (
                  <Badge variant="success">{t("consistency")}</Badge>
                ) : null}
                {!data.badges.completedJuz.length && !data.badges.weeklyConsistency ? (
                  <span className="text-muted-foreground">{t("noData")}</span>
                ) : null}
              </div>
            </Panel>
          </div>
          {data.latestReport ? (
            <div className="rounded-2xl bg-accent/35 p-5">
              <p className="font-black text-primary">{t("report")}</p>
              <p className="mt-2 text-sm text-muted-foreground">
                {date.format(new Date(`${data.latestReport.period_start}T12:00:00Z`))} —{" "}
                {date.format(new Date(`${data.latestReport.period_end}T12:00:00Z`))}
              </p>
              <Button asChild className="mt-4" variant="outline">
                <Link href={`/api/pdf/reports/${data.latestReport.id}?locale=${locale}`}>
                  {t("download")}
                </Link>
              </Button>
            </div>
          ) : null}
        </div>
      </details>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  progressValue,
  tone,
  value,
}: {
  icon: LucideIcon;
  label: string;
  progressValue?: number;
  tone: "blue" | "gold" | "green" | "violet";
  value: string | number;
}) {
  const tones = {
    blue: "border-[#bfd8fb] bg-[#f1f7ff] text-[#1f5c9e]",
    gold: "border-[#ead6ad] bg-[#fff9ec] text-[#9a6512]",
    green: "border-[#bfe2ce] bg-[#f0faf4] text-[#237a4b]",
    violet: "border-[#d5d0f5] bg-[#f7f5ff] text-[#5b55bd]",
  } as const;
  const normalized = Math.min(100, Math.max(0, progressValue ?? 0));

  return (
    <article
      className={`flex min-h-28 items-center gap-4 rounded-2xl border p-5 dark:border-border dark:bg-card ${tones[tone]}`}
    >
      {progressValue == null ? (
        <span className="grid size-12 shrink-0 place-items-center rounded-full bg-current/10">
          <Icon className="size-6" aria-hidden="true" />
        </span>
      ) : (
        <span
          className="grid size-16 shrink-0 place-items-center rounded-full p-2"
          style={{ background: `conic-gradient(#c69432 ${normalized * 3.6}deg, #f1e5cd 0deg)` }}
          role="progressbar"
          aria-label={label}
          aria-valuenow={normalized}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <span className="grid size-full place-items-center rounded-full bg-card text-xs font-black text-primary">
            {normalized}%
          </span>
        </span>
      )}
      <div>
        <strong className="block text-3xl font-black text-primary tabular-nums">{value}</strong>
        <span className="mt-1 block text-sm text-muted-foreground">{label}</span>
      </div>
    </article>
  );
}
function Detail({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex gap-3 rounded-2xl border bg-card p-5">
      <span className="mt-0.5 text-secondary [&>svg]:size-5">{icon}</span>
      <div>
        <p className="text-sm font-bold text-primary">{label}</p>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">{value}</p>
      </div>
    </div>
  );
}
function Panel({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-secondary/20 bg-card/96 p-5 shadow-card sm:p-6">
      <h3 className="mb-5 flex items-center gap-2 text-lg font-black text-primary">
        <span className="text-secondary [&>svg]:size-5">{icon}</span>
        {title}
      </h3>
      {children}
    </section>
  );
}

function RadarChart({
  labels: names,
  current,
  previous,
  currentLabel,
  previousLabel,
}: {
  labels: readonly string[];
  current: number[];
  previous: number[];
  currentLabel: string;
  previousLabel: string;
}) {
  const center = 110,
    radius = 78;
  const polygon = (values: number[]) =>
    values
      .map((value, index) => {
        const angle = -Math.PI / 2 + (index * Math.PI * 2) / values.length;
        const r = (radius * Math.max(0, Math.min(100, value))) / 100;
        return `${center + Math.cos(angle) * r},${center + Math.sin(angle) * r}`;
      })
      .join(" ");
  const grid = [25, 50, 75, 100].map((level) => polygon(Array(7).fill(level)));
  return (
    <div>
      <svg
        viewBox="0 0 220 220"
        role="img"
        aria-label={`${currentLabel} / ${previousLabel}`}
        className="mx-auto w-full max-w-xs"
      >
        {grid.map((points) => (
          <polygon
            key={points}
            points={points}
            fill="none"
            stroke="currentColor"
            className="text-border"
          />
        ))}
        <polygon points={polygon(previous)} fill="#94a3b833" stroke="#64748b" strokeWidth="2" />
        <polygon points={polygon(current)} fill="#d3aa4555" stroke="#b88b28" strokeWidth="3" />
      </svg>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
        {names.map((name, index) => (
          <span key={name}>
            {name}: <b className="text-primary tabular-nums">{current[index] ?? 0}</b>
          </span>
        ))}
      </div>
    </div>
  );
}
function ProgressCurve({
  points,
  emptyLabel,
}: {
  points: { label: string; value: number }[];
  emptyLabel: string;
}) {
  const max = Math.max(...points.map((point) => point.value), 1);
  const coords = points
    .map(
      (point, index) =>
        `${10 + (index * 200) / Math.max(1, points.length - 1)},${105 - (point.value / max) * 90}`,
    )
    .join(" ");
  return (
    <div>
      {points.some((point) => point.value > 0) ? (
        <svg viewBox="0 0 220 120" role="img" aria-label={emptyLabel} className="w-full">
          <path d="M10 105H210" stroke="currentColor" className="text-border" />
          <polyline
            points={coords}
            fill="none"
            stroke="#d3aa45"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {points.map((point, index) => (
            <circle
              key={point.label}
              cx={10 + (index * 200) / Math.max(1, points.length - 1)}
              cy={105 - (point.value / max) * 90}
              r="3"
              fill="#102b50"
            />
          ))}
        </svg>
      ) : (
        <p className="py-12 text-center text-muted-foreground">{emptyLabel}</p>
      )}
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{points[0]?.label}</span>
        <span>{points.at(-1)?.label}</span>
      </div>
    </div>
  );
}
