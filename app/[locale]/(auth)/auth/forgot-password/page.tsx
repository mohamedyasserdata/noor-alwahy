import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { AuthNotice } from "@/components/auth/auth-notice";
import { AuthShell } from "@/components/auth/auth-shell";
import { AuthSubmitButton } from "@/components/auth/auth-submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { forgotPasswordAction } from "@/lib/auth/actions";

export const instant = false;

type ForgotPasswordPageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ForgotPasswordPage({
  params,
  searchParams,
}: ForgotPasswordPageProps) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  const [query, t, portals] = await Promise.all([
    searchParams,
    getTranslations({ locale, namespace: "auth" }),
    getTranslations({ locale, namespace: "portals" }),
  ]);
  const isSent = query.status === "sent";
  const hasError = typeof query.error === "string";

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
        <h2 className="text-2xl font-black tracking-tight text-primary">{t("forgot.title")}</h2>
        <p className="mt-2 text-sm leading-7 text-muted-foreground">{t("forgot.description")}</p>
      </div>

      <AuthNotice
        success={isSent}
        message={
          isSent ? t("status.resetSent") : hasError ? t("errors.resetRequestFailed") : undefined
        }
      />

      <form action={forgotPasswordAction.bind(null, locale)} className="mt-6 grid gap-5">
        <div className="grid gap-2">
          <Label htmlFor="email">{t("fields.email")}</Label>
          <Input
            id="email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            required
          />
        </div>
        <AuthSubmitButton label={t("forgot.action")} pendingLabel={t("forgot.pending")} />
      </form>

      <Link
        href="/auth/login"
        className="mt-5 flex min-h-11 touch-manipulation items-center justify-center rounded-lg text-sm font-bold text-primary outline-none hover:bg-accent/55 focus-visible:ring-2 focus-visible:ring-ring"
      >
        {t("backToLogin")}
      </Link>
    </AuthShell>
  );
}
