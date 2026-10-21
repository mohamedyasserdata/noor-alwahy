"use client";

import { CheckCircle2, Send } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import Script from "next/script";
import { FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "@/i18n/navigation";

type Option = { id: string; name: string };
type Country = { code: string; name: string };

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
  const [gender, setGender] = useState<"male" | "female">("male");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ order: string; hint: string } | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
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
        source: "website",
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
      };
      if (!response.ok || !body.order_no) throw new Error(body.error ?? "submission_failed");
      setResult({ order: body.order_no, hint: body.identifier_hint ?? "email" });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "submission_failed");
    } finally {
      setPending(false);
    }
  }

  if (result)
    return (
      <section className="mx-auto max-w-2xl rounded-3xl border border-success/30 bg-card p-7 text-center shadow-soft">
        <CheckCircle2 className="mx-auto size-12 text-success" aria-hidden="true" />
        <h1 className="mt-4 text-3xl font-black text-primary">{t("successTitle")}</h1>
        <p className="mt-3 leading-8 text-muted-foreground">{t("successDescription")}</p>
        <p
          className="mx-auto mt-5 w-fit rounded-xl bg-primary px-5 py-3 font-mono text-xl font-black tracking-wider text-primary-foreground"
          dir="ltr"
        >
          {result.order}
        </p>
        <p className="mt-4 text-sm text-muted-foreground">
          {t(result.hint === "phone_last4" ? "phoneHint" : "emailHint")}
        </p>
        <Button asChild className="mt-6" variant="gold">
          <Link href="/order-status">{t("trackApplication")}</Link>
        </Button>
      </section>
    );

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
        className="mx-auto mt-8 grid max-w-4xl gap-6 rounded-3xl border bg-card p-5 shadow-soft sm:p-8"
      >
        <fieldset className="grid gap-5 sm:grid-cols-2">
          <legend className="col-span-full text-xl font-black text-primary">
            {t("studentSection")}
          </legend>
          <Field name="student_name" label={t("studentName")} required />
          <NumberField name="student_age" label={t("age")} min={3} max={100} />
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
          <Field name="guardian_name" label={t("guardianName")} />
          <Field name="contact_email" label={t("email")} type="email" dir="ltr" />
          <Field name="contact_phone" label={t("phone")} type="tel" dir="ltr" />
        </fieldset>
        <fieldset className="grid gap-5 sm:grid-cols-2">
          <legend className="col-span-full text-xl font-black text-primary">
            {t("learningSection")}
          </legend>
          <Select
            name="country_code"
            label={t("country")}
            required
            options={countries.map((item) => ({ value: item.code, label: item.name }))}
          />
          <Field
            name="timezone"
            label={t("timezone")}
            defaultValue={Intl.DateTimeFormat().resolvedOptions().timeZone || "Africa/Cairo"}
            dir="ltr"
            required
          />
          <Select
            name="track_id"
            label={t("track")}
            options={[
              { value: "", label: t("noPreference") },
              ...tracks.map((item) => ({ value: item.id, label: item.name })),
            ]}
          />
          <Select
            name="package_id"
            label={t("package")}
            options={[
              { value: "", label: t("noPreference") },
              ...packages.map((item) => ({ value: item.id, label: item.name })),
            ]}
          />
          <Select
            name="self_level"
            label={t("level")}
            required
            options={["beginner", "intermediate", "advanced", "memorizing"].map((value) => ({
              value,
              label: t(`levels.${value}`),
            }))}
          />
          <Select
            name="preferred_teacher_gender"
            label={t("teacherGender")}
            options={[
              { value: "", label: t("automatic") },
              { value: gender, label: gender === "male" ? t("maleTeacher") : t("femaleTeacher") },
            ]}
          />
        </fieldset>
        <div className="grid gap-2">
          <Label htmlFor="preferred_times">{t("preferredTimes")}</Label>
          <textarea
            id="preferred_times"
            name="preferred_times"
            required
            maxLength={600}
            className="min-h-28 rounded-xl border bg-background p-3 leading-7"
            placeholder={t("timesPlaceholder")}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="application-notes">{t("notes")}</Label>
          <textarea
            id="application-notes"
            name="notes"
            maxLength={2000}
            className="min-h-24 rounded-xl border bg-background p-3 leading-7"
          />
        </div>
        <label className="flex items-start gap-3 rounded-xl border bg-background p-4 text-sm leading-7">
          <input name="consent" type="checkbox" required className="mt-1 size-5 accent-primary" />
          {t("consent")}
        </label>
        {error ? (
          <p role="alert" className="font-bold text-destructive">
            {t(`errors.${error}` as "errors.submission_failed")}
          </p>
        ) : null}
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
  name,
  label,
  type = "text",
  dir,
  required,
  defaultValue,
}: {
  name: string;
  label: string;
  type?: string;
  dir?: "ltr";
  required?: boolean;
  defaultValue?: string;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        name={name}
        type={type}
        dir={dir}
        required={required}
        defaultValue={defaultValue}
      />
    </div>
  );
}
function NumberField({
  name,
  label,
  min,
  max,
}: {
  name: string;
  label: string;
  min: number;
  max: number;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} type="number" min={min} max={max} required />
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
}: {
  name: string;
  label: string;
  options: Array<{ value: string; label: string }>;
  required?: boolean;
  value?: string;
  onChange?: (value: string) => void;
}) {
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
        className="min-h-11 rounded-xl border bg-background px-3"
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
