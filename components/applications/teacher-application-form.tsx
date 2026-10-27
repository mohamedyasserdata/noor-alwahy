"use client";

import { CheckCircle2, FileText, Send } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import Script from "next/script";
import { FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "@/i18n/navigation";

const languageValues = ["ar", "en", "fr", "other"] as const;

export function TeacherApplicationForm({ siteKey }: { siteKey: string }) {
  const locale = useLocale() as "ar" | "en";
  const t = useTranslations("teacherApplications.public");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [applicationNumber, setApplicationNumber] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const captcha = siteKey ? await executeCaptcha(siteKey) : "local-e2e-recaptcha-token";
      form.set("locale", locale);
      form.set("captcha_token", captcha);
      const response = await fetch("/api/teacher-applications", { method: "POST", body: form });
      const body = (await response.json()) as { application_no?: string; error?: string };
      if (!response.ok || !body.application_no) {
        throw new Error(body.error ?? "submission_failed");
      }
      setApplicationNumber(body.application_no);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "submission_failed");
    } finally {
      setPending(false);
    }
  }

  if (applicationNumber) {
    return (
      <section className="rounded-[1.75rem] border border-success/35 bg-card p-6 text-center shadow-card sm:p-9">
        <CheckCircle2 className="mx-auto size-12 text-success" aria-hidden="true" />
        <h2 className="mt-4 text-3xl font-black text-balance text-primary">{t("success.title")}</h2>
        <p className="mx-auto mt-3 max-w-xl leading-8 text-muted-foreground">
          {t("success.description")}
        </p>
        <p
          className="mx-auto mt-5 w-fit rounded-xl bg-primary px-5 py-3 font-mono text-lg font-black tracking-wider text-primary-foreground"
          data-testid="teacher-application-number"
          dir="ltr"
        >
          {applicationNumber}
        </p>
        <Button asChild variant="outline" className="mt-6">
          <Link href="/">{t("success.backHome")}</Link>
        </Button>
      </section>
    );
  }

  return (
    <>
      {siteKey ? (
        <Script
          src={`https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(siteKey)}`}
          strategy="afterInteractive"
        />
      ) : null}
      <form
        onSubmit={submit}
        className="grid gap-8 rounded-[1.75rem] border border-secondary/25 bg-card p-5 shadow-card sm:p-8"
      >
        <fieldset className="grid gap-5 sm:grid-cols-2">
          <legend className="col-span-full text-xl font-black text-primary">
            {t("sections.identity")}
          </legend>
          <Field name="full_name" label={t("fields.fullName")} autoComplete="name" required />
          <Field
            name="email"
            label={t("fields.email")}
            type="email"
            autoComplete="email"
            dir="ltr"
            required
          />
          <Field
            name="phone"
            label={t("fields.phone")}
            type="tel"
            autoComplete="tel"
            dir="ltr"
            required
          />
          <div className="grid gap-2">
            <Label htmlFor="teacher-application-gender">{t("fields.gender")}</Label>
            <select
              id="teacher-application-gender"
              name="gender"
              defaultValue="female"
              className="min-h-11 rounded-xl border bg-background px-3 text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="female">{t("gender.female")}</option>
              <option value="male">{t("gender.male")}</option>
            </select>
          </div>
        </fieldset>

        <fieldset className="grid gap-5 sm:grid-cols-2">
          <legend className="col-span-full text-xl font-black text-primary">
            {t("sections.experience")}
          </legend>
          <Field
            name="specialization"
            label={t("fields.specialization")}
            autoComplete="off"
            required
          />
          <Field
            name="experience_years"
            label={t("fields.experienceYears")}
            type="number"
            inputMode="numeric"
            min={0}
            max={80}
            autoComplete="off"
            required
          />
          <TextArea
            name="qualifications"
            label={t("fields.qualifications")}
            className="sm:col-span-2"
            maxLength={3000}
            required
          />
          <div className="grid gap-3 sm:col-span-2">
            <p className="font-bold text-foreground">{t("fields.languages")}</p>
            <div className="flex flex-wrap gap-3">
              {languageValues.map((language) => (
                <label
                  key={language}
                  className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border bg-background px-4 font-bold text-foreground hover:border-secondary"
                >
                  <input
                    type="checkbox"
                    name="teaching_languages"
                    value={language}
                    defaultChecked={language === "ar"}
                    className="size-4 accent-secondary"
                  />
                  {t(`languages.${language}`)}
                </label>
              ))}
            </div>
          </div>
          <TextArea
            name="availability"
            label={t("fields.availability")}
            className="sm:col-span-2"
            maxLength={2000}
            required
          />
        </fieldset>

        <fieldset className="grid gap-5">
          <legend className="text-xl font-black text-primary">{t("sections.documents")}</legend>
          <div className="grid gap-2">
            <Label htmlFor="teacher-application-cv">{t("fields.cv")}</Label>
            <div className="flex min-h-28 flex-col justify-center rounded-2xl border border-dashed border-secondary/45 bg-background/70 p-5">
              <FileText className="size-6 text-secondary" aria-hidden="true" />
              <Input
                id="teacher-application-cv"
                name="cv"
                type="file"
                accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                className="mt-3 h-auto py-2"
              />
              <p className="mt-2 text-xs leading-6 text-muted-foreground">{t("fields.cvHint")}</p>
            </div>
          </div>
        </fieldset>

        <label className="flex cursor-pointer items-start gap-3 rounded-2xl border bg-background/70 p-4">
          <input name="consent" type="checkbox" required className="mt-1 size-4 accent-secondary" />
          <span className="text-sm leading-7 text-muted-foreground">
            {t("consent.before")}{" "}
            <Link href="/privacy" className="font-bold text-primary underline">
              {t("consent.privacy")}
            </Link>{" "}
            {t("consent.after")}
          </span>
        </label>

        <div aria-live="polite">
          {error ? (
            <p role="alert" className="font-bold text-destructive">
              {t(`errors.${knownError(error)}`)}
            </p>
          ) : null}
        </div>
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
      </form>
    </>
  );
}

function Field({
  autoComplete,
  dir,
  inputMode,
  label,
  max,
  min,
  name,
  required,
  type = "text",
}: {
  autoComplete: string;
  dir?: "ltr";
  inputMode?: "numeric";
  label: string;
  max?: number;
  min?: number;
  name: string;
  required?: boolean;
  type?: string;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={`teacher-application-${name}`}>{label}</Label>
      <Input
        id={`teacher-application-${name}`}
        name={name}
        type={type}
        dir={dir}
        inputMode={inputMode}
        autoComplete={autoComplete}
        spellCheck={type === "email" ? false : undefined}
        min={min}
        max={max}
        required={required}
      />
    </div>
  );
}

function TextArea({
  className,
  label,
  maxLength,
  name,
  required,
}: {
  className?: string;
  label: string;
  maxLength: number;
  name: string;
  required?: boolean;
}) {
  return (
    <div className={`grid gap-2 ${className ?? ""}`}>
      <Label htmlFor={`teacher-application-${name}`}>{label}</Label>
      <textarea
        id={`teacher-application-${name}`}
        name={name}
        required={required}
        maxLength={maxLength}
        autoComplete="off"
        className="min-h-32 resize-y rounded-xl border bg-background px-4 py-3 leading-7 text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
    </div>
  );
}

function knownError(value: string) {
  return [
    "already_submitted",
    "captcha_failed",
    "cv_too_large",
    "cv_type",
    "cv_upload_failed",
    "invalid_fields",
    "rate_limited",
  ].includes(value)
    ? value
    : "submission_failed";
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
