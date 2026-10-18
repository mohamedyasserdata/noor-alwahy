import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";

import { ContactLinksSection } from "@/components/contact/contact-links-section";
import { getPortalStaticParams, PortalSectionRoute } from "@/components/portal/portal-routes";
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

  return <PortalSectionRoute params={params} portal="student" />;
}
