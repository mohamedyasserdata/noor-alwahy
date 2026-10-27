import {
  BookOpenCheck,
  CalendarCheck2,
  CalendarClock,
  Clock3,
  Download,
  FileText,
  MessageSquareText,
  RotateCcw,
  Target,
  UserRoundCheck,
  Video,
} from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { AppLocale } from "@/i18n/routing";
import type { getStudentMemorizationPlan } from "@/lib/memorization-plans/queries";
import type { getGuardianChildDetails } from "@/lib/parent/child-details";
import type { getStudentProgressDashboard } from "@/lib/progress/dashboard";

type Details = Awaited<ReturnType<typeof getGuardianChildDetails>>;
type Dashboard = Awaited<ReturnType<typeof getStudentProgressDashboard>>;
type Plan = Awaited<ReturnType<typeof getStudentMemorizationPlan>>;

export async function ChildOverviewPanel({
  dashboard,
  details,
  locale,
}: {
  dashboard: Dashboard;
  details: Details;
  locale: AppLocale;
}) {
  const t = await getTranslations({ locale, namespace: "parentPortal" });
  const latestSession = details.schedule.upcoming[0] ?? null;
  return (
    <div className="grid gap-5 xl:grid-cols-3">
      <Panel icon={BookOpenCheck} title={t("overview.learning")}>
        {details.progress.mastered + details.progress.inProgress + details.progress.needsReview ? (
          <>
            <Definition
              label={t("overview.mastered")}
              value={formatCount(dashboard.metrics.masteredPages, locale)}
            />
            <Definition
              label={t("overview.reviewDue")}
              value={formatCount(dashboard.review.due, locale)}
            />
          </>
        ) : (
          <Empty text={t("empty.noProgress")} />
        )}
        <Definition
          label={t("overview.attendance")}
          value={
            details.attendance.rate == null
              ? t("empty.noAttendance")
              : formatPercent(details.attendance.rate, locale)
          }
        />
      </Panel>
      <Panel icon={CalendarCheck2} title={t("overview.latestEvaluation")}>
        {details.latestEvaluation ? (
          <>
            <strong className="block text-4xl font-black text-primary tabular-nums">
              {formatPercent(details.latestEvaluation.score, locale)}
            </strong>
            <time
              className="mt-3 block text-sm text-muted-foreground"
              dateTime={details.latestEvaluation.lockedAt ?? details.latestEvaluation.sessionAt}
            >
              {formatDate(
                details.latestEvaluation.lockedAt ?? details.latestEvaluation.sessionAt,
                locale,
                details.child.timezone,
              )}
            </time>
          </>
        ) : (
          <Empty text={t("empty.noEvaluation")} />
        )}
      </Panel>
      <Panel icon={CalendarClock} title={t("overview.nextSession")}>
        {latestSession ? (
          <>
            <p className="font-black text-primary">
              {formatDateTime(latestSession.scheduledAt, locale, details.child.timezone)}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {latestSession.teacherName ?? t("empty.noTeacher")}
            </p>
          </>
        ) : (
          <Empty text={t("empty.noUpcomingSession")} />
        )}
      </Panel>
      <section
        className="rounded-[1.75rem] border border-secondary/20 bg-card/96 p-5 shadow-card sm:p-7 xl:col-span-2"
        aria-labelledby="family-note-title"
      >
        <h2
          id="family-note-title"
          className="flex items-center gap-2 text-xl font-black text-primary"
        >
          <MessageSquareText className="size-5 text-secondary" aria-hidden="true" />
          {t("overview.familyNote")}
        </h2>
        {details.familyNote ? (
          <blockquote className="mt-5 rounded-2xl bg-[#fff8e9] p-5 leading-8 text-muted-foreground dark:bg-accent/35">
            <p className="break-words">{details.familyNote.text}</p>
            <footer className="mt-4 text-sm font-bold text-primary">
              {details.familyNote.teacherName ?? t("empty.noTeacher")} ·{" "}
              {formatDate(details.familyNote.sessionAt, locale, details.child.timezone)}
            </footer>
          </blockquote>
        ) : (
          <Empty text={t("empty.noFamilyNote")} />
        )}
      </section>
      <Panel icon={FileText} title={t("overview.latestReport")}>
        {details.reports[0] ? (
          <>
            <p className="font-black text-primary">
              {formatPeriod(details.reports[0].period_start, details.reports[0].period_end, locale)}
            </p>
            <Button asChild variant="outline" className="mt-4 w-full border-secondary/40">
              <a href={`/api/pdf/reports/${details.reports[0].id}?locale=${locale}`}>
                <Download aria-hidden="true" />
                {t("reports.download")}
              </a>
            </Button>
          </>
        ) : (
          <Empty text={t("empty.noReports")} />
        )}
      </Panel>
    </div>
  );
}

export async function ChildProgressPanel({
  dashboard,
  details,
  locale,
  plan,
}: {
  dashboard: Dashboard;
  details: Details;
  locale: AppLocale;
  plan: Plan;
}) {
  const t = await getTranslations({ locale, namespace: "parentPortal" });
  const percent = dashboard.metrics.percent;
  return (
    <div className="grid gap-5 xl:grid-cols-[1.1fr_.9fr]">
      <section
        className="rounded-[1.75rem] border border-secondary/20 bg-card/96 p-5 shadow-card sm:p-7"
        aria-labelledby="memorization-progress-title"
      >
        <h2
          id="memorization-progress-title"
          className="flex items-center gap-2 text-xl font-black text-primary"
        >
          <BookOpenCheck className="size-5 text-secondary" aria-hidden="true" />
          {t("progress.title")}
        </h2>
        {details.progress.mastered + details.progress.inProgress + details.progress.needsReview ? (
          <div className="mt-6 grid items-center gap-8 md:grid-cols-[13rem_minmax(0,1fr)]">
            <ProgressRing value={percent} label={t("progress.percentage")} locale={locale} />
            <div className="grid gap-5">
              <ProgressMetric
                label={t("progress.mastered")}
                value={details.progress.mastered}
                percent={percent}
              />
              <ProgressMetric
                label={t("progress.inProgress")}
                value={details.progress.inProgress}
                percent={Math.min(100, (details.progress.inProgress / 604) * 100)}
              />
              <ProgressMetric
                label={t("progress.needsReview")}
                value={details.progress.needsReview}
                percent={Math.min(100, (details.progress.needsReview / 604) * 100)}
              />
            </div>
          </div>
        ) : (
          <Empty text={t("empty.noProgress")} />
        )}
        {details.progress.lastUpdatedAt ? (
          <p className="mt-5 text-xs text-muted-foreground">
            {t("progress.lastUpdated", {
              date: formatDate(details.progress.lastUpdatedAt, locale, details.child.timezone),
            })}
          </p>
        ) : null}
      </section>
      <section
        className="rounded-[1.75rem] border border-secondary/20 bg-card/96 p-5 shadow-card sm:p-7"
        aria-labelledby="current-goals-title"
      >
        <h2
          id="current-goals-title"
          className="flex items-center gap-2 text-xl font-black text-primary"
        >
          <Target className="size-5 text-secondary" aria-hidden="true" />
          {t("progress.currentGoals")}
        </h2>
        {plan ? (
          <dl className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
            <Goal
              label={t("progress.weeklyGoal")}
              achieved={plan.weekly_achieved_pages}
              target={plan.weekly_target_pages}
              locale={locale}
            />
            <Goal
              label={t("progress.monthlyGoal")}
              achieved={plan.monthly_achieved_pages}
              target={plan.monthly_target_pages}
              locale={locale}
            />
          </dl>
        ) : (
          <Empty text={t("empty.noGoals")} />
        )}
      </section>
    </div>
  );
}

export async function AttendancePanel({
  attendance,
  locale,
  timezone,
}: {
  attendance: Details["attendance"];
  locale: AppLocale;
  timezone: string;
}) {
  const t = await getTranslations({ locale, namespace: "parentPortal" });
  return (
    <div className="grid gap-5">
      <section
        className="rounded-[1.75rem] border border-secondary/20 bg-card/96 p-5 shadow-card sm:p-7"
        aria-labelledby="attendance-summary-title"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2
            id="attendance-summary-title"
            className="flex items-center gap-2 text-xl font-black text-primary"
          >
            <UserRoundCheck className="size-5 text-secondary" aria-hidden="true" />
            {t("attendance.title")}
          </h2>
          <Badge variant="outline">{t("attendance.period", { days: attendance.periodDays })}</Badge>
        </div>
        {attendance.total ? (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <AttendanceStat
              label={t("attendance.rate")}
              value={formatPercent(attendance.rate ?? 0, locale)}
              tone="gold"
            />
            <AttendanceStat
              label={t("attendance.total")}
              value={formatCount(attendance.total, locale)}
              tone="blue"
            />
            <AttendanceStat
              label={t("attendance.present")}
              value={formatCount(attendance.present, locale)}
              tone="green"
            />
            <AttendanceStat
              label={t("attendance.late")}
              value={formatCount(attendance.late, locale)}
              tone="gold"
            />
            <AttendanceStat
              label={t("attendance.absent")}
              value={formatCount(attendance.absent + attendance.excused, locale)}
              tone="red"
            />
          </div>
        ) : (
          <Empty text={t("empty.noAttendance")} />
        )}
      </section>
      {attendance.records.length ? (
        <section
          className="rounded-[1.75rem] border border-secondary/20 bg-card/96 p-5 shadow-card sm:p-7"
          aria-labelledby="attendance-history-title"
        >
          <h2 id="attendance-history-title" className="text-xl font-black text-primary">
            {t("attendance.history")}
          </h2>
          <ol className="mt-5 divide-y divide-secondary/15">
            {attendance.records.map((record) => (
              <li
                key={record.id}
                className="flex flex-wrap items-center justify-between gap-3 py-4"
              >
                <time className="font-bold text-primary" dateTime={record.scheduledAt}>
                  {formatDateTime(record.scheduledAt, locale, timezone)}
                </time>
                <Badge variant={attendanceVariant(record.status)}>
                  {t(`attendance.statuses.${record.status}`)}
                </Badge>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </div>
  );
}

export async function ChildReportsPanel({
  locale,
  reports,
}: {
  locale: AppLocale;
  reports: Details["reports"];
}) {
  const t = await getTranslations({ locale, namespace: "parentPortal" });
  return reports.length ? (
    <div className="grid gap-4 lg:grid-cols-2">
      {reports.map((report) => (
        <article
          key={report.id}
          className="rounded-[1.75rem] border border-secondary/20 bg-card/96 p-5 shadow-card sm:p-7"
        >
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-xl font-black text-primary">
              {formatPeriod(report.period_start, report.period_end, locale)}
            </h2>
            <Badge variant="success">{t("reports.published")}</Badge>
          </div>
          {report.summary ? (
            <p className="mt-4 leading-7 break-words text-muted-foreground">{report.summary}</p>
          ) : null}
          {report.recommendation ? (
            <div className="mt-4 rounded-2xl bg-[#fff8e9] p-4 text-sm leading-7 text-muted-foreground dark:bg-accent/35">
              <strong className="block text-primary">{t("reports.recommendation")}</strong>
              {report.recommendation}
            </div>
          ) : null}
          <Button asChild variant="outline" className="mt-5 w-full border-secondary/40">
            <a href={`/api/pdf/reports/${report.id}?locale=${locale}`}>
              <Download aria-hidden="true" />
              {t("reports.download")}
            </a>
          </Button>
        </article>
      ))}
    </div>
  ) : (
    <section className="rounded-[1.75rem] border border-secondary/20 bg-card/96 p-7 shadow-card">
      <Empty text={t("empty.noReports")} />
    </section>
  );
}

export async function ChildSchedulePanel({
  locale,
  schedule,
  timezone,
}: {
  locale: AppLocale;
  schedule: Details["schedule"];
  timezone: string;
}) {
  const t = await getTranslations({ locale, namespace: "parentPortal" });
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <SessionList
        title={t("schedule.upcoming")}
        empty={t("empty.noUpcomingSession")}
        sessions={schedule.upcoming}
        locale={locale}
        timezone={timezone}
        t={t}
        upcoming
      />
      <SessionList
        title={t("schedule.previous")}
        empty={t("empty.noPreviousSession")}
        sessions={schedule.past}
        locale={locale}
        timezone={timezone}
        t={t}
      />
    </div>
  );
}

function Panel({
  children,
  icon: Icon,
  title,
}: {
  children: React.ReactNode;
  icon: typeof BookOpenCheck;
  title: string;
}) {
  return (
    <section className="rounded-[1.75rem] border border-secondary/20 bg-card/96 p-5 shadow-card sm:p-7">
      <h2 className="flex items-center gap-2 text-xl font-black text-primary">
        <Icon className="size-5 text-secondary" aria-hidden="true" />
        {title}
      </h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}
function Definition({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-secondary/15 py-3 last:border-0">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="font-black text-primary tabular-nums">{value}</dd>
    </div>
  );
}
function Empty({ text }: { text: string }) {
  return (
    <p className="mt-5 rounded-2xl border border-dashed border-secondary/35 bg-[#fffaf0]/60 p-5 text-center text-sm leading-7 text-muted-foreground dark:bg-accent/20">
      {text}
    </p>
  );
}
function ProgressRing({
  label,
  locale,
  value,
}: {
  label: string;
  locale: AppLocale;
  value: number;
}) {
  const normalized = Math.min(100, Math.max(0, value));
  return (
    <div
      className="relative mx-auto grid size-48 place-items-center rounded-full p-4"
      style={{ background: `conic-gradient(#c7a45a ${normalized * 3.6}deg,#f1e5cd 0deg)` }}
      role="progressbar"
      aria-label={label}
      aria-valuenow={normalized}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <span className="grid size-full place-content-center rounded-full bg-card text-center">
        <strong className="text-4xl font-black text-primary tabular-nums">
          {formatPercent(normalized, locale)}
        </strong>
        <span className="mt-1 text-xs font-bold text-muted-foreground">{label}</span>
      </span>
    </div>
  );
}
function ProgressMetric({
  label,
  percent,
  value,
}: {
  label: string;
  percent: number;
  value: number;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3 text-sm">
        <span className="font-bold text-primary">{label}</span>
        <strong className="text-primary tabular-nums">{value}</strong>
      </div>
      <Progress value={percent} aria-label={label} />
    </div>
  );
}
function Goal({
  achieved,
  label,
  locale,
  target,
}: {
  achieved: number | null;
  label: string;
  locale: AppLocale;
  target: number | null;
}) {
  const safeTarget = target ?? 0;
  const safeAchieved = achieved ?? 0;
  const percent = safeTarget ? Math.min(100, (safeAchieved / safeTarget) * 100) : 0;
  return (
    <div className="rounded-2xl border border-secondary/20 bg-background/70 p-5">
      <dt className="font-black text-primary">{label}</dt>
      <dd className="mt-3">
        <span className="text-2xl font-black text-primary tabular-nums">
          {formatCount(safeAchieved, locale)}
        </span>
        <span className="text-sm text-muted-foreground"> / {formatCount(safeTarget, locale)}</span>
        <Progress className="mt-3" value={percent} aria-label={label} />
      </dd>
    </div>
  );
}
function AttendanceStat({
  label,
  tone,
  value,
}: {
  label: string;
  tone: "blue" | "gold" | "green" | "red";
  value: string;
}) {
  const tones = {
    blue: "bg-[#edf4ff]",
    gold: "bg-[#fff8e9]",
    green: "bg-[#eff9f2]",
    red: "bg-[#fff0f0]",
  };
  return (
    <div className={`rounded-2xl p-4 dark:bg-accent/35 ${tones[tone]}`}>
      <strong className="block text-2xl font-black text-primary tabular-nums">{value}</strong>
      <span className="mt-1 block text-sm text-muted-foreground">{label}</span>
    </div>
  );
}
function attendanceVariant(status: string) {
  return status === "present"
    ? ("success" as const)
    : status === "late"
      ? ("secondary" as const)
      : status.includes("absent")
        ? ("destructive" as const)
        : ("outline" as const);
}

type SessionItem = Details["schedule"]["upcoming"][number];
type TFunction = Awaited<ReturnType<typeof getTranslations>>;
function SessionList({
  empty,
  locale,
  sessions,
  t,
  timezone,
  upcoming = false,
  title,
}: {
  empty: string;
  locale: AppLocale;
  sessions: SessionItem[];
  t: TFunction;
  timezone: string;
  upcoming?: boolean;
  title: string;
}) {
  return (
    <section className="rounded-[1.75rem] border border-secondary/20 bg-card/96 p-5 shadow-card sm:p-7">
      <h2 className="flex items-center gap-2 text-xl font-black text-primary">
        {upcoming ? (
          <Clock3 className="size-5 text-secondary" aria-hidden="true" />
        ) : (
          <RotateCcw className="size-5 text-secondary" aria-hidden="true" />
        )}
        {title}
      </h2>
      {sessions.length ? (
        <ol className="mt-5 divide-y divide-secondary/15">
          {sessions.map((session) => (
            <li key={session.id} className="py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <time className="font-black text-primary" dateTime={session.scheduledAt}>
                    {formatDateTime(session.scheduledAt, locale, timezone)}
                  </time>
                  <p className="mt-1 text-sm text-muted-foreground">{session.teacherName ?? "—"}</p>
                </div>
                <Badge variant="outline">{t(`schedule.statuses.${session.status}`)}</Badge>
              </div>
              {session.joinUrl ? (
                <div className="mt-3 rounded-2xl border border-secondary/20 bg-[#fff8e9] p-4 dark:bg-accent/35">
                  {session.meetingId || session.passcode ? (
                    <dl className="mb-3 grid gap-2 text-sm sm:grid-cols-2">
                      {session.meetingId ? (
                        <div>
                          <dt className="text-muted-foreground">{t("schedule.meetingId")}</dt>
                          <dd className="font-bold text-primary tabular-nums">
                            {session.meetingId}
                          </dd>
                        </div>
                      ) : null}
                      {session.passcode ? (
                        <div>
                          <dt className="text-muted-foreground">{t("schedule.passcode")}</dt>
                          <dd className="font-bold text-primary tabular-nums">
                            {session.passcode}
                          </dd>
                        </div>
                      ) : null}
                    </dl>
                  ) : null}
                  <Button asChild size="sm">
                    <a href={session.joinUrl} target="_blank" rel="noreferrer">
                      <Video aria-hidden="true" />
                      {t("schedule.join")}
                    </a>
                  </Button>
                </div>
              ) : null}
            </li>
          ))}
        </ol>
      ) : (
        <Empty text={empty} />
      )}
    </section>
  );
}
function formatCount(value: number, locale: AppLocale) {
  return new Intl.NumberFormat(locale).format(value);
}
function formatPercent(value: number, locale: AppLocale) {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value) + "%";
}
function formatDate(value: string, locale: AppLocale, timeZone: string) {
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone }).format(new Date(value));
}
function formatDateTime(value: string, locale: AppLocale, timeZone: string) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  }).format(new Date(value));
}
function formatPeriod(start: string, end: string, locale: AppLocale) {
  const f = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" });
  return `${f.format(new Date(start + "T00:00:00Z"))} – ${f.format(new Date(end + "T00:00:00Z"))}`;
}
