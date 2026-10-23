import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";

import { LegalPage } from "@/components/public-site/legal-page";
import { routing } from "@/i18n/routing";

export default async function PrivacyPage({ params }: PageProps<"/[locale]/privacy">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  return <LegalPage locale={locale} kind="privacy" />;
}
