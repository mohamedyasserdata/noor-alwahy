import {
  BookOpenCheck,
  CalendarRange,
  CheckCircle2,
  Search,
  Target,
  UsersRound,
} from "lucide-react";
import { getTranslations } from "next-intl/server";

import { AdminSubmitButton } from "@/components/admin/admin-submit-button";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { TeacherMetricCard } from "@/components/teacher/teacher-page-ui";
import type { AppLocale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { saveMemorizationPlanAction } from "@/lib/memorization-plans/actions";
import { getTeacherStudentPlans } from "@/lib/memorization-plans/queries";

type Query = Promise<Record<string, string | string[] | undefined>>;

export async function TeacherMemorizationPlansSection({
  locale,
  searchParams,
}: {
  locale: AppLocale;
  searchParams: Query;
}) {
  const [t, attendanceT, students, query] = await Promise.all([
    getTranslations({ locale, namespace: "memorizationPlan" }),
    getTranslations({ locale, namespace: "teacherAttendance" }),
    getTeacherStudentPlans(),
    searchParams,
  ]);
  const saved = query.planStatus === "saved";
  const requestedSearch = typeof query.q === "string" ? query.q.trim() : "";
  const visibleStudents = requestedSearch
    ? students.filter((student) =>
        `${student.studentName} ${student.studentNumber}`
          .toLocaleLowerCase(locale)
          .includes(requestedSearch.toLocaleLowerCase(locale)),
      )
    : students;
  const error =
    query.planError === "invalid_fields"
      ? "invalid_fields"
      : query.planError
        ? "request_failed"
        : "";
  const today = new Date().toISOString().slice(0, 10);
  const configuredCount = students.filter((student) => student.plan).length;
  const followUpCount = students.filter(
    (student) => student.plan && Number(student.adherence?.weekly_adherence_percent ?? 0) < 100,
  ).length;

  return (
    <section className="teacher-reference-page" aria-labelledby="memorization-plans-title">
      <header className="max-w-3xl">
        <p className="mb-1 text-sm font-black text-secondary">{t("teacher.eyebrow")}</p>
        <h1
          id="memorization-plans-title"
          className="text-2xl font-black text-balance text-primary sm:text-3xl"
        >
          {t("teacher.title")}
        </h1>
        <p className="mt-1.5 text-sm leading-6 text-muted-foreground sm:text-base">
          {t("teacher.description")}
        </p>
      </header>

      {saved ? (
        <Alert className="mt-6" variant="success" aria-live="polite">
          {t("notices.saved")}
        </Alert>
      ) : null}
      {error ? (
        <Alert className="mt-6" variant="warning" aria-live="polite">
          {t(`errors.${error}`)}
        </Alert>
      ) : null}

      <div className="teacher-metrics-grid mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <TeacherMetricCard
          icon={UsersRound}
          label={t("teacher.studentsTitle")}
          value={students.length}
          tone="green"
        />
        <TeacherMetricCard
          icon={CheckCircle2}
          label={t("teacher.configured")}
          value={configuredCount}
        />
        <TeacherMetricCard
          icon={BookOpenCheck}
          label={t("teacher.notConfigured")}
          value={students.length - configuredCount}
          tone="gold"
        />
        <TeacherMetricCard icon={Target} label={t("weekly")} value={followUpCount} tone="violet" />
      </div>

      <div className="mt-5 flex items-center justify-between gap-3 border-b pb-4">
        <div className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-2xl bg-primary text-secondary">
            <UsersRound className="size-5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="font-black text-primary">{t("teacher.studentsTitle")}</h2>
            <p className="text-sm text-muted-foreground">{t("teacher.studentsDescription")}</p>
          </div>
        </div>
        <Badge variant="secondary">{t("studentCount", { count: visibleStudents.length })}</Badge>
      </div>

      <form className="mt-5 flex max-w-xl gap-2" method="get">
        <Label htmlFor="teacher-student-search" className="sr-only">
          {t("teacher.search")}
        </Label>
        <Input
          id="teacher-student-search"
          name="q"
          type="search"
          defaultValue={requestedSearch}
          placeholder={t("teacher.searchPlaceholder")}
        />
        <button
          type="submit"
          className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl bg-primary px-4 font-bold text-primary-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <Search className="size-4" aria-hidden="true" />
          {t("teacher.search")}
        </button>
      </form>

      {visibleStudents.length ? (
        <div className="mt-5 overflow-x-auto rounded-2xl border bg-card shadow-card">
          <table className="w-full min-w-[48rem] text-sm">
            <thead>
              <tr>
                <th className="px-4 py-3 text-start">#</th>
                <th className="px-4 py-3 text-start">{t("teacher.studentsTitle")}</th>
                <th className="px-4 py-3 text-start">{t("teacher.configured")}</th>
                <th className="px-4 py-3 text-start">{t("weekly")}</th>
                <th className="px-4 py-3 text-start">{t("actions.update")}</th>
              </tr>
            </thead>
            <tbody>
              {visibleStudents.map((student, index) => {
                const percent = Number(student.adherence?.weekly_adherence_percent ?? 0);
                return (
                  <tr
                    key={student.studentId}
                    className="border-b border-secondary/15 last:border-0"
                  >
                    <td className="px-4 py-4 tabular-nums">{index + 1}</td>
                    <td className="px-4 py-4">
                      <p className="font-black text-primary">{student.studentName}</p>
                      <p className="text-xs text-muted-foreground">{student.studentNumber}</p>
                    </td>
                    <td className="px-4 py-4">
                      <Badge variant={student.plan ? "success" : "outline"}>
                        {student.plan ? t("teacher.configured") : t("teacher.notConfigured")}
                      </Badge>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex min-w-40 items-center gap-2">
                        <Progress value={percent} aria-label={t("progressLabel", { percent })} />
                        <span className="font-black tabular-nums">{percent}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <a
                        href={`#student-plan-${student.studentId}`}
                        className="inline-flex min-h-11 items-center rounded-xl border border-secondary/45 px-4 font-bold text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                      >
                        {t("actions.update")}
                      </a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      {visibleStudents.length === 0 ? (
        <Card className="mt-6 border-dashed shadow-none">
          <CardHeader>
            <CardTitle>{t("teacher.emptyTitle")}</CardTitle>
            <CardDescription>{t("teacher.emptyDescription")}</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="mt-6 grid gap-5">
          {visibleStudents.map((student) => {
            const weeklyPercent = Number(student.adherence?.weekly_adherence_percent ?? 0);
            const monthlyPercent = Number(student.adherence?.monthly_adherence_percent ?? 0);
            return (
              <Card
                key={student.studentId}
                id={`student-plan-${student.studentId}`}
                className="scroll-mt-24"
              >
                <CardHeader className="border-b sm:flex sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <CardTitle>{student.studentName}</CardTitle>
                    <CardDescription>
                      {student.track
                        ? locale === "ar"
                          ? student.track.name_ar
                          : student.track.name_en || student.track.name_ar
                        : t("teacher.trackMissing")}
                      {" · "}
                      {student.level
                        ? locale === "ar"
                          ? student.level.name_ar
                          : student.level.name_en || student.level.name_ar
                        : t("teacher.levelMissing")}
                      {" · "}
                      {student.studentNumber}
                    </CardDescription>
                  </div>
                  <Badge variant={student.plan ? "success" : "outline"}>
                    {student.plan ? t("teacher.configured") : t("teacher.notConfigured")}
                  </Badge>
                </CardHeader>
                <CardContent className="pt-5 sm:pt-6">
                  {student.plan ? (
                    <div className="mb-6 grid gap-4 rounded-xl bg-muted/55 p-4 sm:grid-cols-2">
                      <Adherence
                        label={t("weekly")}
                        achieved={student.adherence?.weekly_achieved_pages ?? 0}
                        target={student.plan.weekly_target_pages}
                        percent={weeklyPercent}
                        ariaLabel={t("progressLabel", { percent: weeklyPercent })}
                      />
                      <Adherence
                        label={t("monthly")}
                        achieved={student.adherence?.monthly_achieved_pages ?? 0}
                        target={student.plan.monthly_target_pages}
                        percent={monthlyPercent}
                        ariaLabel={t("progressLabel", { percent: monthlyPercent })}
                      />
                    </div>
                  ) : null}
                  <div className="mb-6 grid gap-3 rounded-xl border bg-background/55 p-4 sm:grid-cols-2 xl:grid-cols-4">
                    <StudentContextItem
                      label={t("teacher.context.goal")}
                      value={
                        student.plan
                          ? t("teacher.context.weeklyGoal", {
                              count: student.plan.weekly_target_pages,
                            })
                          : t("teacher.context.missing")
                      }
                    />
                    <StudentContextItem
                      label={t("teacher.context.lastEvaluation")}
                      value={
                        student.latestEvaluation?.score == null
                          ? t("teacher.context.missing")
                          : t("teacher.context.score", { score: student.latestEvaluation.score })
                      }
                    />
                    <StudentContextItem
                      label={t("teacher.context.lastAttendance")}
                      value={
                        student.latestAttendance
                          ? attendanceT(
                              `statuses.${student.latestAttendance.status}` as "statuses.present",
                            )
                          : t("teacher.context.missing")
                      }
                    />
                    <StudentContextItem
                      label={t("teacher.context.pendingReport")}
                      value={
                        student.pendingReport
                          ? t(`teacher.context.reportStatuses.${student.pendingReport.status}`)
                          : t("teacher.context.noPendingReport")
                      }
                    />
                    <nav
                      className="flex flex-wrap gap-2 border-t pt-3 sm:col-span-2 xl:col-span-4"
                      aria-label={t("teacher.context.linksLabel", {
                        student: student.studentName,
                      })}
                    >
                      {student.latestEvaluation ? (
                        <Button asChild variant="outline" size="sm">
                          <Link
                            href={`/teacher/evaluations?sessionId=${encodeURIComponent(student.latestEvaluation.sessionId)}`}
                          >
                            {t("teacher.context.openEvaluation")}
                          </Link>
                        </Button>
                      ) : null}
                      <Button asChild variant="outline" size="sm">
                        <Link
                          href={`/teacher/attendance?student=${encodeURIComponent(student.studentId)}`}
                        >
                          {t("teacher.context.openAttendance")}
                        </Link>
                      </Button>
                      <Button asChild variant="outline" size="sm">
                        <Link
                          href={`/teacher/reports?student=${encodeURIComponent(student.studentId)}`}
                        >
                          {t("teacher.context.openReport")}
                        </Link>
                      </Button>
                    </nav>
                  </div>
                  <form
                    action={saveMemorizationPlanAction.bind(null, locale)}
                    className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
                  >
                    <input type="hidden" name="studentId" value={student.studentId} />
                    <PlanInput
                      id={`weekly-${student.studentId}`}
                      name="weeklyTargetPages"
                      label={t("fields.weekly")}
                      defaultValue={student.plan?.weekly_target_pages ?? 4}
                      min={1}
                      max={604}
                    />
                    <PlanInput
                      id={`monthly-${student.studentId}`}
                      name="monthlyTargetPages"
                      label={t("fields.monthly")}
                      defaultValue={student.plan?.monthly_target_pages ?? 16}
                      min={1}
                      max={604}
                    />
                    <PlanInput
                      id={`starts-${student.studentId}`}
                      name="startsOn"
                      label={t("fields.startsOn")}
                      type="date"
                      defaultValue={student.plan?.starts_on ?? today}
                    />
                    <PlanInput
                      id={`ends-${student.studentId}`}
                      name="endsOn"
                      label={t("fields.endsOn")}
                      type="date"
                      defaultValue={student.plan?.ends_on ?? ""}
                    />
                    <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4 sm:col-span-2 lg:col-span-4">
                      <p className="flex items-center gap-2 text-sm text-muted-foreground">
                        <CalendarRange className="size-4 text-secondary" aria-hidden="true" />
                        {t("teacher.dateHint")}
                      </p>
                      <AdminSubmitButton
                        label={student.plan ? t("actions.update") : t("actions.create")}
                        pendingLabel={t("actions.saving")}
                      />
                    </div>
                  </form>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </section>
  );
}

function StudentContextItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-bold text-muted-foreground">{label}</p>
      <p className="mt-1 font-black text-primary">{value}</p>
    </div>
  );
}

function PlanInput({
  id,
  name,
  label,
  type = "number",
  defaultValue,
  min,
  max,
}: {
  id: string;
  name: string;
  label: string;
  type?: "number" | "date";
  defaultValue: string | number;
  min?: number;
  max?: number;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        name={name}
        type={type}
        defaultValue={defaultValue}
        min={min}
        max={max}
        required={name !== "endsOn"}
      />
    </div>
  );
}

function Adherence({
  label,
  achieved,
  target,
  percent,
  ariaLabel,
}: {
  label: string;
  achieved: number;
  target: number;
  percent: number;
  ariaLabel: string;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 font-bold text-primary">
          <Target className="size-4 text-secondary" aria-hidden="true" />
          {label}
        </p>
        <span className="text-sm font-black text-primary">
          {achieved}/{target}
        </span>
      </div>
      <Progress value={percent} aria-label={ariaLabel} />
    </div>
  );
}
