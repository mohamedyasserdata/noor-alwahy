import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { connection } from "next/server";

import { AuthNotice } from "@/components/auth/auth-notice";
import { AuthShell } from "@/components/auth/auth-shell";
import { AuthSubmitButton } from "@/components/auth/auth-submit-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { resetPasswordAction } from "@/lib/auth/actions";
import { createClient } from "@/lib/supabase/server";

export const instant = false;

type ResetPasswordPageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ResetPasswordPage({ params, searchParams }: ResetPasswordPageProps) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  await connection();
  const supabase = await createClient();
  const [{ data }, query, t, portals] = await Promise.all([
    supabase.auth.getUser(),
    searchParams,
    getTranslations({ locale, namespace: "auth" }),
    getTranslations({ locale, namespace: "portals" }),
  ]);
  const errorMessage =
    query.error === "request_failed"
      ? t("errors.resetRequestFailed")
      : typeof query.error === "string"
        ? t("errors.invalidPassword")
        : undefined;

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
        <h2 className="text-2xl font-black tracking-tight text-primary">{t("reset.title")}</h2>
        <p className="mt-2 text-sm leading-7 text-muted-foreground">{t("reset.description")}</p>
      </div>

      {!data.user ? (
        <div className="grid gap-5">
          <AuthNotice message={t("errors.expiredLink")} />
          <Button asChild variant="gold" size="lg" className="w-full">
            <Link href="/auth/forgot-password">{t("reset.requestNewLink")}</Link>
          </Button>
        </div>
      ) : (
        <>
          <AuthNotice message={errorMessage} />
          <form action={resetPasswordAction.bind(null, locale)} className="mt-6 grid gap-5">
            <div className="grid gap-2">
              <Label htmlFor="password">{t("fields.newPassword")}</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
              />
              <p className="text-xs leading-6 text-muted-foreground">{t("reset.passwordHint")}</p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="passwordConfirm">{t("fields.passwordConfirm")}</Label>
              <Input
                id="passwordConfirm"
                name="passwordConfirm"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
              />
            </div>
            <AuthSubmitButton label={t("reset.action")} pendingLabel={t("reset.pending")} />
          </form>
        </>
      )}
    </AuthShell>
  );
}
