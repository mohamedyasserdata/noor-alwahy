import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { connection } from "next/server";

import { getPortalStaticParams, PortalSectionRoute } from "@/components/portal/portal-routes";
import { SessionEvaluationsSection } from "@/components/evaluation/session-evaluations-section";
import { ExamManagementSection } from "@/components/exams/exam-management-section";
import { ScheduleSection } from "@/components/schedule/schedule-section";
import { TeacherMemorizationPlansSection } from "@/components/progress/teacher-memorization-plans-section";
import { TeacherReportsSection } from "@/components/reports/teacher-reports-section";
import { TeacherAvailabilitySection } from "@/components/teacher/teacher-availability-section";
import { TeacherTodaySection } from "@/components/teacher/teacher-today-section";
import { TeacherAttendanceSection } from "@/components/teacher/teacher-attendance-section";
import { TeacherChangeRequestsSection } from "@/components/teacher/teacher-change-requests-section";
import { TeacherNotificationsSection } from "@/components/teacher/teacher-notifications-section";
import { TeacherProfileSection } from "@/components/teacher/teacher-profile-section";
import { TeacherEarningsSection } from "@/components/payouts/teacher-earnings-section";
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
  let content: React.ReactNode;
  if (section === "today") {
    content = <TeacherTodaySection locale={locale} searchParams={searchParams} />;
  } else if (section === "evaluations") {
    content = <SessionEvaluationsSection locale={locale} searchParams={searchParams} />;
  } else if (section === "exams") {
    content = (
      <ExamManagementSection locale={locale} portal="teacher" searchParams={searchParams} />
    );
  } else if (section === "students") {
    content = <TeacherMemorizationPlansSection locale={locale} searchParams={searchParams} />;
  } else if (section === "attendance") {
    content = <TeacherAttendanceSection locale={locale} />;
  } else if (section === "reports") {
    content = <TeacherReportsSection locale={locale} searchParams={searchParams} />;
  } else if (section === "notifications") {
    content = <TeacherNotificationsSection locale={locale} />;
  } else if (section === "requests") {
    content = <TeacherChangeRequestsSection locale={locale} />;
  } else if (section === "availability") {
    content = <TeacherAvailabilitySection locale={locale} searchParams={searchParams} />;
  } else if (section === "schedule") {
    content = <ScheduleSection locale={locale} />;
  } else if (section === "zoom") {
    content = <TeacherZoomSection locale={locale} searchParams={searchParams} />;
  } else if (section === "earnings") {
    content = <TeacherEarningsSection locale={locale} />;
  } else if (section === "profile") {
    content = <TeacherProfileSection locale={locale} searchParams={searchParams} />;
  } else {
    content = <PortalSectionRoute params={params} portal="teacher" />;
  }
  return <div className="teacher-page">{content}</div>;
}
