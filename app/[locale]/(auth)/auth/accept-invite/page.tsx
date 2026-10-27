import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { AuthShell } from "@/components/auth/auth-shell";
import { InviteSessionBridge } from "@/components/auth/invite-session-bridge";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

export const instant = false;

export default async function AcceptInvitePage({
  params,
}: PageProps<"/[locale]/auth/accept-invite">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  const [t, portals] = await Promise.all([
    getTranslations({ locale, namespace: "auth" }),
    getTranslations({ locale, namespace: "portals" }),
  ]);

  return (
    <AuthShell
      brand={portals("brand")}
      eyebrow={t("shell.eyebrow")}
      homeLabel={t("backToHome")}
      title={t("shell.title")}
      description={t("shell.description")}
      principle={t("shell.principle")}
      theme={{
        enableDark: portals("theme.enableDark"),
        enableLight: portals("theme.enableLight"),
      }}
    >
      <div className="mb-6">
        <h2 className="text-2xl font-black tracking-tight text-primary">{t("invite.title")}</h2>
        <p className="mt-2 text-sm leading-7 text-muted-foreground">{t("invite.description")}</p>
      </div>
      <InviteSessionBridge
        destination={`/${locale}/auth/reset-password`}
        loadingMessage={t("invite.loading")}
        errorMessage={t("invite.error")}
      />
      <Link
        href="/auth/login"
        className="mt-5 flex min-h-11 touch-manipulation items-center justify-center rounded-lg text-sm font-bold text-primary outline-none hover:bg-accent/55 focus-visible:ring-2 focus-visible:ring-ring"
      >
        {t("backToLogin")}
      </Link>
    </AuthShell>
  );
}
