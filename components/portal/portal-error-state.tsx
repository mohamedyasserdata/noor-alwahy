"use client";

import { AlertTriangle, House, RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

type PortalErrorStateProps = {
  portal: "student" | "parent";
  retry: () => void;
  digest?: string;
};

export function PortalErrorState({ portal, retry, digest }: PortalErrorStateProps) {
  const t = useTranslations(`portalErrors.${portal}`);

  return (
    <section
      className="mx-auto grid min-h-[28rem] w-full max-w-3xl place-items-center px-4 text-center"
      aria-labelledby={`${portal}-error-title`}
      data-error-digest={digest}
    >
      <div className="w-full rounded-[1.75rem] border border-destructive/25 bg-card p-7 shadow-card sm:p-10">
        <span className="mx-auto grid size-14 place-items-center rounded-full bg-destructive/10 text-destructive">
          <AlertTriangle className="size-7" aria-hidden="true" />
        </span>
        <p className="mt-5 text-sm font-black text-destructive">{t("eyebrow")}</p>
        <h1
          id={`${portal}-error-title`}
          className="mt-2 text-2xl font-black text-primary sm:text-3xl"
        >
          {t("title")}
        </h1>
        <p className="mx-auto mt-4 max-w-xl leading-7 text-muted-foreground">{t("description")}</p>
        <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
          <Button type="button" variant="gold" onClick={retry}>
            <RefreshCw aria-hidden="true" />
            {t("retry")}
          </Button>
          <Button asChild variant="outline">
            <Link href={`/${portal}`}>
              <House aria-hidden="true" />
              {t("home")}
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
