import { CalendarDays } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { AdminSubmitButton } from "@/components/admin/admin-submit-button";
import { CalendarExports } from "@/components/schedule/calendar-exports";
import { ScheduleAssignmentPicker } from "@/components/schedule/schedule-assignment-picker";
import { SessionAdjustmentsSection } from "@/components/schedule/session-adjustments-section";
import { WeeklyScheduleGrid } from "@/components/schedule/weekly-schedule-grid";
import { StudentPageShell } from "@/components/student/student-page-shell";
import { Alert } from "@/components/ui/alert";
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
      studentId:
        typeof query.studentId === "string"
          ? query.studentId
          : typeof query.student === "string"
            ? query.student
            : undefined,
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
        </header>
      ) : null}
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
          className="mt-8 grid min-w-0 gap-5 rounded-3xl border bg-card p-5 shadow-card lg:grid-cols-2"
        >
          <div className="grid min-w-0 gap-2 lg:col-span-2">
            <ScheduleAssignmentPicker
              locale={locale}
              assignments={data.assignments.map((assignment) => {
                const student = relation(assignment.student);
                const teacher = relation(assignment.teacher);
                const profile = teacher ? relation(teacher.profile) : null;
                return {
                  id: assignment.id,
                  studentId: assignment.student_id,
                  studentName: student?.full_name ?? "—",
                  teacherId: assignment.teacher_id,
                  teacherName: profile?.full_name ?? "—",
                };
              })}
            />
            {!data.assignments.length ? (
              <p className="rounded-xl border border-dashed px-4 py-3 text-sm text-muted-foreground">
                {locale === "ar"
                  ? "لا يوجد طالب مرتبط بمدرس حاليًا. أنشئ التعيين أولًا ثم أضف الموعد."
                  : "No student is currently assigned to a teacher. Create the assignment first."}
              </p>
            ) : null}
          </div>
          <fieldset className="grid gap-2 lg:col-span-2">
            <legend className="font-bold text-primary">{t("weekday")}</legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
              {[0, 1, 2, 3, 4, 5, 6].map((day) => (
                <label
                  key={day}
                  className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border bg-background px-3 text-sm font-bold has-[:checked]:border-secondary has-[:checked]:bg-secondary/10"
                >
                  <input
                    type="checkbox"
                    name="weekdays"
                    value={day}
                    className="size-4 accent-primary"
                  />
                  {t(`weekdays.${day}` as "weekdays.0")}
                </label>
              ))}
            </div>
          </fieldset>
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
            <AdminSubmitButton label={t("save")} pendingLabel={t("saving")} />
          </div>
        </form>
      ) : null}
      <WeeklyScheduleGrid
        slots={data.slots}
        locale={locale}
        role={data.role}
        timezone={data.timezone}
        variant={appearance === "student" ? "compact" : "grid"}
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
