"use client";

import { Search } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { FormEvent, useState } from "react";
import { DateTime } from "luxon";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ApplicationStatusForm() {
  const locale = useLocale() as "ar" | "en";
  const t = useTranslations("applicationsPublic.status");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<"notFound" | "unavailable" | null>(null);
  const [result, setResult] = useState<{ status: string; updated_at: string } | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);
    setResult(null);
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/applications/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order_no: form.get("order_no"),
          identifier: form.get("identifier"),
          locale,
        }),
      });
      if (!response.ok) {
        setError(response.status === 404 ? "notFound" : "unavailable");
        return;
      }
      const body = await response.json();
      if (
        typeof body?.status !== "string" ||
        !t.has(`states.${body.status}` as "states.new") ||
        typeof body.updated_at !== "string" ||
        !DateTime.fromISO(body.updated_at).isValid
      ) {
        setError("unavailable");
        return;
      }
      setResult({ status: body.status, updated_at: body.updated_at });
    } catch {
      setError("unavailable");
    } finally {
      setPending(false);
    }
  }
  return (
    <form
      onSubmit={submit}
      className="mx-auto mt-8 grid max-w-xl gap-5 rounded-3xl border bg-card p-6 shadow-soft"
    >
      <div className="grid gap-2">
        <Label htmlFor="order_no">{t("order")}</Label>
        <Input id="order_no" name="order_no" dir="ltr" required placeholder="NW-A-…" />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="identifier">{t("identifier")}</Label>
        <Input id="identifier" name="identifier" dir="ltr" required />
      </div>
      {error ? (
        <p role="alert" className="font-bold text-destructive">
          {t(error)}
        </p>
      ) : null}
      {result ? (
        <div
          role="status"
          className="rounded-2xl border border-success/30 bg-success/10 p-5 text-center"
        >
          <p className="text-sm text-muted-foreground">{t("current")}</p>
          <p className="mt-2 text-xl font-black text-primary">
            {t(`states.${result.status}` as "states.new")}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            {t("updated", {
              date: DateTime.fromISO(result.updated_at)
                .setLocale(locale)
                .toLocaleString(DateTime.DATETIME_MED),
            })}
          </p>
        </div>
      ) : null}
      <Button type="submit" variant="gold" disabled={pending}>
        <Search aria-hidden="true" />
        {pending ? t("checking") : t("check")}
      </Button>
    </form>
  );
}
