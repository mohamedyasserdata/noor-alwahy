"use client";

import { CheckCircle2, ChevronLeft, ChevronRight, Send } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import Script from "next/script";
import { FormEvent, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "@/i18n/navigation";
import { legalDocumentVersion } from "@/lib/legal/documents";

type Option = { id: string; name: string };
type Country = { code: string; name: string };
type FieldErrors = Record<string, string>;
const ianaTimezones = ["UTC", ...Intl.supportedValuesOf("timeZone")];

export function ApplicationForm({
  tracks,
  packages,
  countries,
  siteKey,
}: {
  tracks: Option[];
  packages: Option[];
  countries: Country[];
  siteKey: string;
}) {
  const locale = useLocale() as "ar" | "en";
  const t = useTranslations("applicationsPublic");
  const formRef = useRef<HTMLFormElement>(null);
  const [step, setStep] = useState(1);
  const [gender, setGender] = useState<"male" | "female">("male");
  const [timezone, setTimezone] = useState(() => {
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return ianaTimezones.includes(detected) ? detected : "Africa/Cairo";
  });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [review, setReview] = useState<Array<[string, string]>>([]);
  const [result, setResult] = useState<{ order: string; hint: string } | null>(null);
  const timezoneValid = ianaTimezones.includes(timezone);
  const timezonePreview = timezoneValid
    ? new Intl.DateTimeFormat(locale, {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: timezone,
      }).format(new Date())
    : "";

  function goTo(nextStep: number) {
    if (nextStep > step && !validateStep(step)) return;
    if (nextStep === 3) buildReview();
    setStep(nextStep);
    window.setTimeout(
      () => document.querySelector<HTMLElement>(`#application-step-${nextStep}`)?.focus(),
      0,
    );
  }

  function validateStep(currentStep: number) {
    const form = formRef.current;
    if (!form) return false;
    const section = form.querySelector<HTMLElement>(`[data-step="${currentStep}"]`);
    const controls = [
      ...(section?.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
        "input,select,textarea",
      ) ?? []),
    ];
    const nextErrors: FieldErrors = {};
    for (const control of controls)
      if (!control.checkValidity()) nextErrors[control.name] = t("fieldError");
    const data = new FormData(form);
    if (currentStep === 1) {
      const age = Number(data.get("student_age"));
      if (age < 18 && String(data.get("guardian_name") ?? "").trim().length < 2)
        nextErrors.guardian_name = t("guardianRequired");
      if (
        !String(data.get("contact_email") ?? "").trim() &&
        !String(data.get("contact_phone") ?? "").trim()
      )
        nextErrors.contact_email = t("contactRequired");
    }
    if (currentStep === 2 && !timezoneValid) nextErrors.timezone = t("timezoneInvalid");
    setFieldErrors(nextErrors);
    const first = Object.keys(nextErrors)[0];
    if (first) {
      window.setTimeout(() => (form.elements.namedItem(first) as HTMLElement | null)?.focus(), 0);
      return false;
    }
    return true;
  }

  function buildReview() {
    const form = formRef.current;
    if (!form) return;
    const data = new FormData(form);
    const optionText = (name: string) =>
      (
        form.elements.namedItem(name) as HTMLSelectElement | null
      )?.selectedOptions[0]?.textContent?.trim() ?? "—";
    setReview([
      [t("studentName"), String(data.get("student_name") ?? "")],
      [t("age"), String(data.get("student_age") ?? "")],
      [t("track"), optionText("track_id")],
      [t("level"), optionText("self_level")],
      [t("country"), optionText("country_code")],
      [t("timezone"), String(data.get("timezone") ?? "")],
      [t("preferredTimes"), String(data.get("preferred_times") ?? "")],
      [t("email"), String(data.get("contact_email") ?? "") || "—"],
      [t("phone"), String(data.get("contact_phone") ?? "") || "—"],
    ]);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (step !== 3) return goTo(step + 1);
    setPending(true);
    setError("");
    setFieldErrors({});
    const form = new FormData(event.currentTarget);
    try {
      const captcha = siteKey ? await executeCaptcha(siteKey) : "local-e2e-recaptcha-token";
      const payload = {
        locale,
        student_name: form.get("student_name"),
        student_gender: gender,
        student_age: Number(form.get("student_age")),
        guardian_name: form.get("guardian_name"),
        contact_email: form.get("contact_email"),
        contact_phone: form.get("contact_phone"),
        country_code: form.get("country_code"),
        timezone: form.get("timezone"),
        track_id: form.get("track_id"),
        package_id: form.get("package_id"),
        self_level: form.get("self_level"),
        preferred_times: String(form.get("preferred_times") ?? "")
          .split(/\r?\n|,/)
          .map((item) => item.trim())
          .filter(Boolean),
        preferred_teacher_gender: form.get("preferred_teacher_gender"),
        notes: form.get("notes"),
        consent: form.get("consent") === "on",
        captcha_token: captcha,
        source: "application_page",
      };
      const response = await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await response.json()) as {
        order_no?: string;
        identifier_hint?: string;
        error?: string;
        field_errors?: Record<string, string[]>;
      };
      if (!response.ok || !body.order_no) {
        if (body.field_errors) {
          const nextErrors = Object.fromEntries(
            Object.keys(body.field_errors).map((key) => [key, t("fieldError")]),
          );
          setFieldErrors(nextErrors);
          const first = Object.keys(nextErrors)[0] ?? "";
          setStep(
            ["preferred_times", "timezone", "country_code", "package_id"].includes(first) ? 2 : 1,
          );
          window.setTimeout(
            () =>
              first && (formRef.current?.elements.namedItem(first) as HTMLElement | null)?.focus(),
            0,
          );
          return;
        }
        setError(
          body.error &&
            ["captcha_failed", "rate_limited", "selection_unavailable"].includes(body.error)
            ? body.error
            : "submission_failed",
        );
        return;
      }
      setResult({ order: body.order_no, hint: body.identifier_hint ?? "email" });
    } catch {
      setError("submission_failed");
    } finally {
      setPending(false);
    }
  }

  if (result) return <Success result={result} t={t} />;

  return (
    <>
      {siteKey ? (
        <Script
          src={`https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(siteKey)}`}
          strategy="afterInteractive"
        />
      ) : null}
      <ol className="mx-auto mt-8 grid max-w-4xl grid-cols-3 gap-2" aria-label={t("stepsLabel")}>
        {[1, 2, 3].map((number) => (
          <li
            key={number}
            className={`rounded-xl border p-3 text-center text-sm font-black ${step === number ? "border-primary bg-primary text-primary-foreground" : "bg-card text-muted-foreground"}`}
          >
            {number}. {t(`steps.${number}`)}
          </li>
        ))}
      </ol>
      <form
        ref={formRef}
        onSubmit={submit}
        noValidate
        className="mx-auto mt-4 grid max-w-4xl gap-6 rounded-3xl border bg-card p-5 shadow-soft sm:p-8"
      >
        <section
          data-step="1"
          hidden={step !== 1}
          className="grid gap-5 sm:grid-cols-2"
          aria-labelledby="application-step-1"
        >
          <h2
            id="application-step-1"
            tabIndex={-1}
            className="col-span-full text-xl font-black text-primary"
          >
            {t("steps.1")}
          </h2>
          <Field
            name="student_name"
            label={t("studentName")}
            required
            error={fieldErrors.student_name}
          />
          <NumberField
            name="student_age"
            label={t("age")}
            min={3}
            max={100}
            error={fieldErrors.student_age}
          />
          <Select
            name="student_gender"
            label={t("gender")}
            value={gender}
            onChange={(value) => setGender(value as "male" | "female")}
            options={[
              { value: "male", label: t("male") },
              { value: "female", label: t("female") },
            ]}
          />
          <Field name="guardian_name" label={t("guardianName")} error={fieldErrors.guardian_name} />
          <Select
            name="track_id"
            label={t("track")}
            options={[
              { value: "", label: t("noPreference") },
              ...tracks.map((item) => ({ value: item.id, label: item.name })),
            ]}
            error={fieldErrors.track_id}
          />
          <Select
            name="self_level"
            label={t("level")}
            required
            options={["beginner", "intermediate", "advanced", "memorizing"].map((value) => ({
              value,
              label: t(`levels.${value}`),
            }))}
            error={fieldErrors.self_level}
          />
          <Field
            name="contact_email"
            label={t("email")}
            type="email"
            dir="ltr"
            error={fieldErrors.contact_email}
          />
          <Field
            name="contact_phone"
            label={t("phone")}
            type="tel"
            dir="ltr"
            error={fieldErrors.contact_phone}
          />
        </section>

        <section
          data-step="2"
          hidden={step !== 2}
          className="grid gap-5 sm:grid-cols-2"
          aria-labelledby="application-step-2"
        >
          <h2
            id="application-step-2"
            tabIndex={-1}
            className="col-span-full text-xl font-black text-primary"
          >
            {t("steps.2")}
          </h2>
          <Select
            name="country_code"
            label={t("country")}
            required
            options={countries.map((item) => ({ value: item.code, label: item.name }))}
            error={fieldErrors.country_code}
          />
          <div className="grid gap-2">
            <Label htmlFor="timezone">{t("timezone")}</Label>
            <Input
              id="timezone"
              name="timezone"
              list="iana-timezones"
              value={timezone}
              onChange={(event) => setTimezone(event.target.value)}
              dir="ltr"
              required
              aria-invalid={Boolean(fieldErrors.timezone)}
              aria-describedby={fieldErrors.timezone ? "timezone-error" : "timezone-preview"}
            />
            <datalist id="iana-timezones">
              {ianaTimezones.map((zone) => (
                <option key={zone} value={zone} />
              ))}
            </datalist>
            {fieldErrors.timezone ? (
              <FieldError id="timezone-error">{fieldErrors.timezone}</FieldError>
            ) : (
              <p id="timezone-preview" className="text-xs text-muted-foreground">
                {timezonePreview
                  ? t("timezonePreview", { time: timezonePreview })
                  : t("timezoneInvalid")}
              </p>
            )}
          </div>
          <Select
            name="package_id"
            label={t("package")}
            options={[
              { value: "", label: t("noPreference") },
              ...packages.map((item) => ({ value: item.id, label: item.name })),
            ]}
            error={fieldErrors.package_id}
          />
          <Select
            name="preferred_teacher_gender"
            label={t("teacherGender")}
            options={[
              { value: "", label: t("automatic") },
              { value: gender, label: gender === "male" ? t("maleTeacher") : t("femaleTeacher") },
            ]}
            error={fieldErrors.preferred_teacher_gender}
          />
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="preferred_times">{t("preferredTimes")}</Label>
            <textarea
              id="preferred_times"
              name="preferred_times"
              required
              maxLength={600}
              aria-invalid={Boolean(fieldErrors.preferred_times)}
              aria-describedby={fieldErrors.preferred_times ? "preferred_times-error" : undefined}
              className="min-h-28 rounded-xl border bg-background p-3 leading-7"
              placeholder={t("timesPlaceholder")}
            />
            {fieldErrors.preferred_times ? (
              <FieldError id="preferred_times-error">{fieldErrors.preferred_times}</FieldError>
            ) : null}
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="application-notes">{t("notes")}</Label>
            <textarea
              id="application-notes"
              name="notes"
              maxLength={2000}
              className="min-h-24 rounded-xl border bg-background p-3 leading-7"
            />
          </div>
        </section>

        <section
          data-step="3"
          hidden={step !== 3}
          className="grid gap-5"
          aria-labelledby="application-step-3"
        >
          <h2 id="application-step-3" tabIndex={-1} className="text-xl font-black text-primary">
            {t("steps.3")}
          </h2>
          <dl className="grid gap-3 sm:grid-cols-2">
            {review.map(([label, value]) => (
              <div key={label} className="rounded-xl bg-muted/45 p-4">
                <dt className="text-sm font-bold text-muted-foreground">{label}</dt>
                <dd className="mt-1 font-black whitespace-pre-line text-primary">{value || "—"}</dd>
              </div>
            ))}
          </dl>
          <label className="flex items-start gap-3 rounded-xl border bg-background p-4 text-sm leading-7">
            <input name="consent" type="checkbox" required className="mt-1 size-5 accent-primary" />
            <span>
              {t("consentPrefix")}{" "}
              <Link href="/privacy" className="font-bold underline">
                {t("privacyPolicy")}
              </Link>{" "}
              {t("and")}{" "}
              <Link href="/terms" className="font-bold underline">
                {t("terms")}
              </Link>
              . {t("consentSuffix")}
              <span className="mt-1 block text-xs text-muted-foreground">
                {t("consentVersion", { version: legalDocumentVersion })}
              </span>
            </span>
          </label>
        </section>

        {error ? (
          <p role="alert" className="font-bold text-destructive">
            {t(`errors.${error}` as "errors.submission_failed")}
          </p>
        ) : null}
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
          {step > 1 ? (
            <Button
              type="button"
              variant="outline"
              onClick={(event) => {
                event.preventDefault();
                goTo(step - 1);
              }}
            >
              {locale === "ar" ? (
                <ChevronRight aria-hidden="true" />
              ) : (
                <ChevronLeft aria-hidden="true" />
              )}
              {t("back")}
            </Button>
          ) : (
            <span />
          )}
          {step < 3 ? (
            <Button
              type="button"
              variant="gold"
              onClick={(event) => {
                event.preventDefault();
                goTo(step + 1);
              }}
            >
              {t("continue")}
              {locale === "ar" ? (
                <ChevronLeft aria-hidden="true" />
              ) : (
                <ChevronRight aria-hidden="true" />
              )}
            </Button>
          ) : (
            <Button type="submit" variant="gold" size="lg" disabled={pending}>
              {pending ? (
                t("submitting")
              ) : (
                <>
                  <Send aria-hidden="true" />
                  {t("submit")}
                </>
              )}
            </Button>
          )}
        </div>
      </form>
    </>
  );
}

function Success({
  result,
  t,
}: {
  result: { order: string; hint: string };
  t: ReturnType<typeof useTranslations<"applicationsPublic">>;
}) {
  return (
    <section className="mx-auto max-w-2xl rounded-3xl border border-success/30 bg-card p-7 text-center shadow-soft">
      <CheckCircle2 className="mx-auto size-12 text-success" aria-hidden="true" />
      <h1 className="mt-4 text-3xl font-black text-primary">{t("successTitle")}</h1>
      <p className="mt-3 leading-8 text-muted-foreground">{t("successDescription")}</p>
      <p
        data-testid="application-order-number"
        className="mx-auto mt-5 w-fit rounded-xl bg-primary px-5 py-3 font-mono text-xl font-black tracking-wider text-primary-foreground"
        dir="ltr"
      >
        {result.order}
      </p>
      <p className="mt-4 text-sm text-muted-foreground">
        {t(result.hint === "phone_last4" ? "phoneHint" : "emailHint")}
      </p>
      <p className="mt-3 font-bold text-primary">{t("nextStep")}</p>
      <Button asChild className="mt-6" variant="gold">
        <Link href="/order-status">{t("trackApplication")}</Link>
      </Button>
    </section>
  );
}

function Field({
  name,
  label,
  type = "text",
  dir,
  required,
  error,
}: {
  name: string;
  label: string;
  type?: string;
  dir?: "ltr";
  required?: boolean;
  error?: string;
}) {
  const id = `${name}-error`;
  return (
    <div className="grid gap-2">
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        name={name}
        type={type}
        dir={dir}
        required={required}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? id : undefined}
      />
      {error ? <FieldError id={id}>{error}</FieldError> : null}
    </div>
  );
}
function NumberField({
  name,
  label,
  min,
  max,
  error,
}: {
  name: string;
  label: string;
  min: number;
  max: number;
  error?: string;
}) {
  const id = `${name}-error`;
  return (
    <div className="grid gap-2">
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        name={name}
        type="number"
        min={min}
        max={max}
        required
        aria-invalid={Boolean(error)}
        aria-describedby={error ? id : undefined}
      />
      {error ? <FieldError id={id}>{error}</FieldError> : null}
    </div>
  );
}
function Select({
  name,
  label,
  options,
  required,
  value,
  onChange,
  error,
}: {
  name: string;
  label: string;
  options: Array<{ value: string; label: string }>;
  required?: boolean;
  value?: string;
  onChange?: (value: string) => void;
  error?: string;
}) {
  const id = `${name}-error`;
  return (
    <div className="grid gap-2">
      <Label htmlFor={name}>{label}</Label>
      <select
        id={name}
        name={name}
        required={required}
        value={value}
        onChange={onChange ? (event) => onChange(event.target.value) : undefined}
        defaultValue={value === undefined ? options[0]?.value : undefined}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? id : undefined}
        className="min-h-11 rounded-xl border bg-background px-3"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error ? <FieldError id={id}>{error}</FieldError> : null}
    </div>
  );
}
function FieldError({ id, children }: { id: string; children: string }) {
  return (
    <p id={id} role="alert" className="text-sm font-bold text-destructive">
      {children}
    </p>
  );
}

async function executeCaptcha(siteKey: string) {
  const grecaptcha = (
    window as typeof window & {
      grecaptcha?: {
        ready: (callback: () => void) => void;
        execute: (key: string, options: { action: string }) => Promise<string>;
      };
    }
  ).grecaptcha;
  if (!grecaptcha) throw new Error("captcha_failed");
  await new Promise<void>((resolve) => grecaptcha.ready(resolve));
  return grecaptcha.execute(siteKey, { action: "apply" });
}
