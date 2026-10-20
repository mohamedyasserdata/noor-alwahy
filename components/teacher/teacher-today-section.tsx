import {
  AlertTriangle,
  BookOpenCheck,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileClock,
  ListChecks,
  UserRoundCheck,
} from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { AdminSubmitButton } from "@/components/admin/admin-submit-button";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { AppLocale } from "@/i18n/routing";
import { recordAttendanceAction } from "@/lib/attendance/actions";
import { getTeacherTodaySessions } from "@/lib/attendance/queries";
import { attendanceStatuses, type AttendanceStatus } from "@/lib/validators/attendance";

type Query = Promise<Record<string, string | string[] | undefined>>;
const attendanceErrorCodes = [
  "invalid_fields",
  "attendance_forbidden",
  "attendance_conflict",
  "teacher_rate_missing",
  "active_subscription_required",
  "profile_missing",
  "request_failed",
] as const;

export async function TeacherTodaySection({
  locale,
  searchParams,
}: {
  locale: AppLocale;
  searchParams: Query;
}) {
  const [t, day, query] = await Promise.all([
    getTranslations({ locale, namespace: "teacherToday" }),
    getTeacherTodaySessions(),
    searchParams,
  ]);
  const status = typeof query.attendanceStatus === "string" ? query.attendanceStatus : "";
  const requestedError = typeof query.attendanceError === "string" ? query.attendanceError : "";
  const error = attendanceErrorCodes.includes(
    requestedError as (typeof attendanceErrorCodes)[number],
  )
    ? (requestedError as (typeof attendanceErrorCodes)[number])
    : requestedError
      ? "request_failed"
      : "";
  const timeFormatter = new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: day?.timezone,
  });
  const dateFormatter = new Intl.DateTimeFormat(locale, {
    dateStyle: "full",
    timeZone: day?.timezone,
  });

  return (
    <section className="mx-auto w-full max-w-5xl" aria-labelledby="teacher-today-title">
      <header className="max-w-3xl">
        <p className="mb-3 text-sm font-black text-secondary">{t("eyebrow")}</p>
        <h1
          id="teacher-today-title"
          className="scroll-mt-24 text-3xl font-black text-balance text-primary sm:text-4xl"
        >
          {t("title")}
        </h1>
        <p className="mt-4 leading-8 text-muted-foreground">{t("description")}</p>
      </header>

      {status === "saved" ? (
        <Alert className="mt-6" variant="success" aria-live="polite">
          {t("notices.saved")}
        </Alert>
      ) : null}
      {error ? (
        <Alert className="mt-6" variant="warning" aria-live="polite">
          {t(`errors.${error}`)}
        </Alert>
      ) : null}

      {!day ? (
        <Alert className="mt-8" variant="warning">
          {t("errors.profile_missing")}
        </Alert>
      ) : (
        <div className="mt-8">
          <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <OverviewCard
              icon={<AlertTriangle />}
              label={t("overview.absent")}
              value={day.overview.absentStudents.length}
              detail={day.overview.absentStudents.join("، ") || t("overview.none")}
            />
            <OverviewCard
              icon={<Clock3 />}
              label={t("overview.late")}
              value={day.overview.lateStudents.length}
              detail={day.overview.lateStudents.join("، ") || t("overview.none")}
            />
            <OverviewCard
              icon={<ListChecks />}
              label={t("overview.tasks")}
              value={day.overview.pendingAttendance + day.overview.pendingEvaluations.length}
              detail={t("overview.tasksDetail", {
                attendance: day.overview.pendingAttendance,
                evaluations: day.overview.pendingEvaluations.length,
              })}
            />
            <OverviewCard
              icon={<FileClock />}
              label={t("overview.reports")}
              value={day.overview.reportReminders.length}
              detail={
                day.overview.reportReminders.map((item) => item.studentName).join("، ") ||
                t("overview.none")
              }
              href={`/${locale}/teacher/reports`}
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-5">
            <div className="flex items-center gap-3">
              <span className="grid size-11 place-items-center rounded-2xl bg-primary text-secondary">
                <CalendarDays className="size-5" aria-hidden="true" />
              </span>
              <div>
                <h2 className="font-black text-primary">{t("dayTitle")}</h2>
                <p className="text-sm text-muted-foreground">
                  {dateFormatter.format(new Date(day.dateInstant))}
                </p>
              </div>
            </div>
            <Badge variant="secondary">{t("sessionCount", { count: day.sessions.length })}</Badge>
          </div>

          {day.sessions.length === 0 ? (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>{t("emptyTitle")}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="leading-7 text-muted-foreground">{t("emptyDescription")}</p>
              </CardContent>
            </Card>
          ) : (
            <ol className="mt-6 flex flex-col gap-4">
              {day.sessions.map((session) => (
                <li key={session.id} className="border-s-2 border-secondary/50 ps-4 sm:ps-6">
                  <Card>
                    <CardContent className="grid gap-5 pt-5 sm:grid-cols-[9rem_minmax(0,1fr)] sm:pt-6">
                      <div>
                        <p className="flex items-center gap-2 text-lg font-black text-primary">
                          <Clock3 className="size-4 text-secondary" aria-hidden="true" />
                          {timeFormatter.format(new Date(session.scheduled_at))}
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {t("duration", { count: session.duration_min })}
                        </p>
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <h3 className="flex min-w-0 items-center gap-2 font-black text-primary">
                            <UserRoundCheck
                              className="size-5 shrink-0 text-secondary"
                              aria-hidden="true"
                            />
                            <span className="truncate">{session.studentName}</span>
                          </h3>
                          {session.attendance ? (
                            <Badge variant={badgeVariant(session.attendance.status)}>
                              <CheckCircle2 aria-hidden="true" />
                              {t(`statuses.${session.attendance.status}`)}
                            </Badge>
                          ) : (
                            <Badge variant="outline">{t("awaitingAttendance")}</Badge>
                          )}
                        </div>

                        <Card className="mt-5 shadow-none hover:shadow-none">
                          <CardHeader className="flex-row items-start justify-between gap-3 pb-3">
                            <div>
                              <CardTitle className="flex items-center gap-2 text-base">
                                <BookOpenCheck className="text-secondary" aria-hidden="true" />
                                {t("reviewQueue.title")}
                              </CardTitle>
                              <CardDescription>{t("reviewQueue.description")}</CardDescription>
                            </div>
                            <Badge variant="secondary">
                              {t("reviewQueue.count", { count: session.reviewQueue.length })}
                            </Badge>
                          </CardHeader>
                          <CardContent>
                            {session.reviewQueue.length === 0 ? (
                              <p className="text-sm text-muted-foreground">
                                {t("reviewQueue.empty")}
                              </p>
                            ) : (
                              <ol className="flex flex-wrap gap-2">
                                {session.reviewQueue.map((item) => (
                                  <li key={item.page}>
                                    <Badge variant={item.is_overdue ? "warning" : "outline"}>
                                      {t("reviewQueue.page", { page: item.page })}
                                      {item.is_overdue ? ` · ${t("reviewQueue.overdue")}` : ""}
                                    </Badge>
                                  </li>
                                ))}
                              </ol>
                            )}
                          </CardContent>
                        </Card>

                        {session.attendance ? (
                          <p className="mt-4 text-sm leading-6 text-muted-foreground">
                            {t("recorded")}
                          </p>
                        ) : (
                          <div className="mt-5">
                            <p className="text-sm font-bold text-foreground">{t("chooseResult")}</p>
                            <div className="mt-3 flex flex-wrap gap-2">
                              {attendanceStatuses.map((attendanceStatus) => (
                                <form
                                  action={recordAttendanceAction.bind(null, locale)}
                                  key={attendanceStatus}
                                >
                                  <input type="hidden" name="sessionId" value={session.id} />
                                  <input type="hidden" name="status" value={attendanceStatus} />
                                  <AdminSubmitButton
                                    label={t(`statuses.${attendanceStatus}`)}
                                    pendingLabel={t("saving")}
                                    variant={buttonVariant(attendanceStatus)}
                                  />
                                </form>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ol>
          )}

          <p className="mt-5 text-sm leading-7 text-muted-foreground">
            {t("timezone", { timezone: day.timezone })}
          </p>
        </div>
      )}
    </section>
  );
}

function OverviewCard({
  icon,
  label,
  value,
  detail,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  detail: string;
  href?: string;
}) {
  const content = (
    <>
      <span className="grid size-10 place-items-center rounded-xl bg-secondary/15 text-secondary [&>svg]:size-5">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-sm font-bold text-muted-foreground">{label}</p>
        <strong className="mt-1 block text-2xl font-black text-primary tabular-nums">
          {value}
        </strong>
        <p className="mt-1 truncate text-xs text-muted-foreground">{detail}</p>
      </div>
    </>
  );
  const className =
    "flex min-h-32 gap-3 rounded-2xl border bg-card p-4 transition hover:border-secondary/60";
  return href ? (
    <Link href={href} className={className}>
      {content}
    </Link>
  ) : (
    <div className={className}>{content}</div>
  );
}

function buttonVariant(status: AttendanceStatus): "gold" | "outline" | "destructive" {
  if (status === "present") return "gold";
  if (status === "teacher_absent" || status === "cancelled_teacher") return "destructive";
  return "outline";
}

function badgeVariant(status: AttendanceStatus) {
  if (status === "present" || status === "late") return "success" as const;
  if (status === "teacher_absent" || status.startsWith("cancelled")) {
    return "destructive" as const;
  }
  return "warning" as const;
}
