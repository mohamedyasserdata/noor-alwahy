"use client";

import { ArrowLeft, ArrowRight, Check, Sparkles } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { AdminSubmitButton } from "@/components/admin/admin-submit-button";
import {
  PackagePolicyStep,
  PackagePricesStep,
} from "@/components/packages/package-wizard-special-steps";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { savePackageAction } from "@/lib/packages/actions";
import type { PackageWizardInput } from "@/lib/validators/packages";

type Props = {
  tracks: Array<{ id: string; name: string }>;
  countries: Array<{ code: string; name: string; currency: string }>;
  validFrom: string;
  initialValue?: PackageWizardInput;
};

const defaultPolicy: PackageWizardInput["policy"] = {
  cancel_notice_hours: 12,
  max_makeups_per_period: 2,
  makeup_valid_days: 30,
  late_tolerance_min: 10,
  student_no_show_consumes_credit: true,
  student_no_show_pays_teacher: true,
  partial_refund_pct: 0,
  max_pause_days: 30,
  trial: { enabled: true, price_pct: 0 },
};

export function PackageWizard({ tracks, countries, validFrom, initialValue }: Props) {
  const t = useTranslations("packageAdmin");
  const locale = useLocale();
  const rtl = locale === "ar";
  const [step, setStep] = useState(0);
  const fallback = countries.find((country) => country.code === "ZZ") ?? countries[0];
  const [value, setValue] = useState<PackageWizardInput>(
    initialValue ?? {
      package_id: "",
      slug: "",
      track_id: "",
      name_ar: "",
      name_en: "",
      description_ar: "",
      description_en: "",
      audience: "child",
      teacher_gender: "",
      sessions_per_week: 3,
      duration_min: 30,
      billing_period: "monthly",
      features: [],
      policy: defaultPolicy,
      prices: fallback
        ? [
            {
              country_code: fallback.code,
              currency: fallback.currency,
              amount: "0",
              min_amount: "",
              max_amount: "",
              is_active: true,
              valid_from: validFrom,
            },
          ]
        : [],
      is_published: false,
    },
  );
  const steps = useMemo(
    () => Array.from({ length: 8 }, (_, index) => t(`steps.${index + 1}`)),
    [t],
  );
  const DirectionIcon = rtl ? ArrowLeft : ArrowRight;
  const BackIcon = rtl ? ArrowRight : ArrowLeft;
  const canContinue =
    step !== 0 || (value.name_ar.trim().length >= 2 && value.slug.trim().length >= 3);

  return (
    <div className="mx-auto w-full max-w-6xl">
      <header className="max-w-3xl">
        <p className="mb-3 flex items-center gap-2 text-sm font-black text-secondary">
          <Sparkles className="size-4" aria-hidden="true" /> {t("wizardEyebrow")}
        </p>
        <h1 className="text-3xl font-black text-balance text-primary sm:text-4xl">
          {t("wizardTitle")}
        </h1>
        <p className="mt-4 leading-8 text-muted-foreground">{t("wizardDescription")}</p>
      </header>

      <ol className="mt-8 grid grid-cols-4 gap-2 sm:grid-cols-8" aria-label={t("progressLabel")}>
        {steps.map((label, index) => (
          <li key={label}>
            <button
              type="button"
              className={`flex min-h-16 w-full flex-col items-center justify-center rounded-xl border px-2 text-center text-xs font-bold transition ${index === step ? "border-secondary bg-primary text-primary-foreground" : index < step ? "border-success/40 bg-success/10 text-success" : "bg-card text-muted-foreground"}`}
              aria-current={index === step ? "step" : undefined}
              onClick={() => setStep(index)}
            >
              <span className="mb-1 text-base">
                {index < step ? <Check className="size-4" /> : index + 1}
              </span>
              <span className="line-clamp-2">{label}</span>
            </button>
          </li>
        ))}
      </ol>

      <form
        action={savePackageAction.bind(null, locale)}
        className="mt-6 overflow-hidden rounded-3xl border bg-card shadow-soft"
      >
        <input type="hidden" name="payload" value={JSON.stringify(value)} />
        <div className="border-b bg-primary px-6 py-5 text-primary-foreground sm:px-8">
          <p className="text-sm font-bold text-secondary">
            {t("stepCount", { current: step + 1 })}
          </p>
          <h2 className="mt-1 text-2xl font-black">{steps[step]}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-7 text-primary-foreground/75">
            {t(`stepDescriptions.${step + 1}`)}
          </p>
        </div>
        <div className="min-h-96 p-6 sm:p-8">
          {renderStep(step, value, setValue, tracks, countries, validFrom, t)}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t bg-background/65 px-6 py-4 sm:px-8">
          <Button
            type="button"
            variant="outline"
            disabled={step === 0}
            onClick={() => setStep((current) => current - 1)}
          >
            <BackIcon aria-hidden="true" /> {t("actions.previous")}
          </Button>
          {step < 7 ? (
            <Button
              type="button"
              variant="gold"
              disabled={!canContinue}
              onClick={() => setStep((current) => current + 1)}
            >
              {t("actions.next")} <DirectionIcon aria-hidden="true" />
            </Button>
          ) : (
            <AdminSubmitButton
              label={t("actions.savePackage")}
              pendingLabel={t("actions.saving")}
            />
          )}
        </div>
      </form>
    </div>
  );
}

function renderStep(
  step: number,
  value: PackageWizardInput,
  setValue: (value: PackageWizardInput) => void,
  tracks: Props["tracks"],
  countries: Props["countries"],
  validFrom: string,
  t: ReturnType<typeof useTranslations<"packageAdmin">>,
) {
  if (step === 0) return <IdentityStep value={value} setValue={setValue} t={t} />;
  if (step === 1) return <AudienceStep value={value} setValue={setValue} tracks={tracks} t={t} />;
  if (step === 2) return <ScheduleStep value={value} setValue={setValue} t={t} />;
  if (step === 3)
    return (
      <PackagePolicyStep
        policy={value.policy}
        onChange={(policy) => setValue({ ...value, policy })}
      />
    );
  if (step === 4)
    return (
      <PackagePricesStep
        prices={value.prices}
        countries={countries}
        validFrom={validFrom}
        onChange={(prices) => setValue({ ...value, prices })}
      />
    );
  if (step === 5) return <FeaturesStep value={value} setValue={setValue} t={t} />;
  if (step === 6) return <PreviewStep value={value} t={t} />;
  return <PublishStep value={value} setValue={setValue} t={t} />;
}

function fieldClass() {
  return "min-h-28 w-full rounded-xl border bg-card px-3 py-3 text-sm leading-7 outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25";
}

type StepProps = {
  value: PackageWizardInput;
  setValue: (value: PackageWizardInput) => void;
  t: ReturnType<typeof useTranslations<"packageAdmin">>;
};

function IdentityStep({ value, setValue, t }: StepProps) {
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <Field
        id="name-ar"
        label={t("fields.nameAr")}
        value={value.name_ar}
        onChange={(name_ar) => setValue({ ...value, name_ar })}
      />
      <Field
        id="name-en"
        label={t("fields.nameEn")}
        value={value.name_en}
        dir="ltr"
        onChange={(name_en) => setValue({ ...value, name_en })}
      />
      <Field
        id="slug"
        label={t("fields.slug")}
        value={value.slug}
        dir="ltr"
        onChange={(slug) => setValue({ ...value, slug })}
      />
      <div />
      <TextArea
        id="description-ar"
        label={t("fields.descriptionAr")}
        value={value.description_ar}
        onChange={(description_ar) => setValue({ ...value, description_ar })}
      />
      <TextArea
        id="description-en"
        label={t("fields.descriptionEn")}
        value={value.description_en}
        dir="ltr"
        onChange={(description_en) => setValue({ ...value, description_en })}
      />
    </div>
  );
}

function AudienceStep({ value, setValue, tracks, t }: StepProps & { tracks: Props["tracks"] }) {
  return (
    <div className="grid gap-5 sm:grid-cols-3">
      <SelectField
        id="track"
        label={t("fields.track")}
        value={value.track_id}
        options={[
          { value: "", label: t("optional") },
          ...tracks.map((track) => ({ value: track.id, label: track.name })),
        ]}
        onChange={(track_id) => setValue({ ...value, track_id })}
      />
      <SelectField
        id="audience"
        label={t("fields.audience")}
        value={value.audience}
        options={["child", "adult", "women"].map((item) => ({
          value: item,
          label: t(`audiences.${item}`),
        }))}
        onChange={(audience) =>
          setValue({ ...value, audience: audience as PackageWizardInput["audience"] })
        }
      />
      <SelectField
        id="teacher-gender"
        label={t("fields.teacherGender")}
        value={value.teacher_gender}
        options={[
          { value: "", label: t("automatic") },
          { value: "male", label: t("genders.male") },
          { value: "female", label: t("genders.female") },
        ]}
        onChange={(teacher_gender) =>
          setValue({
            ...value,
            teacher_gender: teacher_gender as PackageWizardInput["teacher_gender"],
          })
        }
      />
    </div>
  );
}

function ScheduleStep({ value, setValue, t }: StepProps) {
  return (
    <div className="grid gap-5 sm:grid-cols-3">
      <NumberField
        id="sessions"
        label={t("fields.sessionsPerWeek")}
        value={value.sessions_per_week}
        min={1}
        max={14}
        onChange={(sessions_per_week) => setValue({ ...value, sessions_per_week })}
      />
      <NumberField
        id="duration"
        label={t("fields.durationMin")}
        value={value.duration_min}
        min={10}
        max={120}
        onChange={(duration_min) => setValue({ ...value, duration_min })}
      />
      <SelectField
        id="billing"
        label={t("fields.billingPeriod")}
        value={value.billing_period}
        options={["monthly", "quarterly", "yearly"].map((item) => ({
          value: item,
          label: t(`billing.${item}`),
        }))}
        onChange={(billing_period) =>
          setValue({
            ...value,
            billing_period: billing_period as PackageWizardInput["billing_period"],
          })
        }
      />
    </div>
  );
}

function FeaturesStep({ value, setValue, t }: StepProps) {
  return (
    <div className="grid gap-4">
      <p className="text-sm leading-7 text-muted-foreground">{t("featuresHint")}</p>
      {value.features.map((feature, index) => (
        <div
          key={index}
          className="grid gap-3 rounded-2xl border bg-background p-4 sm:grid-cols-[1fr_1fr_auto]"
        >
          <Input
            aria-label={t("fields.featureAr")}
            value={feature.ar}
            onChange={(event) =>
              setValue({
                ...value,
                features: value.features.map((item, itemIndex) =>
                  itemIndex === index ? { ...item, ar: event.target.value } : item,
                ),
              })
            }
          />
          <Input
            aria-label={t("fields.featureEn")}
            dir="ltr"
            value={feature.en}
            onChange={(event) =>
              setValue({
                ...value,
                features: value.features.map((item, itemIndex) =>
                  itemIndex === index ? { ...item, en: event.target.value } : item,
                ),
              })
            }
          />
          <Button
            type="button"
            variant="ghost"
            onClick={() =>
              setValue({
                ...value,
                features: value.features.filter((_, itemIndex) => itemIndex !== index),
              })
            }
          >
            {t("actions.remove")}
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        className="justify-self-start"
        onClick={() =>
          setValue({ ...value, features: [...value.features, { ar: "", en: "", icon: "star" }] })
        }
      >
        {t("actions.addFeature")}
      </Button>
    </div>
  );
}

function PreviewStep({ value, t }: Pick<StepProps, "value" | "t">) {
  const fallback = value.prices.find((price) => price.country_code === "ZZ");
  return (
    <article className="overflow-hidden rounded-3xl border bg-background">
      <div className="bg-primary p-7 text-primary-foreground">
        <p className="text-sm font-bold text-secondary">{t("visitorPreview")}</p>
        <h3 className="mt-3 text-3xl font-black">{value.name_ar || t("untitled")}</h3>
        <p className="mt-3 max-w-2xl leading-8 text-primary-foreground/75">
          {value.description_ar || t("noDescription")}
        </p>
      </div>
      <div className="grid gap-5 p-7 sm:grid-cols-[1fr_auto] sm:items-center">
        <ul className="grid gap-2 text-sm text-muted-foreground">
          {value.features.map((feature, index) => (
            <li key={index} className="flex items-center gap-2">
              <Check className="size-4 text-success" aria-hidden="true" />
              {feature.ar}
            </li>
          ))}
        </ul>
        <div className="rounded-2xl border border-secondary/40 bg-secondary/10 px-6 py-4 text-center">
          <p className="text-xs font-bold text-muted-foreground">{t("fallbackPrice")}</p>
          <p className="mt-1 text-2xl font-black text-primary">
            {fallback ? `${fallback.amount} ${fallback.currency}` : "—"}
          </p>
        </div>
      </div>
    </article>
  );
}

function PublishStep({ value, setValue, t }: StepProps) {
  return (
    <div className="grid place-items-center py-8 text-center">
      <div className="max-w-xl rounded-3xl border border-secondary/40 bg-secondary/10 p-8">
        <Check className="mx-auto size-10 text-success" aria-hidden="true" />
        <h3 className="mt-4 text-2xl font-black text-primary">{t("readyTitle")}</h3>
        <p className="mt-3 leading-8 text-muted-foreground">{t("readyDescription")}</p>
        <label className="mt-6 flex min-h-12 items-center justify-center gap-3 rounded-xl border bg-card px-4 text-sm font-black text-primary">
          <input
            type="checkbox"
            className="size-5 accent-primary"
            checked={value.is_published}
            onChange={(event) => setValue({ ...value, is_published: event.target.checked })}
          />
          {t("publishImmediately")}
        </label>
      </div>
    </div>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  dir,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  dir?: "ltr";
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} value={value} dir={dir} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}
function TextArea({
  id,
  label,
  value,
  onChange,
  dir,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  dir?: "ltr";
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <textarea
        id={id}
        className={fieldClass()}
        value={value}
        dir={dir}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
function NumberField({
  id,
  label,
  value,
  min,
  max,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </div>
  );
}
function SelectField({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        className="h-11 rounded-lg border bg-card px-3 text-sm font-bold text-primary"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
