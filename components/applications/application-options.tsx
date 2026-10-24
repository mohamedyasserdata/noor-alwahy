import "server-only";

import { cacheLife, cacheTag } from "next/cache";

import { ApplicationForm } from "@/components/applications/application-form";
import type { AppLocale } from "@/i18n/routing";
import { createPublicClient } from "@/lib/supabase/public";

type ApplicationOptionsProps = { locale: AppLocale };

export async function ApplicationOptions({ locale }: ApplicationOptionsProps) {
  const { countries, packages, tracks } = await getApplicationOptions();

  return (
    <ApplicationForm
      siteKey={process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY?.trim() ?? ""}
      tracks={tracks.map((item) => ({
        id: item.id,
        name: locale === "ar" ? item.name_ar : (item.name_en ?? item.name_ar),
      }))}
      packages={packages.map((item) => ({
        id: item.id,
        name: locale === "ar" ? item.name_ar : (item.name_en ?? item.name_ar),
      }))}
      countries={countries.map((item) => ({
        code: item.code,
        name: locale === "ar" ? item.name_ar : (item.name_en ?? item.name_ar),
      }))}
    />
  );
}

async function getApplicationOptions() {
  "use cache";
  cacheLife("hours");
  cacheTag("public-application-options", "public-packages");

  const supabase = createPublicClient();
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

  if (tracks.error || packages.error || countries.error) {
    throw new Error("application_options_unavailable");
  }

  return {
    countries: countries.data ?? [],
    packages: packages.data ?? [],
    tracks: tracks.data ?? [],
  };
}
