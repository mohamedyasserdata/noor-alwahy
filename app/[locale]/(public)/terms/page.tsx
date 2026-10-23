import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";

import { LegalPage } from "@/components/public-site/legal-page";
import { routing } from "@/i18n/routing";

export default async function TermsPage({ params }: PageProps<"/[locale]/terms">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  return <LegalPage locale={locale} kind="terms" />;
}
