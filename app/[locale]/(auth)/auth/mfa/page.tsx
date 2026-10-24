import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { AuthShell } from "@/components/auth/auth-shell";
import { MfaGate } from "@/components/auth/mfa-gate";
import { routing } from "@/i18n/routing";
import { isLocalAdminMfaHelperAvailable } from "@/lib/auth/local-admin-mfa";
import { requireAdminMfaEntry } from "@/lib/auth/require-role";

export const instant = false;

type MfaPageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function MfaPage({ params, searchParams }: MfaPageProps) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  const [{ supabase }, query, t, portals, localHelperAvailable] = await Promise.all([
    requireAdminMfaEntry(locale),
    searchParams,
    getTranslations({ locale, namespace: "auth.mfa" }),
    getTranslations({ locale, namespace: "portals" }),
    isLocalAdminMfaHelperAvailable(),
  ]);
  const { data, error } = await supabase.auth.mfa.listFactors();

  if (error) {
    throw error;
  }

  const verifiedFactor = data.totp[0];
  const unverifiedFactorIds = data.all
    .filter((factor) => factor.factor_type === "totp" && factor.status === "unverified")
    .map((factor) => factor.id);
  const returnTo = getAdminReturnPath(query.next, locale);

  return (
    <AuthShell
      brand={portals("brand")}
      eyebrow={t("eyebrow")}
      title={t("title")}
      description={t("description")}
      principle={t("principle")}
      theme={{
        enableDark: portals("theme.enableDark"),
        enableLight: portals("theme.enableLight"),
      }}
    >
      <MfaGate
        localHelperAvailable={localHelperAvailable}
        returnTo={returnTo}
        verifiedFactorId={verifiedFactor?.id}
        unverifiedFactorIds={unverifiedFactorIds}
        labels={{
          code: t("code"),
          enrollAction: t("enrollAction"),
          enrollDescription: t("enrollDescription"),
          enrollPending: t("enrollPending"),
          error: t("error"),
          manualCode: t("manualCode"),
          localAction: t("localAction"),
          localDescription: t("localDescription"),
          localPending: t("localPending"),
          qrAlt: t("qrAlt"),
          recovery: t("recovery"),
          signOut: t("signOut"),
          verifyAction: t("verifyAction"),
          verifyDescription: t("verifyDescription"),
          verifyPending: t("verifyPending"),
        }}
      />
    </AuthShell>
  );
}

function getAdminReturnPath(value: string | string[] | undefined, locale: string) {
  if (typeof value !== "string") return `/${locale}/admin/dashboard`;

  try {
    const decoded = decodeURIComponent(value);
    return decoded.startsWith(`/${locale}/admin/`) ? decoded : `/${locale}/admin/dashboard`;
  } catch {
    return `/${locale}/admin/dashboard`;
  }
}
