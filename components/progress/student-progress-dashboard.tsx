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

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { AppLocale } from "@/i18n/routing";
import type { getStudentProgressDashboard } from "@/lib/progress/dashboard";

type Data = Awaited<ReturnType<typeof getStudentProgressDashboard>>;

const labels = {
  ar: {
    title: "ملخص رحلتك",
    pages: "الصفحات المتقنة",
    juz: "أجزاء مكتملة",
    percent: "نسبة الإتقان الكلية",
    speed: "سرعة آخر أربعة أسابيع",
    expected: "التاريخ التقديري للانتهاء",
    estimate: "تقدير يتغير حسب سرعة التقدم، وليس موعدًا مؤكدًا.",
    requiredTitle: "المطلوب في الحفظ والمراجعة",
    additionalTitle: "الرسوم والتاريخ والتفاصيل الإضافية",
    definitions: {
      pages: "عدد صفحات المصحف المسجلة بحالة متقن.",
      juz: "الأجزاء التي أصبحت كل صفحاتها متقنة.",
      percent: "الصفحات المتقنة ÷ 604 صفحة.",
      speed: "الصفحات التي أتقنت خلال آخر 28 يومًا ÷ 4.",
    },
    periods: { all: "منذ بدء السجل", fourWeeks: "آخر أربعة أسابيع" },
    updated: "آخر تحديث: {date}",
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
    pages: "Mastered pages",
    juz: "completed juz",
    percent: "Overall mastery share",
    speed: "Four-week progress speed",
    expected: "Estimated completion date",
    estimate: "An estimate that changes with progress speed, not a guaranteed date.",
    requiredTitle: "Memorisation and review due",
    additionalTitle: "Charts, history, and additional details",
    definitions: {
      pages: "Quran pages currently recorded as mastered.",
      juz: "Juz whose tracked pages are all mastered.",
      percent: "Mastered pages divided by 604 Quran pages.",
      speed: "Pages first mastered in the last 28 days divided by four.",
    },
    periods: { all: "Since records began", fourWeeks: "Last four weeks" },
    updated: "Last updated: {date}",
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
  const updatedAt = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(data.metrics.updatedAt));
  return (
    <div className="student-progress-dashboard mt-6 grid gap-6">
      <section aria-labelledby="journey-summary-title">
        <div className="mb-4 flex items-center gap-3">
          <Gauge className="size-6 text-secondary" aria-hidden="true" />
          <h2 id="journey-summary-title" className="text-2xl font-black text-primary">
            {t.title}
          </h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            value={data.metrics.masteredPages}
            label={t.pages}
            icon={BookMarked}
            tone="blue"
            definition={t.definitions.pages}
            period={t.periods.all}
            updated={t.updated.replace("{date}", updatedAt)}
          />
          <Stat
            value={data.metrics.completedJuz}
            label={t.juz}
            icon={Award}
            tone="gold"
            definition={t.definitions.juz}
            period={t.periods.all}
            updated={t.updated.replace("{date}", updatedAt)}
          />
          <Stat
            value={`${data.metrics.percent}%`}
            label={t.percent}
            icon={Gauge}
            tone="violet"
            progressValue={data.metrics.percent}
            definition={t.definitions.percent}
            period={t.periods.all}
            updated={t.updated.replace("{date}", updatedAt)}
          />
          <Stat
            value={data.metrics.weeklySpeed}
            label={t.speed}
            icon={TrendingUp}
            tone="green"
            definition={t.definitions.speed}
            period={t.periods.fourWeeks}
            updated={t.updated.replace("{date}", updatedAt)}
          />
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Detail
            icon={<TrendingUp />}
            label={t.expected}
            value={data.metrics.expectedCompletion ?? t.noData}
            note={t.estimate}
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

      <section aria-labelledby="student-required-title" className="grid gap-4 sm:grid-cols-2">
        <h2 id="student-required-title" className="col-span-full text-xl font-black text-primary">
          {t.requiredTitle}
        </h2>
        <Detail
          icon={<BookMarked />}
          label={t.review}
          value={`${t.due}: ${data.review.due} · ${t.overdue}: ${data.review.overdue}`}
        />
        <Detail icon={<FileText />} label={t.homework} value={data.homework ?? t.noData} />
      </section>

      <details open className="rounded-3xl border border-secondary/20 bg-card/40 p-4">
        <summary className="cursor-pointer font-black text-primary lg:text-xl">
          {t.additionalTitle}
        </summary>
        <div className="mt-5 grid gap-6">
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
                      <span className="text-sm text-muted-foreground tabular-nums">
                        {item.date}
                      </span>
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
              {data.badges.weeklyConsistency ? (
                <Badge variant="success">{t.consistency}</Badge>
              ) : null}
              {!data.badges.completedJuz.length && !data.badges.weeklyConsistency ? (
                <span className="text-muted-foreground">{t.noData}</span>
              ) : null}
            </div>
          </Panel>
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
  definition,
  period,
  updated,
}: {
  icon: LucideIcon;
  label: string;
  progressValue?: number;
  tone: "blue" | "gold" | "green" | "violet";
  value: string | number;
  definition: string;
  period: string;
  updated: string;
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
        <details className="mt-2 text-xs text-muted-foreground">
          <summary className="cursor-pointer font-bold text-primary">{period}</summary>
          <p className="mt-1 leading-5">{definition}</p>
          <p className="mt-1">{updated}</p>
        </details>
      </div>
    </article>
  );
}
function Detail({
  icon,
  label,
  value,
  note,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  note?: string;
}) {
  return (
    <div className="flex gap-3 rounded-2xl border bg-card p-5">
      <span className="mt-0.5 text-secondary [&>svg]:size-5">{icon}</span>
      <div>
        <p className="text-sm font-bold text-primary">{label}</p>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">{value}</p>
        {note ? (
          <p className="mt-1 text-xs font-bold text-[#8a5b12] dark:text-secondary">{note}</p>
        ) : null}
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
