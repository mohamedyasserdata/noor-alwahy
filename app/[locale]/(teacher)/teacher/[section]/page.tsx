import { hasLocale } from "next-intl";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";

import { getPortalStaticParams, PortalSectionRoute } from "@/components/portal/portal-routes";
import { ScheduleSection } from "@/components/schedule/schedule-section";
import { TeacherReportsSection } from "@/components/reports/teacher-reports-section";
import { TeacherTodaySection } from "@/components/teacher/teacher-today-section";
import { TeacherNotificationsSection } from "@/components/teacher/teacher-notifications-section";
import { TeacherProfileSection } from "@/components/teacher/teacher-profile-section";
import { TeacherEarningsSection } from "@/components/payouts/teacher-earnings-section";
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
  if (section === "attendance") redirect(`/${locale}/teacher/profile?tab=attendance`);
  if (section === "availability") redirect(`/${locale}/teacher/profile?tab=availability`);
  if (section === "evaluations") redirect(`/${locale}/teacher/students?status=evaluation_pending`);
  if (section === "requests") redirect(`/${locale}/teacher/notifications`);
  if (section === "zoom") redirect(`/${locale}/teacher/schedule`);
  if (section === "exams") redirect(`/${locale}/teacher/students`);
  let content: React.ReactNode;
  if (section === "today") {
    content = <TeacherTodaySection locale={locale} searchParams={searchParams} />;
  } else if (section === "reports") {
    content = <TeacherReportsSection locale={locale} searchParams={searchParams} />;
  } else if (section === "notifications") {
    content = <TeacherNotificationsSection locale={locale} />;
  } else if (section === "schedule") {
    content = <ScheduleSection locale={locale} />;
  } else if (section === "earnings") {
    content = <TeacherEarningsSection locale={locale} />;
  } else if (section === "profile") {
    content = <TeacherProfileSection locale={locale} searchParams={searchParams} />;
  } else {
    content = <PortalSectionRoute params={params} portal="teacher" />;
  }
  return <div className="teacher-page">{content}</div>;
}
