import { Calculator, SlidersHorizontal } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { AdminSubmitButton } from "@/components/admin/admin-submit-button";
import { AuthNotice } from "@/components/auth/auth-notice";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AppLocale } from "@/i18n/routing";
import { updateEvaluationSettingsAction } from "@/lib/evaluations/actions";
import { getEvaluationSettings, type EvaluationSessionSettings } from "@/lib/evaluations/settings";

type EvaluationSettingsSectionProps = {
  locale: AppLocale;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function EvaluationSettingsSection({
  locale,
  searchParams,
}: EvaluationSettingsSectionProps) {
  const [query, sessions, t] = await Promise.all([
    searchParams,
    getEvaluationSettings(),
    getTranslations({ locale, namespace: "evaluationSettings" }),
  ]);
  const notice = getNotice(query, t);

  return (
    <section
      id="evaluation-settings"
      className="mx-auto w-full max-w-6xl"
      aria-labelledby="evaluation-settings-title"
    >
      <header className="max-w-3xl">
        <p className="mb-3 inline-flex min-h-8 items-center rounded-full border border-secondary/30 bg-secondary/12 px-3 text-xs font-extrabold tracking-wide text-primary">
          {t("eyebrow")}
        </p>
        <h2
          id="evaluation-settings-title"
          className="text-3xl font-black text-balance text-primary sm:text-4xl"
        >
          {t("title")}
        </h2>
        <p className="mt-4 leading-8 text-pretty text-muted-foreground">{t("description")}</p>
      </header>

      <div className="mt-7">
        <AuthNotice message={notice.message} success={notice.success} />
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-2">
        {sessions.map((session) => (
          <SessionSettingsCard key={session.sessionType} locale={locale} session={session} t={t} />
        ))}
      </div>
    </section>
  );
}

type Translation = Awaited<ReturnType<typeof getTranslations<"evaluationSettings">>>;

function SessionSettingsCard({
  locale,
  session,
  t,
}: {
  locale: AppLocale;
  session: EvaluationSessionSettings;
  t: Translation;
}) {
  return (
    <form action={updateEvaluationSettingsAction.bind(null, locale)}>
      <input type="hidden" name="sessionType" value={session.sessionType} />
      <Card className="h-full">
        <CardHeader>
          <div className="flex items-start gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-accent text-primary">
              <SlidersHorizontal aria-hidden="true" />
            </span>
            <div>
              <CardTitle>{t(`sessions.${session.sessionType}`)}</CardTitle>
              <CardDescription>
                {t("cardDescription", { count: session.weights.length })}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-7">
          <fieldset>
            <legend className="mb-3 font-black text-primary">{t("groups.weights")}</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              {session.weights.map((criterion) => (
                <div key={criterion.code} className="grid gap-2">
                  <Label htmlFor={`${session.sessionType}-${criterion.code}`}>
                    {locale === "ar" ? criterion.nameAr : criterion.nameEn}
                  </Label>
                  <Input
                    id={`${session.sessionType}-${criterion.code}`}
                    name={`weight:${criterion.code}`}
                    type="number"
                    inputMode="decimal"
                    min="0"
                    max="999.99"
                    step="0.01"
                    required
                    defaultValue={criterion.weight}
                  />
                </div>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-3 font-black text-primary">{t("groups.deductions")}</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <NumericField
                id={`${session.sessionType}-major`}
                name="dMajor"
                label={t("fields.major")}
                value={session.dMajor}
              />
              <NumericField
                id={`${session.sessionType}-minor`}
                name="dMinor"
                label={t("fields.minor")}
                value={session.dMinor}
              />
              <NumericField
                id={`${session.sessionType}-prompt`}
                name="dPrompt"
                label={t("fields.prompt")}
                value={session.dPrompt}
              />
              <NumericField
                id={`${session.sessionType}-forgot`}
                name="dForgot"
                label={t("fields.forgot")}
                value={session.dForgot}
              />
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-1 inline-flex items-center gap-2 font-black text-primary">
              <Calculator aria-hidden="true" />
              {t("groups.thresholds")}
            </legend>
            <p className="mb-3 text-sm leading-6 text-muted-foreground">{t("thresholdHint")}</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              {session.ratingThresholds.map((threshold, index) => (
                <div key={index} className="grid gap-2">
                  <Label htmlFor={`${session.sessionType}-threshold-${index}`}>
                    {t("rating", { rating: index + 1 })}
                  </Label>
                  <Input
                    id={`${session.sessionType}-threshold-${index}`}
                    name={`threshold:${index}`}
                    type="number"
                    inputMode="decimal"
                    min="0"
                    max="100"
                    step="0.01"
                    required
                    defaultValue={threshold}
                  />
                </div>
              ))}
            </div>
          </fieldset>
        </CardContent>
        <CardFooter className="justify-end">
          <AdminSubmitButton label={t("action.save")} pendingLabel={t("action.saving")} />
        </CardFooter>
      </Card>
    </form>
  );
}

function NumericField({
  id,
  name,
  label,
  value,
}: {
  id: string;
  name: string;
  label: string;
  value: number;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        name={name}
        type="number"
        inputMode="decimal"
        min="0"
        max="999.99"
        step="0.01"
        required
        defaultValue={value}
      />
    </div>
  );
}

function getNotice(query: Record<string, string | string[] | undefined>, t: Translation) {
  const status = typeof query.evaluationStatus === "string" ? query.evaluationStatus : undefined;
  const error = typeof query.evaluationError === "string" ? query.evaluationError : undefined;
  const session = typeof query.evaluationSession === "string" ? query.evaluationSession : undefined;
  const sessionLabel = session && isSessionKey(session) ? t(`sessions.${session}`) : undefined;

  if (status === "updated")
    return { message: t("notices.updated", { session: sessionLabel ?? "" }), success: true };
  if (error === "invalid_fields") return { message: t("errors.invalidFields"), success: false };
  if (error === "request_failed") return { message: t("errors.requestFailed"), success: false };
  return { message: undefined, success: false };
}

function isSessionKey(value: string): value is EvaluationSessionSettings["sessionType"] {
  return ["new_memo", "near_review", "far_review", "recitation", "noorani", "matn_theory"].includes(
    value,
  );
}
