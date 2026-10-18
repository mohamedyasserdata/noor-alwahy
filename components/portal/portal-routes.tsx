import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";

import { portalConfig, type PortalId } from "@/components/portal/portal-config";
import { PortalSection } from "@/components/portal/portal-section";
import { PortalShell } from "@/components/portal/portal-shell";
import { redirect } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { requireRole } from "@/lib/auth/require-role";

type PortalLayoutRouteProps = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
  portal: PortalId;
};

type PortalSectionRouteProps = {
  params: Promise<{ locale: string; section: string }>;
  portal: PortalId;
};

export async function PortalLayoutRoute({ children, params, portal }: PortalLayoutRouteProps) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  await requireRole(portal, locale);

  return (
    <PortalShell locale={locale} portal={portal}>
      {children}
    </PortalShell>
  );
}

export async function PortalIndexRoute({
  params,
  portal,
}: Omit<PortalLayoutRouteProps, "children">) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  redirect({
    href: `/${portal}/${portalConfig[portal].defaultSection}`,
    locale,
  });

  return null;
}

export async function PortalSectionRoute({ params, portal }: PortalSectionRouteProps) {
  const { locale, section } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  return <PortalSection locale={locale} portal={portal} section={section} />;
}

export function getPortalStaticParams(portal: PortalId) {
  return portalConfig[portal].sections.map((section) => ({ section }));
}
