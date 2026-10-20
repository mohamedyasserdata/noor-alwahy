import { BookOpenCheck, Calculator, Scale, ShieldCheck } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { AdminSubmitButton } from "@/components/admin/admin-submit-button";
import { AuthNotice } from "@/components/auth/auth-notice";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { updateEvaluationSettingsAction } from "@/lib/evaluation/actions";
import { getEvaluationSettings } from "@/lib/evaluation/settings";
import {
  evaluationSessionTypeSchema,
  type EvaluationSessionType,
} from "@/lib/validators/evaluation-settings";
import { cn } from "@/lib/utils";

type EvaluationSettingsSectionProps = {
  locale: AppLocale;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const deductionFields = ["dMajor", "dMinor", "dPrompt", "dForgot"] as const;

export async function EvaluationSettingsSection({
  locale,
  searchParams,
}: EvaluationSettingsSectionProps) {
  const [query, allSettings, t] = await Promise.all([
    searchParams,
    getEvaluationSettings(),
    getTranslations({ locale, namespace: "evaluationSettings" }),
  ]);
  const requestedType = typeof query.sessionType === "string" ? query.sessionType : "new_memo";
  const parsedType = evaluationSessionTypeSchema.safeParse(requestedType);
  const activeType: EvaluationSessionType = parsedType.success ? parsedType.data : "new_memo";
  const settings = allSettings.find((entry) => entry.sessionType === activeType);

  if (!settings) throw new Error("evaluation_settings_incomplete");

  const notice = getNotice(query, t);
  const currentWeightTotal = settings.criteria.reduce(
    (total, criterion) => total + criterion.weight,
    0,
  );

  return (
    <section className="mx-auto w-full max-w-6xl" aria-labelledby="evaluation-settings-title">
      <header className="grid gap-6 border-b border-secondary/30 pb-7 lg:grid-cols-[minmax(0,1fr)_17rem] lg:items-end">
        <div className="max-w-3xl">
          <p className="mb-3 inline-flex min-h-8 items-center rounded-full border border-secondary/30 bg-secondary/12 px-3 text-xs font-extrabold tracking-wide text-primary">
            {t("eyebrow")}
          </p>
          <h1
            id="evaluation-settings-title"
            className="text-3xl font-black text-balance text-primary sm:text-4xl"
          >
            {t("title")}
          </h1>
          <p className="mt-4 leading-8 text-pretty text-muted-foreground">{t("description")}</p>
        </div>
        <div className="border-s-4 border-secondary bg-primary px-5 py-4 text-primary-foreground shadow-card">
          <p className="text-sm font-bold text-secondary">{t("snapshot.title")}</p>
          <p className="mt-2 text-sm leading-6 text-primary-foreground/78">
            {t("snapshot.description")}
          </p>
        </div>
      </header>

      <nav className="mt-7 flex gap-2 overflow-x-auto pb-2" aria-label={t("sessionTypes.label")}>
        {allSettings.map((entry) => (
          <Link
            key={entry.sessionType}
            href={`/admin/evaluation?sessionType=${entry.sessionType}`}
            aria-current={entry.sessionType === activeType ? "page" : undefined}
            className={cn(
              "inline-flex min-h-11 shrink-0 items-center rounded-full border px-4 text-sm font-bold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none",
              entry.sessionType === activeType
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:border-secondary hover:text-primary",
            )}
          >
            {t(`sessionTypes.${entry.sessionType}`)}
          </Link>
        ))}
      </nav>

      <div className="mt-5">
        <AuthNotice message={notice.message} success={notice.success} />
      </div>

      <form action={updateEvaluationSettingsAction.bind(null, locale)} className="mt-6 grid gap-7">
        <input type="hidden" name="sessionType" value={activeType} />

        <fieldset className="border-t-4 border-primary bg-card shadow-card">
          <legend className="sr-only">{t("weights.title")}</legend>
          <div className="grid gap-3 border-b bg-accent/35 p-5 sm:grid-cols-[auto_1fr_auto] sm:items-center sm:px-7">
            <span className="grid size-11 place-items-center rounded-full bg-primary text-secondary">
              <Scale className="size-5" aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-xl font-black text-primary">{t("weights.title")}</h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                {t("weights.description")}
              </p>
            </div>
            <p className="text-sm font-bold text-primary tabular-nums">
              {t("weights.currentTotal", { total: currentWeightTotal })}
            </p>
          </div>
          <div className="divide-y">
            {settings.criteria.map((criterion) => (
              <div
                key={criterion.code}
                className="grid gap-3 p-5 sm:grid-cols-[minmax(0,1fr)_9rem] sm:items-center sm:px-7"
              >
                <div>
                  <Label htmlFor={`weight-${criterion.code}`} className="text-base">
                    {locale === "ar" ? criterion.nameAr : criterion.nameEn}
                  </Label>
                  <p className="mt-1 text-xs text-muted-foreground" dir="ltr">
                    {criterion.code}
                  </p>
                </div>
                <Input
                  id={`weight-${criterion.code}`}
                  data-testid={`evaluation-weight-${criterion.code}`}
                  name={`weight.${criterion.code}`}
                  type="number"
                  inputMode="decimal"
                  min="0"
                  max="100"
                  step="0.01"
                  required
                  dir="ltr"
                  className="tabular-nums"
                  defaultValue={criterion.weight}
                />
              </div>
            ))}
          </div>
        </fieldset>

        <div className="grid gap-7 lg:grid-cols-2">
          <fieldset className="border-t-4 border-secondary bg-card p-5 shadow-card sm:p-7">
            <legend className="sr-only">{t("deductions.title")}</legend>
            <div className="flex items-start gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-full bg-secondary text-secondary-foreground">
                <Calculator className="size-5" aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-xl font-black text-primary">{t("deductions.title")}</h2>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  {t("deductions.description")}
                </p>
              </div>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {deductionFields.map((field) => (
                <div key={field} className="grid gap-2">
                  <Label htmlFor={`evaluation-${field}`}>{t(`deductions.fields.${field}`)}</Label>
                  <Input
                    id={`evaluation-${field}`}
                    data-testid={`evaluation-${field}`}
                    name={field}
                    type="number"
                    inputMode="decimal"
                    min="0"
                    max="100"
                    step="0.01"
                    required
                    dir="ltr"
                    className="tabular-nums"
                    defaultValue={settings[field]}
                  />
                </div>
              ))}
            </div>
          </fieldset>

          <fieldset className="border-t-4 border-success bg-card p-5 shadow-card sm:p-7">
            <legend className="sr-only">{t("thresholds.title")}</legend>
            <div className="flex items-start gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-full bg-success/14 text-success">
                <BookOpenCheck className="size-5" aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-xl font-black text-primary">{t("thresholds.title")}</h2>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  {t("thresholds.description")}
                </p>
              </div>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-5">
              {settings.thresholds.map((threshold, index) => (
                <div key={index} className="grid gap-2">
                  <Label htmlFor={`evaluation-threshold-${index}`}>
                    {t("thresholds.rating", { rating: index + 1 })}
                  </Label>
                  <Input
                    id={`evaluation-threshold-${index}`}
                    data-testid={`evaluation-threshold-${index}`}
                    name={`threshold.${index}`}
                    type="number"
                    inputMode="decimal"
                    min="0"
                    max="100"
                    step="0.01"
                    required
                    dir="ltr"
                    className="tabular-nums"
                    defaultValue={threshold}
                  />
                </div>
              ))}
            </div>
          </fieldset>
        </div>

        <div className="flex flex-col gap-4 border-t pt-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="inline-flex items-start gap-2 text-sm leading-6 text-muted-foreground">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
            {t("auditNotice")}
          </p>
          <AdminSubmitButton label={t("action.save")} pendingLabel={t("action.saving")} />
        </div>
      </form>
    </section>
  );
}

type Translation = Awaited<ReturnType<typeof getTranslations<"evaluationSettings">>>;

function getNotice(query: Record<string, string | string[] | undefined>, t: Translation) {
  const status = typeof query.evaluationStatus === "string" ? query.evaluationStatus : undefined;
  const error = typeof query.evaluationError === "string" ? query.evaluationError : undefined;

  if (status === "updated") return { message: t("notices.updated"), success: true };
  if (error === "invalid_fields") return { message: t("errors.invalidFields"), success: false };
  if (error === "request_failed") return { message: t("errors.requestFailed"), success: false };
  return { message: undefined, success: false };
}
