import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";

import { AuditLogSection } from "@/components/admin/audit-log-section";
import { getPortalStaticParams, PortalSectionRoute } from "@/components/portal/portal-routes";
import { routing } from "@/i18n/routing";

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

  if (section === "audit") {
    return <AuditLogSection locale={locale} searchParams={searchParams} />;
  }

  return <PortalSectionRoute params={params} portal="admin" />;
}
