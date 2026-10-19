import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { connection } from "next/server";

import { getPortalStaticParams, PortalSectionRoute } from "@/components/portal/portal-routes";
import { TeacherAvailabilitySection } from "@/components/teacher/teacher-availability-section";
import { routing } from "@/i18n/routing";

export const instant = false;

export function generateStaticParams() {
  return getPortalStaticParams("teacher");
}

export default async function TeacherSectionPage({
  params,
  searchParams,
}: PageProps<"/[locale]/teacher/[section]">) {
  const { locale, section } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  await connection();
  if (section === "availability") {
    return <TeacherAvailabilitySection locale={locale} searchParams={searchParams} />;
  }
  return <PortalSectionRoute params={params} portal="teacher" />;
}
