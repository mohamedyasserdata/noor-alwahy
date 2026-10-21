import { BookOpenCheck, Target } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { AdminSubmitButton } from "@/components/admin/admin-submit-button";
import { AuthNotice } from "@/components/auth/auth-notice";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AppLocale } from "@/i18n/routing";
import { saveMemorizationPlanAction } from "@/lib/progress/actions";
import { getTeacherStudentPlans } from "@/lib/progress/memorization-plans";

export async function TeacherMemorizationPlansSection({
  locale,
  searchParams,
}: {
  locale: AppLocale;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [students, query, t] = await Promise.all([
    getTeacherStudentPlans(),
    searchParams,
    getTranslations({ locale, namespace: "memorizationPlan" }),
  ]);
  const notice = getNotice(query, t);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <section className="mx-auto w-full max-w-6xl" aria-labelledby="teacher-plans-title">
      <header className="max-w-3xl">
        <p className="mb-3 text-sm font-black text-secondary">{t("teacher.eyebrow")}</p>
        <h1
          id="teacher-plans-title"
          className="text-3xl font-black text-balance text-primary sm:text-4xl"
        >
          {t("teacher.title")}
        </h1>
        <p className="mt-4 leading-8 text-muted-foreground">{t("teacher.description")}</p>
      </header>
      <div className="mt-7">
        <AuthNotice message={notice.message} success={notice.success} />
      </div>
      {students.length ? (
        <div className="mt-7 grid gap-6 lg:grid-cols-2">
          {students.map(({ studentId, studentName, plan }) => (
            <article
              key={studentId}
              className="border-t-4 border-secondary bg-card p-5 shadow-card sm:p-6"
            >
              <div className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-full bg-accent text-primary">
                  {plan ? (
                    <BookOpenCheck className="size-5" aria-hidden="true" />
                  ) : (
                    <Target className="size-5" aria-hidden="true" />
                  )}
                </span>
                <div>
                  <h2 className="text-lg font-black text-primary">{studentName}</h2>
                  <p className="text-sm text-muted-foreground">
                    {plan ? t("teacher.existing") : t("teacher.new")}
                  </p>
                </div>
              </div>
              <form
                action={saveMemorizationPlanAction.bind(null, locale)}
                className="mt-6 grid gap-4 sm:grid-cols-2"
              >
                <input type="hidden" name="studentId" value={studentId} />
                <PlanInput
                  id={`${studentId}-weekly`}
                  name="weeklyTargetPages"
                  label={t("weeklyTarget")}
                  defaultValue={plan?.weeklyTargetPages ?? 5}
                />
                <PlanInput
                  id={`${studentId}-monthly`}
                  name="monthlyTargetPages"
                  label={t("monthlyTarget")}
                  defaultValue={plan?.monthlyTargetPages ?? 20}
                />
                <div className="grid gap-2">
                  <Label htmlFor={`${studentId}-starts`}>{t("startsOn")}</Label>
                  <Input
                    id={`${studentId}-starts`}
                    name="startsOn"
                    type="date"
                    required
                    defaultValue={plan?.startsOn ?? today}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor={`${studentId}-ends`}>{t("endsOn")}</Label>
                  <Input
                    id={`${studentId}-ends`}
                    name="endsOn"
                    type="date"
                    defaultValue={plan?.endsOn ?? ""}
                  />
                </div>
                <div className="sm:col-span-2">
                  <AdminSubmitButton
                    label={plan ? t("update") : t("create")}
                    pendingLabel={t("saving")}
                  />
                </div>
              </form>
            </article>
          ))}
        </div>
      ) : (
        <p className="mt-7 rounded-2xl border border-dashed p-8 text-center text-muted-foreground">
          {t("teacher.empty")}
        </p>
      )}
    </section>
  );
}

function PlanInput({
  id,
  name,
  label,
  defaultValue,
}: {
  id: string;
  name: string;
  label: string;
  defaultValue: number;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        name={name}
        type="number"
        inputMode="numeric"
        min="1"
        max="604"
        required
        defaultValue={defaultValue}
      />
    </div>
  );
}

function getNotice(
  query: Record<string, string | string[] | undefined>,
  t: Awaited<ReturnType<typeof getTranslations>>,
) {
  if (query.planStatus === "created") return { success: true, message: t("notices.created") };
  if (query.planStatus === "updated") return { success: true, message: t("notices.updated") };
  if (query.planError === "invalid_fields")
    return { success: false, message: t("notices.invalid") };
  if (query.planError) return { success: false, message: t("notices.error") };
  return { success: false, message: undefined };
}
