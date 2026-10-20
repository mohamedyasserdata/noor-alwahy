import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";

import { ContactLinksSection } from "@/components/contact/contact-links-section";
import { getPortalStaticParams, PortalSectionRoute } from "@/components/portal/portal-routes";
import { QuranMapSection } from "@/components/progress/quran-map-section";
import { ScheduleSection } from "@/components/schedule/schedule-section";
import { NextSessionSection } from "@/components/sessions/next-session-section";
import { routing } from "@/i18n/routing";

export const instant = false;

export function generateStaticParams() {
  return getPortalStaticParams("student");
}

export default async function StudentSectionPage({
  params,
}: PageProps<"/[locale]/student/[section]">) {
  const { locale, section } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  if (section === "contact") {
    return <ContactLinksSection locale={locale} />;
  }

  if (section === "schedule") return <ScheduleSection locale={locale} />;

  if (section === "home") return <NextSessionSection locale={locale} />;

  if (section === "progress") return <QuranMapSection locale={locale} />;

  return <PortalSectionRoute params={params} portal="student" />;
}
