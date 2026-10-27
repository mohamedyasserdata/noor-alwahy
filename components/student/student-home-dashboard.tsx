import {
  Award,
  BookOpenCheck,
  CalendarCheck2,
  CalendarDays,
  ChartNoAxesCombined,
  Clock3,
  FileText,
  Sparkles,
  Target,
  TrendingUp,
  UsersRound,
} from "lucide-react";
import { getTranslations } from "next-intl/server";

import { NextSessionCard } from "@/components/sessions/next-session-card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { getStudentProgressDashboard } from "@/lib/progress/dashboard";
import { getNextSessionCard } from "@/lib/sessions/next-session";
import { cn } from "@/lib/utils";

const labels = {
  ar: {
    welcome: "مرحبًا بك مجددًا",
    heroDescription: "تابع موعدك القادم وتقدمك الفعلي من مساحة واحدة هادئة وواضحة.",
    masteredPages: "الصفحات المتقنة",
    completedJuz: "الأجزاء المكتملة",
    attendance: "نسبة الحضور",
    overallProgress: "التقدم العام في الحفظ",
    progressTitle: "تقدم حفظ القرآن الكريم",
    progressDescription: "ملخص محسوب من سجل الحفظ المعتمد دون عرض نصوص الآيات.",
    recentTitle: "آخر التقييمات",
    reviewTitle: "المراجعة الحالية",
    due: "مراجعات مستحقة",
    overdue: "مراجعات متأخرة",
    latestReport: "آخر تقرير معتمد",
    noEvaluations: "لا توجد تقييمات مقفلة حتى الآن.",
    noAttendance: "لا توجد بيانات حضور بعد",
    noReport: "لا يوجد تقرير ظاهر حتى الآن.",
    openProgress: "عرض صفحة التقدم",
    openSchedule: "عرض الجدول الكامل",
    score: "النتيجة",
    completed: "مكتمل",
  },
  en: {
    welcome: "Welcome back",
    heroDescription: "Follow your next session and real progress from one calm, clear workspace.",
    masteredPages: "Mastered pages",
    completedJuz: "Completed juz",
    attendance: "Attendance rate",
    overallProgress: "Overall memorisation progress",
    progressTitle: "Quran memorisation progress",
    progressDescription:
      "A summary calculated from the approved progress record without verse text.",
    recentTitle: "Recent evaluations",
    reviewTitle: "Current review",
    due: "Reviews due",
    overdue: "Reviews overdue",
    latestReport: "Latest approved report",
    noEvaluations: "No locked evaluations are available yet.",
    noAttendance: "No attendance data yet",
    noReport: "No report is currently visible.",
    openProgress: "View progress",
    openSchedule: "View full schedule",
    score: "Score",
    completed: "complete",
  },
} as const;

export async function StudentHomeDashboard({ locale }: { locale: AppLocale }) {
  const [nextSessionTranslations, sessionData, progressData] = await Promise.all([
    getTranslations({ locale, namespace: "nextSession" }),
    getNextSessionCard(locale),
    getStudentProgressDashboard(),
  ]);
  const t = labels[locale];
  const progress = progressData.metrics.percent;
  const attendance = progressData.metrics.attendanceRate;
  const latestHistory = progressData.history.slice(0, 4);

  const metrics = [
    {
      icon: BookOpenCheck,
      label: t.masteredPages,
      value: progressData.metrics.masteredPages,
      tone: "blue",
    },
    {
      icon: Award,
      label: t.completedJuz,
      value: progressData.metrics.completedJuz,
      tone: "gold",
    },
    {
      icon: UsersRound,
      label: t.attendance,
      value: attendance == null ? "—" : `${formatMetric(attendance)}%`,
      tone: "green",
    },
    {
      icon: ChartNoAxesCombined,
      label: t.overallProgress,
      value: `${formatMetric(progress)}%`,
      tone: "violet",
    },
  ] as const;

  return (
    <div className="student-home min-h-svh pb-12 sm:pb-16">
      <section
        className="relative min-h-[27rem] overflow-hidden bg-[url('/images/student/golden-quran-sunlit-mosque.png')] bg-cover bg-[position:38%_62%] lg:min-h-[24rem] lg:bg-[position:center_62%]"
        aria-labelledby="student-home-title"
      >
        <div
          className="absolute inset-0 bg-linear-to-b from-[#fffaf0]/5 via-[#fffaf0]/55 to-[#fffaf0] lg:bg-linear-to-r lg:from-transparent lg:via-[#fffaf0]/35 lg:to-[#fffaf0]/95 dark:from-[#091a33]/30 dark:via-[#091a33]/75 dark:to-[#091a33] lg:dark:from-[#091a33]/20 lg:dark:via-[#091a33]/65 lg:dark:to-[#091a33]/95"
          aria-hidden="true"
        />
        <div
          className="relative mx-auto grid min-h-[27rem] w-full max-w-[100rem] items-end px-5 pt-16 pb-24 sm:px-8 lg:min-h-[24rem] lg:grid-cols-2 lg:items-center lg:px-12 lg:py-12"
          dir="ltr"
        >
          <span aria-hidden="true" />
          <header
            className="max-w-2xl rounded-3xl bg-[#fffaf0]/72 p-5 backdrop-blur-[2px] sm:p-7 lg:bg-transparent lg:p-0 lg:backdrop-blur-none dark:bg-[#091a33]/72 lg:dark:bg-transparent"
            dir={locale === "ar" ? "rtl" : "ltr"}
          >
            <p className="text-sm font-black text-[#b77b19] sm:text-base">
              {t.welcome}، {progressData.student.name}
            </p>
            <h1
              id="student-home-title"
              className="mt-2 text-4xl leading-tight font-black text-balance text-[#0b2b57] sm:text-5xl dark:text-primary"
            >
              {nextSessionTranslations("title")}
            </h1>
            <p className="mt-3 max-w-xl text-base leading-8 text-[#5d6f86] sm:text-lg dark:text-muted-foreground">
              {t.heroDescription}
            </p>
          </header>
        </div>
      </section>

      <div className="relative z-10 mx-auto -mt-16 w-full max-w-[100rem] px-4 sm:px-6 lg:px-10">
        <NextSessionCard
          appearance="student-home"
          serverNowMs={sessionData.serverNowMs}
          session={sessionData.session}
        />

        <section
          className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
          aria-label={t.progressTitle}
        >
          {metrics.map((metric) => (
            <MetricCard key={metric.label} {...metric} />
          ))}
        </section>

        <div className="mt-5 grid gap-5 xl:grid-cols-[1.1fr_0.95fr_0.95fr]">
          <section className="rounded-[1.75rem] border border-secondary/20 bg-card/96 p-5 shadow-card sm:p-7">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="flex items-center gap-2 text-xl font-black text-primary sm:text-2xl">
                  <Sparkles className="size-6 text-secondary" aria-hidden="true" />
                  {t.progressTitle}
                </h2>
                <p className="mt-2 leading-7 text-muted-foreground">{t.progressDescription}</p>
              </div>
              <Button asChild variant="outline" className="border-secondary/40">
                <Link href="/student/progress">{t.openProgress}</Link>
              </Button>
            </div>

            <div className="mt-7 grid items-center gap-8 min-[1500px]:grid-cols-[13rem_minmax(0,1fr)] lg:grid-cols-[14rem_minmax(0,1fr)] xl:grid-cols-1">
              <ProgressRing
                label={t.overallProgress}
                value={progress}
                completedLabel={t.completed}
              />
              <div className="grid gap-5">
                <ProgressLine
                  icon={BookOpenCheck}
                  label={t.masteredPages}
                  value={progressData.metrics.masteredPages}
                  percent={progress}
                />
                <div className="grid grid-cols-2 gap-3">
                  <SmallStat
                    icon={Award}
                    label={t.completedJuz}
                    value={progressData.metrics.completedJuz}
                  />
                  <SmallStat
                    icon={TrendingUp}
                    label={t.attendance}
                    value={attendance == null ? "—" : `${formatMetric(attendance)}%`}
                  />
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-[1.75rem] border border-secondary/20 bg-card/96 p-5 shadow-card sm:p-7">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-xl font-black text-primary">
                <CalendarCheck2 className="size-6 text-secondary" aria-hidden="true" />
                {t.recentTitle}
              </h2>
              <Button asChild variant="ghost" size="sm" className="min-h-11">
                <Link href="/student/progress">{t.openProgress}</Link>
              </Button>
            </div>

            {latestHistory.length ? (
              <ol className="mt-5 divide-y divide-secondary/15">
                {latestHistory.map((item) => (
                  <li key={item.id} className="flex items-center gap-4 py-4">
                    <span className="grid size-11 shrink-0 place-items-center rounded-full bg-[#edf4ff] text-[#245fa8] dark:bg-accent">
                      <Target className="size-5" aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-black text-primary">{t.score}</p>
                      <time className="text-sm text-muted-foreground" dateTime={item.date}>
                        {item.date}
                      </time>
                    </div>
                    <strong className="text-lg font-black text-[#237a4b] tabular-nums dark:text-success">
                      {item.score == null ? "—" : `${formatMetric(item.score)}%`}
                    </strong>
                  </li>
                ))}
              </ol>
            ) : (
              <EmptyPanel icon={CalendarDays} text={t.noEvaluations} />
            )}
          </section>

          <section className="rounded-[1.75rem] border border-secondary/20 bg-card/96 p-5 shadow-card sm:p-7">
            <h2 className="flex items-center gap-2 text-xl font-black text-primary">
              <Clock3 className="size-6 text-secondary" aria-hidden="true" />
              {t.reviewTitle}
            </h2>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <SmallStat icon={BookOpenCheck} label={t.due} value={progressData.review.due} />
              <SmallStat icon={Clock3} label={t.overdue} value={progressData.review.overdue} />
            </div>
            <Button asChild className="mt-5 w-full" variant="outline">
              <Link href="/student/progress">{t.openProgress}</Link>
            </Button>
          </section>
        </div>

        <div className="mt-5">
          <section className="rounded-[1.75rem] border border-secondary/20 bg-card/96 p-5 shadow-card sm:p-7">
            <h2 className="flex items-center gap-2 text-xl font-black text-primary">
              <FileText className="size-6 text-secondary" aria-hidden="true" />
              {t.latestReport}
            </h2>
            {progressData.latestReport ? (
              <div className="mt-5 rounded-2xl bg-[#f8f1e2] p-5 dark:bg-accent/45">
                <p className="font-black text-primary">
                  {progressData.latestReport.period_start} — {progressData.latestReport.period_end}
                </p>
                <Button asChild variant="outline" className="mt-4 border-secondary/40">
                  <a href={`/api/pdf/reports/${progressData.latestReport.id}?locale=${locale}`}>
                    {t.latestReport}
                  </a>
                </Button>
              </div>
            ) : (
              <EmptyPanel icon={FileText} text={t.noReport} />
            )}
            <Button asChild className="mt-5 w-full" variant="ghost">
              <Link href="/student/schedule">{t.openSchedule}</Link>
            </Button>
          </section>
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  tone,
  value,
}: {
  icon: typeof Award;
  label: string;
  tone: "blue" | "gold" | "green" | "violet";
  value: number | string;
}) {
  const tones = {
    blue: "border-[#bfd8fb] bg-[#f1f7ff] text-[#1f5c9e] dark:border-border dark:bg-card",
    gold: "border-[#ead6ad] bg-[#fff9ec] text-[#a66d10] dark:border-border dark:bg-card",
    green: "border-[#bfe2ce] bg-[#f0faf4] text-[#237a4b] dark:border-border dark:bg-card",
    violet: "border-[#d5d0f5] bg-[#f7f5ff] text-[#5b55bd] dark:border-border dark:bg-card",
  } as const;

  return (
    <article className={cn("flex min-h-28 items-center gap-4 rounded-2xl border p-5", tones[tone])}>
      <span className="grid size-12 shrink-0 place-items-center rounded-full bg-current/10">
        <Icon className="size-6" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-bold text-primary">{label}</p>
        <strong className="mt-1 block text-2xl font-black text-primary tabular-nums">
          {value}
        </strong>
      </div>
    </article>
  );
}

function ProgressRing({
  completedLabel,
  label,
  value,
}: {
  completedLabel: string;
  label: string;
  value: number;
}) {
  const normalized = Math.min(100, Math.max(0, value));
  const radius = 74;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (normalized / 100) * circumference;

  return (
    <div
      className="relative mx-auto size-52"
      role="progressbar"
      aria-label={label}
      aria-valuenow={normalized}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <svg viewBox="0 0 176 176" className="size-full -rotate-90" aria-hidden="true">
        <circle
          cx="88"
          cy="88"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="14"
          className="text-[#f1e5cd] dark:text-muted"
        />
        <circle
          cx="88"
          cy="88"
          r={radius}
          fill="none"
          stroke="url(#student-progress-gold)"
          strokeWidth="14"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
        />
        <defs>
          <linearGradient id="student-progress-gold" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#e3bd65" />
            <stop offset="1" stopColor="#a96f11" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 grid place-content-center text-center">
        <strong className="text-4xl font-black text-primary tabular-nums">
          {formatMetric(normalized)}%
        </strong>
        <span className="mt-1 text-sm font-bold text-muted-foreground">{completedLabel}</span>
      </div>
    </div>
  );
}

function ProgressLine({
  icon: Icon,
  label,
  percent,
  value,
}: {
  icon: typeof Award;
  label: string;
  percent: number;
  value: number;
}) {
  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 font-black text-primary">
          <Icon className="size-5 text-secondary" aria-hidden="true" />
          {label}
        </span>
        <strong className="text-xl font-black text-primary tabular-nums">{value}</strong>
      </div>
      <Progress value={percent} aria-label={label} />
    </div>
  );
}

function SmallStat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Award;
  label: string;
  value: number | string;
}) {
  return (
    <div className="rounded-2xl border border-secondary/20 bg-[#fffaf0] p-4 dark:bg-accent/35">
      <Icon className="size-5 text-secondary" aria-hidden="true" />
      <strong className="mt-3 block text-2xl font-black text-primary tabular-nums">{value}</strong>
      <span className="mt-1 block text-sm text-muted-foreground">{label}</span>
    </div>
  );
}

function EmptyPanel({ icon: Icon, text }: { icon: typeof Award; text: string }) {
  return (
    <div className="mt-5 flex min-h-36 flex-col items-center justify-center rounded-2xl border border-dashed border-secondary/35 bg-[#fffaf0]/60 p-6 text-center dark:bg-accent/20">
      <Icon className="size-7 text-secondary" aria-hidden="true" />
      <p className="mt-3 text-sm leading-6 text-muted-foreground">{text}</p>
    </div>
  );
}

function formatMetric(value: number) {
  return Number.isInteger(value) ? value.toString() : value.toFixed(1);
}
