import {
  Award,
  BookMarked,
  CalendarClock,
  FileText,
  Gauge,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { AppLocale } from "@/i18n/routing";
import type { getStudentProgressDashboard } from "@/lib/progress/dashboard";

type Data = Awaited<ReturnType<typeof getStudentProgressDashboard>>;

const labels = {
  ar: {
    title: "ملخص رحلتك",
    pages: "صفحة متقنة",
    juz: "أجزاء مكتملة",
    percent: "من المصحف",
    speed: "صفحة أسبوعيًا",
    expected: "الإتمام المتوقع",
    attendance: "الحضور",
    radar: "ملف التقييم",
    current: "الشهر الحالي",
    previous: "السابق",
    curve: "منحنى الحفظ",
    history: "آخر التقييمات",
    review: "ورد المراجعة",
    due: "مستحق",
    overdue: "متأخر",
    homework: "الواجب الحالي",
    report: "آخر تقرير",
    download: "تنزيل التقرير",
    badges: "شاراتك",
    consistency: "استمرار أسبوعي",
    noData: "لا توجد بيانات بعد",
    criteria: ["الحفظ", "التجويد", "المخارج", "الوقف", "الأداء", "الربط", "الالتزام"],
  },
  en: {
    title: "Your journey at a glance",
    pages: "mastered pages",
    juz: "completed juz",
    percent: "of the Quran",
    speed: "pages per week",
    expected: "Expected completion",
    attendance: "Attendance",
    radar: "Evaluation profile",
    current: "Current month",
    previous: "Previous",
    curve: "Memorisation curve",
    history: "Recent evaluations",
    review: "Review portion",
    due: "Due",
    overdue: "Overdue",
    homework: "Current homework",
    report: "Latest report",
    download: "Download report",
    badges: "Your badges",
    consistency: "Weekly consistency",
    noData: "No data yet",
    criteria: [
      "Memorisation",
      "Tajweed",
      "Makharij",
      "Waqf",
      "Performance",
      "Linking",
      "Commitment",
    ],
  },
} as const;

export function StudentProgressDashboard({ locale, data }: { locale: AppLocale; data: Data }) {
  const t = labels[locale];
  const current = Object.values(data.radar.current);
  const previous = Object.values(data.radar.previous);
  return (
    <div className="mt-8 grid gap-6">
      <section aria-labelledby="journey-summary-title">
        <div className="mb-4 flex items-center gap-3">
          <Gauge className="size-6 text-secondary" aria-hidden="true" />
          <h2 id="journey-summary-title" className="text-2xl font-black text-primary">
            {t.title}
          </h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat value={data.metrics.masteredPages} label={t.pages} />
          <Stat value={data.metrics.completedJuz} label={t.juz} />
          <Stat value={`${data.metrics.percent}%`} label={t.percent} />
          <Stat value={data.metrics.weeklySpeed} label={t.speed} />
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Detail
            icon={<TrendingUp />}
            label={t.expected}
            value={data.metrics.expectedCompletion ?? t.noData}
          />
          <Detail
            icon={<Award />}
            label={t.attendance}
            value={
              data.metrics.attendanceRate == null ? t.noData : `${data.metrics.attendanceRate}%`
            }
          />
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title={t.radar} icon={<Sparkles />}>
          <RadarChart
            labels={t.criteria}
            current={current}
            previous={previous}
            currentLabel={t.current}
            previousLabel={t.previous}
          />
        </Panel>
        <Panel title={t.curve} icon={<TrendingUp />}>
          <ProgressCurve points={data.curve} emptyLabel={t.noData} />
        </Panel>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.25fr_.75fr]">
        <Panel title={t.history} icon={<CalendarClock />}>
          {data.history.length ? (
            <ol className="divide-y">
              {data.history.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-4 py-3">
                  <span className="text-sm text-muted-foreground tabular-nums">{item.date}</span>
                  <strong className="text-primary tabular-nums">
                    {item.score == null ? t.noData : `${item.score}%`}
                  </strong>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-muted-foreground">{t.noData}</p>
          )}
        </Panel>
        <div className="grid gap-4">
          <Detail
            icon={<BookMarked />}
            label={t.review}
            value={`${t.due}: ${data.review.due} · ${t.overdue}: ${data.review.overdue}`}
          />
          <Detail icon={<FileText />} label={t.homework} value={data.homework ?? t.noData} />
          {data.latestReport ? (
            <div className="rounded-3xl border bg-card p-5">
              <p className="font-black text-primary">{t.report}</p>
              <p className="mt-2 text-sm text-muted-foreground">
                {data.latestReport.period_start} — {data.latestReport.period_end}
              </p>
              <Button asChild className="mt-4" variant="outline">
                <Link href={`/api/pdf/reports/${data.latestReport.id}?locale=${locale}`}>
                  {t.download}
                </Link>
              </Button>
            </div>
          ) : null}
        </div>
      </div>

      <Panel title={t.badges} icon={<Award />}>
        <div className="flex flex-wrap gap-3">
          {data.badges.completedJuz.map((juz) => (
            <Badge key={juz} variant="secondary">
              {locale === "ar" ? `إتمام الجزء ${juz}` : `Juz ${juz} completed`}
            </Badge>
          ))}
          {data.badges.weeklyConsistency ? <Badge variant="success">{t.consistency}</Badge> : null}
          {!data.badges.completedJuz.length && !data.badges.weeklyConsistency ? (
            <span className="text-muted-foreground">{t.noData}</span>
          ) : null}
        </div>
      </Panel>
    </div>
  );
}

function Stat({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="rounded-2xl border bg-card p-5">
      <strong className="block text-3xl font-black text-primary tabular-nums">{value}</strong>
      <span className="mt-1 block text-sm text-muted-foreground">{label}</span>
    </div>
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
    <section className="rounded-3xl border bg-card p-5 sm:p-6">
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
