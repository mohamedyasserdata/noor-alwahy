import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { connection } from "next/server";

import { AuditLogSection } from "@/components/admin/audit-log-section";
import { AppSettingsSection } from "@/components/admin/app-settings-section";
import { ContactLinksAdminSection } from "@/components/admin/contact-links-section";
import { StudentManagementSection } from "@/components/admin/student-management-section";
import { UserManagementSection } from "@/components/admin/user-management-section";
import { getPortalStaticParams, PortalSectionRoute } from "@/components/portal/portal-routes";
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
