import "server-only";

import { cacheLife, cacheTag } from "next/cache";

import { createPublicClient } from "@/lib/supabase/public";
import { packageFeatureSchema } from "@/lib/validators/packages";

export type PublicCountry = {
  code: string;
  nameAr: string;
  nameEn: string | null;
};

export type PublicPackage = {
  amount: number;
  audience: string | null;
  billingPeriod: "monthly" | "quarterly" | "yearly";
  countryCode: string;
  currency: string;
  descriptionAr: string | null;
  descriptionEn: string | null;
  durationMin: number;
  features: Array<{ ar: string; en: string; icon: string }>;
  id: string;
  nameAr: string;
  nameEn: string | null;
  sessionsPerWeek: number;
  slug: string;
  teacherGender: "male" | "female" | null;
  trackNameAr: string | null;
  trackNameEn: string | null;
};

export async function getPublicCountries(): Promise<PublicCountry[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("public-packages");

  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("countries")
    .select("code,name_ar,name_en")
    .eq("is_enabled", true)
    .order("code");

  if (error) throw new Error("public_countries_unavailable", { cause: error });

  return (data ?? []).map((country) => ({
    code: country.code,
    nameAr: country.name_ar,
    nameEn: country.name_en,
  }));
}

export async function getPublicPackages(countryCode: string): Promise<PublicPackage[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("public-packages");

  const supabase = createPublicClient();
  const { data, error } = await supabase.rpc("get_public_package_catalog", {
    p_country: countryCode,
  });

  if (error) throw new Error("public_packages_unavailable", { cause: error });

  return (data ?? []).map((entry) => ({
    amount: entry.amount,
    audience: entry.audience,
    billingPeriod: entry.billing_period,
    countryCode: entry.country_code,
    currency: entry.currency,
    descriptionAr: entry.description_ar,
    descriptionEn: entry.description_en,
    durationMin: entry.duration_min,
    features: Array.isArray(entry.features)
      ? entry.features.flatMap((feature) => {
          const parsed = packageFeatureSchema.safeParse(feature);
          return parsed.success ? [parsed.data] : [];
        })
      : [],
    id: entry.package_id,
    nameAr: entry.name_ar,
    nameEn: entry.name_en,
    sessionsPerWeek: entry.sessions_per_week,
    slug: entry.slug,
    teacherGender: entry.teacher_gender,
    trackNameAr: entry.track_name_ar,
    trackNameEn: entry.track_name_en,
  }));
}
