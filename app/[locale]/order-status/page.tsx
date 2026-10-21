import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { ApplicationStatusForm } from "@/components/applications/application-status-form";
import { routing } from "@/i18n/routing";

export default async function OrderStatusPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "applicationsPublic.status" });
  return (
    <main className="min-h-screen bg-background px-4 py-16">
      <header className="mx-auto max-w-2xl text-center">
        <p className="text-sm font-black text-secondary">{t("eyebrow")}</p>
        <h1 className="mt-3 text-4xl font-black text-primary">{t("title")}</h1>
        <p className="mt-4 leading-8 text-muted-foreground">{t("description")}</p>
      </header>
      <ApplicationStatusForm />
    </main>
  );
}
