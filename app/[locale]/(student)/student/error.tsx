"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";

export default function StudentPortalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("studentExperience.error");

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto grid min-h-[70svh] w-full max-w-2xl place-items-center px-4 py-12">
      <section className="w-full rounded-3xl border border-secondary/25 bg-card p-6 text-center shadow-card sm:p-10">
        <span className="mx-auto grid size-14 place-items-center rounded-full bg-destructive/10 text-destructive">
          <AlertTriangle className="size-7" aria-hidden="true" />
        </span>
        <h1 className="mt-5 text-2xl font-black text-primary">{t("title")}</h1>
        <p className="mx-auto mt-3 max-w-lg leading-7 text-muted-foreground">{t("description")}</p>
        <Button type="button" className="mt-6" onClick={reset}>
          <RotateCcw aria-hidden="true" />
          {t("retry")}
        </Button>
        <p className="mt-4 text-sm text-muted-foreground">{t("preserved")}</p>
      </section>
    </div>
  );
}
