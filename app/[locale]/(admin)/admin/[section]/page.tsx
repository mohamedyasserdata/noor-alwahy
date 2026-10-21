import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { connection } from "next/server";

import { AuditLogSection } from "@/components/admin/audit-log-section";
import { AssignmentManagementSection } from "@/components/admin/assignment-management-section";
import { AppSettingsSection } from "@/components/admin/app-settings-section";
import { AnnouncementAdminSection } from "@/components/announcements/announcement-admin-section";
import { ContactLinksAdminSection } from "@/components/admin/contact-links-section";
import { EvaluationSettingsSection } from "@/components/admin/evaluation-settings-section";
import { ExamManagementSection } from "@/components/exams/exam-management-section";
import { StudentManagementSection } from "@/components/admin/student-management-section";
import { TeacherManagementSection } from "@/components/admin/teacher-management-section";
import { UserManagementSection } from "@/components/admin/user-management-section";
import { AttendanceReportSection } from "@/components/attendance/attendance-report-section";
import { ApplicationCrmSection } from "@/components/applications/application-crm-section";
import { FinanceAdminSection } from "@/components/billing/finance-admin-section";
import { CertificateAdminSection } from "@/components/certificates/certificate-admin-section";
import { AdminDashboardSection } from "@/components/dashboard/admin-dashboard-section";
import { PackageAdminSection } from "@/components/packages/package-admin-section";
import { getPortalStaticParams, PortalSectionRoute } from "@/components/portal/portal-routes";
import { ScheduleSection } from "@/components/schedule/schedule-section";
import { AdminReportsSection } from "@/components/reports/admin-reports-section";
import { SubscriptionAdminSection } from "@/components/subscriptions/subscription-admin-section";
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

  if (section === "dashboard") {
    return <AdminDashboardSection locale={locale} searchParams={searchParams} />;
  }

  if (section === "audit") {
    return <AuditLogSection locale={locale} searchParams={searchParams} />;
  }

  if (section === "applications") {
    return <ApplicationCrmSection locale={locale} searchParams={searchParams} />;
  }

  if (section === "packages") {
    return <PackageAdminSection locale={locale} searchParams={searchParams} />;
  }

  if (section === "subscriptions") {
    return <SubscriptionAdminSection locale={locale} searchParams={searchParams} />;
  }

  if (section === "finance") {
    return <FinanceAdminSection locale={locale} searchParams={searchParams} />;
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

  if (section === "evaluation") {
    return <EvaluationSettingsSection locale={locale} searchParams={searchParams} />;
  }

  if (section === "exams") {
    return <ExamManagementSection locale={locale} portal="admin" searchParams={searchParams} />;
  }

  if (section === "certificates") {
    return <CertificateAdminSection locale={locale} searchParams={searchParams} />;
  }

  if (section === "reports") {
    return <AdminReportsSection locale={locale} searchParams={searchParams} />;
  }

  if (section === "announcements") {
    return <AnnouncementAdminSection locale={locale} searchParams={searchParams} />;
  }

  if (section === "settings") {
    return (
      <div className="grid gap-16">
        <AppSettingsSection locale={locale} searchParams={searchParams} />
        <ContactLinksAdminSection locale={locale} searchParams={searchParams} embedded />
      </div>
    );
  }

  return <PortalSectionRoute params={params} portal="admin" />;
}
