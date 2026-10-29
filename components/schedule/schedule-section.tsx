import { CalendarDays, Globe2 } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { AdminSubmitButton } from "@/components/admin/admin-submit-button";
import { CalendarExports } from "@/components/schedule/calendar-exports";
import { SessionAdjustmentsSection } from "@/components/schedule/session-adjustments-section";
import { WeeklyScheduleGrid } from "@/components/schedule/weekly-schedule-grid";
import { StudentPageShell } from "@/components/student/student-page-shell";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TimezoneField } from "@/components/time/timezone-field";
import type { AppLocale } from "@/i18n/routing";
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
  const [t, data, query] = await Promise.all([
    getTranslations({ locale, namespace: "schedules" }),
    getScheduleWorkspace(),
    searchParams,
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
          <div className="lg:col-span-2">
            <TimezoneField
              id="schedule-timezone"
              name="anchorTimezone"
              label={t("anchorTimezone")}
              initialValue="Africa/Cairo"
              locale={locale}
            />
          </div>
          <div className="lg:col-span-3">
            <AdminSubmitButton label={t("save")} pendingLabel={t("saving")} />
          </div>
        </form>
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
        }}
      />
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
