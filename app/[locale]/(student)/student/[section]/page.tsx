import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";

import { ContactLinksSection } from "@/components/contact/contact-links-section";
import { FamilyBillingSection } from "@/components/billing/family-billing-section";
import { StudentCertificatesSection } from "@/components/certificates/student-certificates-section";
import { getPortalStaticParams, PortalSectionRoute } from "@/components/portal/portal-routes";
import { QuranMapSection } from "@/components/progress/quran-map-section";
import { ScheduleSection } from "@/components/schedule/schedule-section";
import { StudentHomeDashboard } from "@/components/student/student-home-dashboard";
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
    return <ContactLinksSection locale={locale} appearance="student" />;
  }

  if (section === "schedule") return <ScheduleSection locale={locale} appearance="student" />;

  if (section === "billing") return <FamilyBillingSection locale={locale} appearance="student" />;

  if (section === "home") return <StudentHomeDashboard locale={locale} />;

  if (section === "progress") return <QuranMapSection locale={locale} />;

  if (section === "certificates") return <StudentCertificatesSection locale={locale} />;

  return <PortalSectionRoute params={params} portal="student" />;
}
