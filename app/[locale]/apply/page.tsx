import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { ApplicationForm } from "@/components/applications/application-form";
import { type AppLocale, routing } from "@/i18n/routing";
import { createClient } from "@/lib/supabase/server";

export default async function ApplyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "applicationsPublic" });

  return (
    <main className="min-h-screen bg-background px-4 py-12 sm:px-6">
      <header className="mx-auto max-w-3xl text-center">
        <p className="text-sm font-black text-secondary">{t("eyebrow")}</p>
        <h1 className="mt-3 text-4xl font-black text-primary">{t("title")}</h1>
        <p className="mt-4 leading-8 text-muted-foreground">{t("description")}</p>
      </header>
      <Suspense
        fallback={
          <div
            className="mx-auto mt-8 max-w-4xl rounded-3xl border bg-card p-8 shadow-soft"
            role="status"
          >
            <p className="font-bold text-muted-foreground">{t("loading")}</p>
          </div>
        }
      >
        <ApplicationOptions locale={locale} />
      </Suspense>
    </main>
  );
}

async function ApplicationOptions({ locale }: { locale: AppLocale }) {
  const supabase = await createClient();
  const [tracks, packages, countries] = await Promise.all([
    supabase.from("tracks").select("id,name_ar,name_en").eq("is_active", true).order("sort_order"),
    supabase
      .from("packages")
      .select("id,name_ar,name_en")
      .eq("is_published", true)
      .eq("is_active", true)
      .order("sort_order"),
    supabase.from("countries").select("code,name_ar,name_en").eq("is_enabled", true).order("code"),
  ]);
  if (tracks.error || packages.error || countries.error)
    throw new Error("application_options_unavailable");
  return (
    <ApplicationForm
      siteKey={process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY?.trim() ?? ""}
      tracks={(tracks.data ?? []).map((item) => ({
        id: item.id,
        name: locale === "ar" ? item.name_ar : (item.name_en ?? item.name_ar),
      }))}
      packages={(packages.data ?? []).map((item) => ({
        id: item.id,
        name: locale === "ar" ? item.name_ar : (item.name_en ?? item.name_ar),
      }))}
      countries={(countries.data ?? []).map((item) => ({
        code: item.code,
        name: locale === "ar" ? item.name_ar : (item.name_en ?? item.name_ar),
      }))}
    />
  );
}
