import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";

import { ContactLinksSection } from "@/components/contact/contact-links-section";
import { ParentChildrenSection } from "@/components/parent/parent-children-section";
import { getPortalStaticParams, PortalSectionRoute } from "@/components/portal/portal-routes";
import { ScheduleSection } from "@/components/schedule/schedule-section";
import { NextSessionSection } from "@/components/sessions/next-session-section";
import { routing } from "@/i18n/routing";

export const instant = false;

export function generateStaticParams() {
  return getPortalStaticParams("parent");
}

export default async function ParentSectionPage({
  params,
  searchParams,
}: PageProps<"/[locale]/parent/[section]">) {
  const { locale, section } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  if (section === "contact") {
    return <ContactLinksSection locale={locale} />;
  }

  if (section === "schedule") return <ScheduleSection locale={locale} />;

  if (section === "children") {
    return (
      <div className="grid gap-12">
        <NextSessionSection locale={locale} />
        <ParentChildrenSection locale={locale} searchParams={searchParams} />
      </div>
    );
  }

  return <PortalSectionRoute params={params} portal="parent" />;
}
