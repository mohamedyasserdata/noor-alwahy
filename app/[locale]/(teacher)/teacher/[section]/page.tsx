import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { connection } from "next/server";

import { getPortalStaticParams, PortalSectionRoute } from "@/components/portal/portal-routes";
import { SessionEvaluationsSection } from "@/components/evaluation/session-evaluations-section";
import { ScheduleSection } from "@/components/schedule/schedule-section";
import { TeacherAvailabilitySection } from "@/components/teacher/teacher-availability-section";
import { TeacherTodaySection } from "@/components/teacher/teacher-today-section";
import { TeacherZoomSection } from "@/components/teacher/teacher-zoom-section";
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
  if (section === "today") {
    return <TeacherTodaySection locale={locale} searchParams={searchParams} />;
  }
  if (section === "evaluations") {
    return <SessionEvaluationsSection locale={locale} searchParams={searchParams} />;
  }
  if (section === "availability") {
    return <TeacherAvailabilitySection locale={locale} searchParams={searchParams} />;
  }
  if (section === "schedule") return <ScheduleSection locale={locale} />;
  if (section === "zoom") {
    return <TeacherZoomSection locale={locale} searchParams={searchParams} />;
  }
  return <PortalSectionRoute params={params} portal="teacher" />;
}
