import { CalendarDays, Globe2 } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { AdminSubmitButton } from "@/components/admin/admin-submit-button";
import { CalendarExports } from "@/components/schedule/calendar-exports";
import { SessionAdjustmentsSection } from "@/components/schedule/session-adjustments-section";
import { WeeklyScheduleGrid } from "@/components/schedule/weekly-schedule-grid";
import { StudentPageShell } from "@/components/student/student-page-shell";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AppLocale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { saveScheduleSlotAction } from "@/lib/schedules/actions";
import { getScheduleWorkspace, relation } from "@/lib/schedules/management";

type Query = Promise<Record<string, string | string[] | undefined>>;

export async function ScheduleSection({
  appearance = "standard",
  locale,
  searchParams = Promise.resolve({}),
}: {
  appearance?: "standard" | "student";
  locale: AppLocale;
  searchParams?: Query;
}) {
  const query = await searchParams;
  const [t, data] = await Promise.all([
    getTranslations({ locale, namespace: "schedules" }),
    getScheduleWorkspace({
      studentId: typeof query.studentId === "string" ? query.studentId : undefined,
      teacherId: typeof query.teacherId === "string" ? query.teacherId : undefined,
    }),
  ]);
  const status = typeof query.scheduleStatus === "string" ? query.scheduleStatus : "";
  const error = typeof query.scheduleError === "string" ? query.scheduleError : "";
  const adjustmentStatus = typeof query.adjustmentStatus === "string" ? query.adjustmentStatus : "";
  const adjustmentError = typeof query.adjustmentError === "string" ? query.adjustmentError : "";
  const content = (
    <section
      className={
        appearance === "student"
          ? "student-schedule-page mx-auto w-full max-w-[94rem] rounded-[1.75rem] border border-secondary/20 bg-card/96 p-5 shadow-card sm:p-7"
          : "teacher-reference-page"
      }
      aria-labelledby={appearance === "standard" ? "schedule-title" : undefined}
      aria-label={appearance === "student" ? t("title") : undefined}
    >
      {appearance === "standard" ? (
        <header className="max-w-3xl">
          <p className="mb-1 text-sm font-black text-secondary">{t("eyebrow")}</p>
          <h1 id="schedule-title" className="text-2xl font-black text-primary sm:text-3xl">
            {t("title")}
          </h1>
          <p className="mt-1.5 text-sm leading-6 text-muted-foreground sm:text-base">
            {t("description")}
          </p>
          <Badge className="mt-4" variant="outline">
            <Globe2 className="size-4" aria-hidden="true" /> {data.timezone}
          </Badge>
        </header>
      ) : (
        <div className="mb-6 flex justify-end">
          <Badge variant="outline" className="border-secondary/35 bg-[#fffaf0] dark:bg-accent/30">
            <Globe2 className="size-4" aria-hidden="true" /> {data.timezone}
          </Badge>
        </div>
      )}
      {status ? (
        <Alert className="mt-6" variant="success">
          {t("saved")}
        </Alert>
      ) : null}
      {data.role === "admin" && (query.studentId || query.teacherId) ? (
        <Alert className="mt-6 grid-cols-1" variant="default">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>
              {locale === "ar"
                ? "تعرض الصفحة الآن الجدول المرتبط بالملف المحدد."
                : "The page is filtered to the selected profile."}
            </span>
            <Button asChild variant="outline" size="sm">
              <Link href="/admin/schedule">
                {locale === "ar" ? "عرض الجدول الكامل" : "Show full schedule"}
              </Link>
            </Button>
          </div>
        </Alert>
      ) : null}
      {error ? (
        <Alert className="mt-6" variant="warning">
          {t(`errors.${error}` as "errors.invalid_fields")}
        </Alert>
      ) : null}
      {data.role === "admin" ? (
        <form
          action={saveScheduleSlotAction.bind(null, locale)}
          className="mt-8 grid min-w-0 gap-4 rounded-3xl border bg-card p-5 shadow-card lg:grid-cols-5 lg:items-end"
        >
          <div className="grid min-w-0 gap-2 lg:col-span-2">
            <Label htmlFor="schedule-assignment">{t("assignment")}</Label>
            <select
              id="schedule-assignment"
              name="assignmentId"
              required
              className="min-h-11 w-full min-w-0 rounded-xl border bg-background px-3"
            >
              <option value="">{t("chooseAssignment")}</option>
              {data.assignments.map((assignment) => {
                const student = relation(assignment.student);
                const teacher = relation(assignment.teacher);
                const profile = teacher ? relation(teacher.profile) : null;
                const track = relation(assignment.track);
                return (
                  <option key={assignment.id} value={assignment.id}>
                    {student?.full_name} · {profile?.full_name} ·{" "}
                    {locale === "ar" ? track?.name_ar : (track?.name_en ?? track?.name_ar)}
                  </option>
                );
              })}
            </select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="schedule-weekday">{t("weekday")}</Label>
            <select
              id="schedule-weekday"
              name="weekday"
              required
              className="min-h-11 w-full min-w-0 rounded-xl border bg-background px-3"
            >
              {[0, 1, 2, 3, 4, 5, 6].map((day) => (
                <option value={day} key={day}>
                  {t(`weekdays.${day}` as "weekdays.0")}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="schedule-time">{t("time")}</Label>
            <Input id="schedule-time" name="localStartTime" type="time" required />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="schedule-duration">{t("duration")}</Label>
            <Input
              id="schedule-duration"
              name="durationMin"
              type="number"
              min={10}
              max={120}
              defaultValue={30}
              required
            />
          </div>
          <div className="grid gap-2 lg:col-span-2">
            <Label htmlFor="schedule-timezone">{t("anchorTimezone")}</Label>
            <Input
              id="schedule-timezone"
              name="anchorTimezone"
              defaultValue="Africa/Cairo"
              required
            />
          </div>
          <div className="lg:col-span-3">
            <AdminSubmitButton label={t("save")} pendingLabel={t("saving")} />
          </div>
        </form>
      ) : null}
      <WeeklyScheduleGrid
        slots={data.slots}
        locale={locale}
        role={data.role}
        timezone={data.timezone}
        labels={{
          title: t("grid.title"),
          description: t("grid.description"),
          lessonCount: t.raw("grid.lessonCount"),
          lessonsAtTime: t.raw("grid.lessonsAtTime"),
          student: t("grid.student"),
          teacher: t("grid.teacher"),
          empty: t("empty"),
          weekdays: [0, 1, 2, 3, 4, 5, 6].map((day) => t(`weekdays.${day}` as "weekdays.0")),
        }}
      />
      {appearance === "standard" && data.role === "teacher" ? (
        <section className="mt-6 rounded-2xl border bg-card p-4 shadow-card sm:p-5">
          <div className="flex items-center justify-between gap-3 border-b border-secondary/15 pb-3">
            <div>
              <h2 className="text-lg font-black text-primary">
                {locale === "ar" ? "الحصص القادمة" : "Upcoming sessions"}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {locale === "ar"
                  ? "افتح مساحة الحصة لإدارة الرابط والحضور والتقييم."
                  : "Open the session workspace to manage access, attendance, and evaluation."}
              </p>
            </div>
            <Badge variant="secondary">{data.teacherSessions.length}</Badge>
          </div>
          {data.teacherSessions.length ? (
            <ul className="mt-3 grid gap-2">
              {data.teacherSessions.map((session) => (
                <li
                  key={session.id}
                  className="flex flex-col gap-3 rounded-xl border border-secondary/15 bg-background/45 p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-black text-primary">{session.student.full_name}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {new Intl.DateTimeFormat(locale, {
                        dateStyle: "medium",
                        timeStyle: "short",
                        timeZone: data.timezone,
                      }).format(new Date(session.scheduled_at))}
                    </p>
                  </div>
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/teacher/sessions/${session.id}`}>
                      {locale === "ar" ? "فتح الحصة" : "Open session"}
                    </Link>
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">
              {locale === "ar" ? "لا توجد حصص قادمة." : "No upcoming sessions."}
            </p>
          )}
        </section>
      ) : null}
      <CalendarExports
        labels={{
          title: t("exports.title"),
          description: t("exports.description"),
          download: t("exports.download"),
          downloadPdf: t("exports.downloadPdf"),
          generate: t("exports.generate"),
          generating: t("exports.generating"),
          copy: t("exports.copy"),
          copied: t("exports.copied"),
          revoke: t("exports.revoke"),
          revoking: t("exports.revoking"),
          generated: t("exports.generated"),
          revoked: t("exports.revoked"),
          error: t("exports.error"),
          privacy: t("exports.privacy"),
          urlLabel: t("exports.urlLabel"),
          openTools: t("exports.openTools"),
          closeTools: t("exports.closeTools"),
          confirmGenerate: t("exports.confirmGenerate"),
          confirmRevoke: t("exports.confirmRevoke"),
          confirm: t("exports.confirm"),
          cancel: t("exports.cancel"),
        }}
      />
      {data.adjustments ? (
        <SessionAdjustmentsSection
          locale={locale}
          timezone={data.timezone}
          data={data.adjustments}
          status={adjustmentStatus}
          error={adjustmentError}
        />
      ) : null}
    </section>
  );

  if (appearance === "student") {
    return (
      <StudentPageShell
        locale={locale}
        eyebrow={t("eyebrow")}
        title={t("title")}
        description={t("description")}
        titleId="schedule-title"
        icon={CalendarDays}
      >
        {content}
      </StudentPageShell>
    );
  }

  return content;
}
