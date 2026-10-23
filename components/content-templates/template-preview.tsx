"use client";

import { Eye, LoaderCircle } from "lucide-react";
import { useState, useTransition } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type PreviewProps = {
  locale: "ar" | "en";
  versionId: string;
  variables: Array<{ key: string; fallback?: string }>;
};

export function TemplatePreview({ locale, versionId, variables }: PreviewProps) {
  const ar = locale === "ar";
  const [values, setValues] = useState<Record<string, string>>({});
  const [result, setResult] = useState<{
    subject: string | null;
    body: string;
    missing: string[];
  }>();
  const [error, setError] = useState(false);
  const [pending, startTransition] = useTransition();

  function preview() {
    setError(false);
    startTransition(async () => {
      const response = await fetch("/api/admin/templates/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ versionId, locale, values }),
      });
      const payload = (await response.json().catch(() => null)) as {
        subject: string | null;
        body: string;
        missing: string[];
      } | null;
      if (!response.ok || !payload) setError(true);
      else setResult(payload);
    });
  }

  return (
    <details className="border-t bg-muted/15">
      <summary className="cursor-pointer px-4 py-3 text-sm font-black text-primary">
        {ar ? "معاينة ببيانات آمنة" : "Preview with safe values"}
      </summary>
      <div className="grid gap-4 border-t p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          {variables.map((variable) => (
            <label key={variable.key} className="grid gap-1.5 text-xs font-bold">
              <span dir="ltr">{`{{${variable.key}}}`}</span>
              <Input
                value={values[variable.key] ?? ""}
                placeholder={variable.fallback ?? (ar ? "مطلوب" : "Required")}
                onChange={(event) => setValues({ ...values, [variable.key]: event.target.value })}
              />
            </label>
          ))}
        </div>
        <Button type="button" variant="outline" onClick={preview} disabled={pending}>
          {pending ? <LoaderCircle className="animate-spin motion-reduce:animate-none" /> : <Eye />}
          {pending
            ? ar
              ? "جارٍ التعبئة…"
              : "Rendering…"
            : ar
              ? "تعبئة المعاينة"
              : "Render preview"}
        </Button>
        {error ? (
          <Alert variant="warning">
            {ar ? "تعذرت المعاينة. راجع القيم." : "Preview failed. Review the values."}
          </Alert>
        ) : null}
        {result ? (
          <section className="border bg-background p-4" aria-live="polite">
            {result.missing.length ? (
              <Alert variant="warning">
                {ar ? "حقول ناقصة: " : "Missing fields: "}
                {result.missing.join(", ")}
              </Alert>
            ) : null}
            {result.subject ? (
              <h4 className="mt-3 font-black text-primary">{result.subject}</h4>
            ) : null}
            <p className="mt-3 text-sm leading-7 whitespace-pre-wrap text-foreground">
              {result.body}
            </p>
          </section>
        ) : null}
      </div>
    </details>
  );
}
