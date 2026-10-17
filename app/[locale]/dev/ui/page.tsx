import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { ShowcasePanel } from "@/app/dev/ui/_components/showcase-panel";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { routing } from "@/i18n/routing";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/dev/ui">): Promise<Metadata> {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  const t = await getTranslations({ locale, namespace: "uiShowcase" });

  return {
    title: t("pageTitle"),
    description: t("pageDescription"),
  };
}

export default async function UiShowcasePage({ params }: PageProps<"/[locale]/dev/ui">) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  const t = await getTranslations({ locale, namespace: "uiShowcase" });

  return (
    <main
      id="main-content"
      className="mx-auto grid w-full max-w-[90rem] gap-10 px-4 py-8 sm:px-6 sm:py-12 lg:px-8"
    >
      <header className="mx-auto grid w-full max-w-3xl gap-4 text-center">
        <div className="flex flex-wrap items-center justify-center gap-3">
          <BadgeLabel label={t("directionBadge")} />
          <Suspense fallback={<LocaleSwitcherFallback />}>
            <LocaleSwitcher />
          </Suspense>
        </div>
        <h1 className="text-3xl font-black tracking-tight text-balance text-primary sm:text-5xl">
          {t("pageTitle")}
        </h1>
        <p className="text-base leading-8 text-pretty text-muted-foreground sm:text-lg">
          {t("pageDescription")}
        </p>
      </header>

      <ShowcasePanel />
    </main>
  );
}

function LocaleSwitcherFallback() {
  return (
    <span
      className="inline-flex min-h-11 min-w-40 animate-pulse rounded-full border bg-card shadow-card motion-reduce:animate-none"
      aria-hidden="true"
    />
  );
}

function BadgeLabel({ label }: { label: string }) {
  return (
    <span className="inline-flex min-h-8 items-center rounded-full border border-secondary/30 bg-secondary/12 px-3 text-xs font-extrabold text-primary">
      {label}
    </span>
  );
}
