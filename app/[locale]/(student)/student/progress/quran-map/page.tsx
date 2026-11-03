import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";

import { QuranMapStandaloneSection } from "@/components/progress/quran-map-standalone-section";
import { routing } from "@/i18n/routing";

export const instant = false;

export default async function StudentQuranMapPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  return <QuranMapStandaloneSection locale={locale} />;
}
