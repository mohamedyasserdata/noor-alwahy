import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";

import { QuranSurahDetail } from "@/components/progress/quran-surah-detail";
import { routing } from "@/i18n/routing";

export const instant = false;

export default async function StudentQuranSurahPage({
  params,
}: {
  params: Promise<{ locale: string; surahId: string }>;
}) {
  const { locale, surahId } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const id = Number(surahId);
  if (!Number.isInteger(id) || id < 1 || id > 114) notFound();
  return <QuranSurahDetail locale={locale} surahId={id} />;
}
