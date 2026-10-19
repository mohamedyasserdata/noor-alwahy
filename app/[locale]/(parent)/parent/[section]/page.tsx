import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";

import { ContactLinksSection } from "@/components/contact/contact-links-section";
import { getPortalStaticParams, PortalSectionRoute } from "@/components/portal/portal-routes";
import { ScheduleSection } from "@/components/schedule/schedule-section";
import { routing } from "@/i18n/routing";

export const instant = false;

export function generateStaticParams() {
  return getPortalStaticParams("parent");
}

export default async function ParentSectionPage({
  params,
}: PageProps<"/[locale]/parent/[section]">) {
  const { locale, section } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  if (section === "contact") {
    return <ContactLinksSection locale={locale} />;
  }

  if (section === "schedule") return <ScheduleSection locale={locale} />;

  return <PortalSectionRoute params={params} portal="parent" />;
}
