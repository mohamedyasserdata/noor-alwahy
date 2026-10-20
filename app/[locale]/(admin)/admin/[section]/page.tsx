import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { connection } from "next/server";

import { AuditLogSection } from "@/components/admin/audit-log-section";
import { AssignmentManagementSection } from "@/components/admin/assignment-management-section";
import { AppSettingsSection } from "@/components/admin/app-settings-section";
import { ContactLinksAdminSection } from "@/components/admin/contact-links-section";
import { EvaluationSettingsSection } from "@/components/admin/evaluation-settings-section";
import { StudentManagementSection } from "@/components/admin/student-management-section";
import { TeacherManagementSection } from "@/components/admin/teacher-management-section";
import { UserManagementSection } from "@/components/admin/user-management-section";
import { AttendanceReportSection } from "@/components/attendance/attendance-report-section";
import { getPortalStaticParams, PortalSectionRoute } from "@/components/portal/portal-routes";
import { ScheduleSection } from "@/components/schedule/schedule-section";
import { routing } from "@/i18n/routing";

export const instant = false;

export function generateStaticParams() {
  return getPortalStaticParams("admin");
}

export default async function AdminSectionPage({
  params,
  searchParams,
}: PageProps<"/[locale]/admin/[section]">) {
  const { locale, section } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  await connection();

  if (section === "audit") {
    return <AuditLogSection locale={locale} searchParams={searchParams} />;
  }

  if (section === "users") {
    return <UserManagementSection locale={locale} searchParams={searchParams} />;
  }

  if (section === "students") {
    return <StudentManagementSection locale={locale} searchParams={searchParams} />;
  }

  if (section === "teachers") {
    return <TeacherManagementSection locale={locale} searchParams={searchParams} />;
  }

  if (section === "assignments") {
    return <AssignmentManagementSection locale={locale} searchParams={searchParams} />;
  }

  if (section === "schedule") {
    return <ScheduleSection locale={locale} searchParams={searchParams} />;
  }

  if (section === "attendance") {
    return <AttendanceReportSection locale={locale} searchParams={searchParams} />;
  }

  if (section === "settings") {
    return (
      <div className="grid gap-16">
        <AppSettingsSection locale={locale} searchParams={searchParams} />
        <EvaluationSettingsSection locale={locale} searchParams={searchParams} />
        <ContactLinksAdminSection locale={locale} searchParams={searchParams} embedded />
      </div>
    );
  }

  return <PortalSectionRoute params={params} portal="admin" />;
}
