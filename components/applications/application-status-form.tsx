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
  const [error, setError] = useState(false);
  const [result, setResult] = useState<{ status: string; updated_at: string } | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(false);
    setResult(null);
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/applications/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        order_no: form.get("order_no"),
        identifier: form.get("identifier"),
        locale,
      }),
    });
    const body = (await response.json()) as { status?: string; updated_at?: string };
    if (response.ok && body.status && body.updated_at)
      setResult({ status: body.status, updated_at: body.updated_at });
    else setError(true);
    setPending(false);
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
          {t("notFound")}
        </p>
      ) : null}
      {result ? (
        <div className="rounded-2xl border border-success/30 bg-success/10 p-5 text-center">
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
