import { hasLocale } from "next-intl";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";

import { AssignmentManagementSection } from "@/components/admin/assignment-management-section";
import { AuditLogSection } from "@/components/admin/audit-log-section";
import { AppSettingsSection } from "@/components/admin/app-settings-section";
import { AnnouncementAdminSection } from "@/components/announcements/announcement-admin-section";
import { ContactLinksAdminSection } from "@/components/admin/contact-links-section";
import { StudentManagementSection } from "@/components/admin/student-management-section";
import { TeacherDirectorySection } from "@/components/admin/teacher-directory-section";
import { UserManagementSection } from "@/components/admin/user-management-section";
import { TeacherApplicationSection } from "@/components/admin/teacher-application-section";
import { AttendanceReportSection } from "@/components/attendance/attendance-report-section";
import { ApplicationCrmSection } from "@/components/applications/application-crm-section";
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

  if (section === "control-center") redirect(`/${locale}/admin/dashboard`);
  if (section === "audit") {
    const query = await searchParams;
    const next = new URLSearchParams({ panel: "security-log" });
    for (const key of ["action", "table", "record", "page"] as const) {
      const value = query[key];
      if (typeof value === "string" && value) next.set(key, value);
    }
    redirect(`/${locale}/admin/settings?${next}`);
  }

  if (section === "applications") {
    return <ApplicationCrmSection locale={locale} searchParams={searchParams} />;
  }

  if (section === "teacher-applications") {
    return <TeacherApplicationSection locale={locale} searchParams={searchParams} />;
  }

  if (section === "packages") {
    return <PackageAdminSection locale={locale} searchParams={searchParams} />;
  }

  if (section === "subscriptions") {
    return <SubscriptionAdminSection locale={locale} searchParams={searchParams} />;
  }

  if (section === "finance") redirect(`/${locale}/admin/subscriptions`);

  if (section === "users") {
    return <UserManagementSection locale={locale} searchParams={searchParams} />;
  }

  if (section === "students") {
    return <StudentManagementSection locale={locale} searchParams={searchParams} />;
  }

  if (section === "teachers") {
    return <TeacherDirectorySection locale={locale} searchParams={searchParams} />;
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

  if (section === "evaluation" || section === "exams") redirect(`/${locale}/admin/reports`);
  if (section === "certificates") redirect(`/${locale}/admin/students`);

  if (section === "reports") {
    return <AdminReportsSection locale={locale} searchParams={searchParams} />;
  }

  if (section === "announcements") {
    return <AnnouncementAdminSection locale={locale} searchParams={searchParams} />;
  }

  if (section === "templates") redirect(`/${locale}/admin/settings`);

  if (section === "settings") {
    return (
      <div className="grid gap-16">
        <AppSettingsSection locale={locale} searchParams={searchParams} />
        <ContactLinksAdminSection locale={locale} searchParams={searchParams} embedded />
        <div id="security-log" className="scroll-mt-24 border-t border-secondary/20 pt-12">
          <AuditLogSection locale={locale} searchParams={searchParams} />
        </div>
      </div>
    );
  }

  return <PortalSectionRoute params={params} portal="admin" />;
}
