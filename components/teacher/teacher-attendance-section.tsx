import { CalendarCheck, CheckCircle2, Clock3, ListChecks, Percent } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AppLocale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { getTeacherAttendanceHistory } from "@/lib/attendance/queries";
import type { AttendanceStatus } from "@/lib/validators/attendance";

export async function TeacherAttendanceSection({
  locale,
  searchParams = Promise.resolve({}),
}: {
  locale: AppLocale;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const selectedStudent = typeof query.student === "string" ? query.student : undefined;
  const [t, history] = await Promise.all([
    getTranslations({ locale, namespace: "teacherAttendance" }),
    getTeacherAttendanceHistory(30, selectedStudent),
  ]);

  if (!history) {
    return <p className="rounded-2xl border bg-card p-6 text-muted-foreground">{t("missing")}</p>;
  }

  const dateTime = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: history.timezone,
  });

  return (
    <section className="teacher-reference-page" aria-labelledby="teacher-attendance-title">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-3xl">
          <p className="mb-1 text-sm font-black text-secondary">{t("eyebrow")}</p>
          <h1
            id="teacher-attendance-title"
            className="text-2xl font-black text-primary sm:text-3xl"
          >
            {t("title")}
          </h1>
          <p className="mt-1.5 text-sm leading-6 text-muted-foreground sm:text-base">
            {t("description")}
          </p>
        </div>
        <Link
          href="/teacher/today"
          className="inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-5 py-2.5 text-sm font-black text-primary-foreground shadow-card focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          {t("recordToday")}
        </Link>
      </header>

      <div className="teacher-metrics-grid mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          icon={<CalendarCheck />}
          label={t("metrics.scheduled")}
          value={history.metrics.scheduled}
        />
        <Metric
          icon={<CheckCircle2 />}
          label={t("metrics.recorded")}
          value={history.metrics.recorded}
        />
        <Metric
          icon={<ListChecks />}
          label={t("metrics.pending")}
          value={history.metrics.pending}
        />
        <Metric
          icon={<Percent />}
          label={t("metrics.adherence")}
          value={history.metrics.adherence === null ? "—" : `${history.metrics.adherence}%`}
        />
      </div>

      <Card className="mt-5 overflow-hidden">
        <CardHeader className="border-b">
          <CardTitle>{t("historyTitle", { days: history.days })}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {history.sessions.length === 0 ? (
            <p className="p-8 text-center text-muted-foreground">{t("empty")}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[44rem] text-sm">
                <thead className="bg-primary text-primary-foreground">
                  <tr>
                    <th className="px-5 py-3 text-start">{t("table.student")}</th>
                    <th className="px-5 py-3 text-start">{t("table.time")}</th>
                    <th className="px-5 py-3 text-start">{t("table.duration")}</th>
                    <th className="px-5 py-3 text-start">{t("table.result")}</th>
                    <th className="px-5 py-3 text-start">{t("table.savedAt")}</th>
                  </tr>
                </thead>
                <tbody>
                  {history.sessions.map((session) => (
                    <tr key={session.id} className="border-b last:border-0">
                      <td className="px-5 py-4 font-bold text-primary">{session.studentName}</td>
                      <td className="px-5 py-4" dir="auto">
                        {dateTime.format(new Date(session.scheduledAt))}
                      </td>
                      <td className="px-5 py-4">{t("minutes", { count: session.durationMin })}</td>
                      <td className="px-5 py-4">
                        {session.attendance ? (
                          <Badge variant={badgeVariant(session.attendance.status)}>
                            {t(`statuses.${session.attendance.status}`)}
                          </Badge>
                        ) : (
                          <Badge variant="outline">{t("pending")}</Badge>
                        )}
                      </td>
                      <td className="px-5 py-4 text-muted-foreground">
                        {session.attendance
                          ? dateTime.format(new Date(session.attendance.recorded_at))
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
      <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
        <Clock3 className="size-4 text-secondary" aria-hidden="true" />
        {t("timezone", { timezone: history.timezone })}
      </p>
    </section>
  );
}

function Metric({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
}) {
  return (
    <article className="flex min-h-28 items-center gap-4 rounded-2xl border bg-card p-5">
      <span className="grid size-12 place-items-center rounded-full bg-secondary/15 text-secondary [&>svg]:size-5">
        {icon}
      </span>
      <div>
        <p className="text-sm font-bold text-muted-foreground">{label}</p>
        <strong className="mt-1 block text-2xl font-black text-primary tabular-nums">
          {value}
        </strong>
      </div>
    </article>
  );
}

function badgeVariant(status: AttendanceStatus) {
  if (status === "present" || status === "late") return "success" as const;
  if (status === "teacher_absent" || status.startsWith("cancelled")) return "destructive" as const;
  return "warning" as const;
}
