import { CalendarRange, Target, UsersRound } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { AdminSubmitButton } from "@/components/admin/admin-submit-button";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import type { AppLocale } from "@/i18n/routing";
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
  const [t, students, query] = await Promise.all([
    getTranslations({ locale, namespace: "memorizationPlan" }),
    getTeacherStudentPlans(),
    searchParams,
  ]);
  const saved = query.planStatus === "saved";
  const error =
    query.planError === "invalid_fields"
      ? "invalid_fields"
      : query.planError
        ? "request_failed"
        : "";
  const today = new Date().toISOString().slice(0, 10);

  return (
    <section className="mx-auto w-full max-w-5xl" aria-labelledby="memorization-plans-title">
      <header className="max-w-3xl">
        <p className="mb-3 text-sm font-black text-secondary">{t("teacher.eyebrow")}</p>
        <h1
          id="memorization-plans-title"
          className="text-3xl font-black text-balance text-primary sm:text-4xl"
        >
          {t("teacher.title")}
        </h1>
        <p className="mt-4 leading-8 text-muted-foreground">{t("teacher.description")}</p>
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

      <div className="mt-8 flex items-center justify-between gap-3 border-b pb-5">
        <div className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-2xl bg-primary text-secondary">
            <UsersRound className="size-5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="font-black text-primary">{t("teacher.studentsTitle")}</h2>
            <p className="text-sm text-muted-foreground">{t("teacher.studentsDescription")}</p>
          </div>
        </div>
        <Badge variant="secondary">{t("studentCount", { count: students.length })}</Badge>
      </div>

      {students.length === 0 ? (
        <Card className="mt-6 border-dashed shadow-none">
          <CardHeader>
            <CardTitle>{t("teacher.emptyTitle")}</CardTitle>
            <CardDescription>{t("teacher.emptyDescription")}</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="mt-6 grid gap-5">
          {students.map((student) => {
            const weeklyPercent = Number(student.adherence?.weekly_adherence_percent ?? 0);
            const monthlyPercent = Number(student.adherence?.monthly_adherence_percent ?? 0);
            return (
              <Card key={student.studentId}>
                <CardHeader className="border-b sm:flex sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <CardTitle>{student.studentName}</CardTitle>
                    <CardDescription>
                      {student.plan ? t("teacher.editDescription") : t("teacher.newDescription")}
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
