import { House } from "lucide-react";
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
import { loginAction } from "@/lib/auth/actions";

export const instant = false;

type LoginPageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LoginPage({ params, searchParams }: LoginPageProps) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  const [query, t, portals] = await Promise.all([
    searchParams,
    getTranslations({ locale, namespace: "auth" }),
    getTranslations({ locale, namespace: "portals" }),
  ]);
  const noticeKey = getLoginNoticeKey(query);

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
      <Link
        href="/"
        className="mb-5 inline-flex min-h-11 items-center gap-2 rounded-xl border border-secondary/30 bg-accent/35 px-4 text-sm font-black text-primary hover:border-secondary hover:bg-accent/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <House className="size-4" aria-hidden="true" />
        {t("backToHome")}
      </Link>
      <div className="mb-6">
        <h2 className="text-2xl font-black tracking-tight text-primary">{t("login.title")}</h2>
        <p className="mt-2 text-sm leading-7 text-muted-foreground">{t("login.description")}</p>
      </div>

      <AuthNotice
        message={noticeKey ? t(noticeKey) : undefined}
        success={query.status === "password_updated" || query.status === "signed_out"}
      />

      <form action={loginAction.bind(null, locale)} className="mt-6 grid gap-5">
        <div className="grid gap-2">
          <Label htmlFor="email">{t("fields.email")}</Label>
          <Input
            id="email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            required
          />
        </div>
        <div className="grid gap-2">
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="password">{t("fields.password")}</Label>
            <Link
              href="/auth/forgot-password"
              className="min-h-11 touch-manipulation py-3 text-sm font-bold text-primary underline decoration-secondary/60 underline-offset-4 outline-none hover:decoration-secondary focus-visible:rounded focus-visible:ring-2 focus-visible:ring-ring"
            >
              {t("login.forgotPassword")}
            </Link>
          </div>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </div>
        <AuthSubmitButton label={t("login.action")} pendingLabel={t("login.pending")} />
      </form>
    </AuthShell>
  );
}

function getLoginNoticeKey(query: Record<string, string | string[] | undefined>) {
  const value = typeof query.error === "string" ? query.error : query.reason;
  const keys = {
    invalid_fields: "errors.invalidFields",
    invalid_credentials: "errors.invalidCredentials",
    authentication_required: "errors.authenticationRequired",
    account_unavailable: "errors.accountUnavailable",
  } as const;

  if (query.status === "password_updated") {
    return "status.passwordUpdated" as const;
  }

  if (query.status === "signed_out") {
    return "status.signedOut" as const;
  }

  return typeof value === "string" && value in keys ? keys[value as keyof typeof keys] : null;
}
