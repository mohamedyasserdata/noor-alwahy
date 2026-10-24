import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { ApplicationOptions } from "@/components/applications/application-options";
import { routing } from "@/i18n/routing";

export default async function ApplyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "applicationsPublic" });

  return (
    <main className="min-h-screen bg-background px-4 py-12 sm:px-6">
      <header className="mx-auto max-w-3xl text-center">
        <p className="text-sm font-black text-secondary">{t("eyebrow")}</p>
        <h1 className="mt-3 text-4xl font-black text-primary">{t("title")}</h1>
        <p className="mt-4 leading-8 text-muted-foreground">{t("description")}</p>
      </header>
      <Suspense
        fallback={
          <div
            className="mx-auto mt-8 max-w-4xl rounded-3xl border bg-card p-8 shadow-soft"
            role="status"
          >
            <p className="font-bold text-muted-foreground">{t("loading")}</p>
          </div>
        }
      >
        <ApplicationOptions locale={locale} />
      </Suspense>
    </main>
  );
}
