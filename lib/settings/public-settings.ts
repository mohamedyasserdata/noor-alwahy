import "server-only";

import { cacheLife, cacheTag } from "next/cache";

import { createPublicClient } from "@/lib/supabase/public";
import {
  academyProfileSchema,
  supportHoursSchema,
  type AcademyProfile,
  type PublicAppSettings,
  type SupportHours,
} from "@/lib/validators/app-settings";

export const defaultAcademyProfile: AcademyProfile = {
  nameAr: "أكاديمية نور الوحي",
  nameEn: "Noor Al-Wahy Academy",
  descriptionAr: "تعليم قرآني منظم بمتابعة آمنة وواضحة.",
  descriptionEn: "Structured Quran learning with safe, clear follow-up.",
  logoPath: null,
};

export const defaultSupportHours: SupportHours = {
  ar: "تكون الاستجابة خلال مواعيد العمل المعلنة للأكاديمية.",
  en: "Responses are provided during the academy’s announced working hours.",
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function parseAcademyProfile(value: unknown): AcademyProfile {
  const record = asRecord(value);

  if (!record) {
    return defaultAcademyProfile;
  }

  const parsed = academyProfileSchema.safeParse({
    nameAr: record.name_ar,
    nameEn: record.name_en,
    descriptionAr: record.description_ar,
    descriptionEn: record.description_en,
    logoPath: record.logo_url,
  });

  return parsed.success ? parsed.data : defaultAcademyProfile;
}

function parseSupportHours(value: unknown): SupportHours {
  const record = asRecord(value);

  if (!record) {
    return defaultSupportHours;
  }

  const parsed = supportHoursSchema.safeParse({ ar: record.ar, en: record.en });
  return parsed.success ? parsed.data : defaultSupportHours;
}

export async function getPublicAppSettings(): Promise<PublicAppSettings> {
  "use cache";
  cacheLife("hours");
  cacheTag("public-app-settings");

  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("app_settings")
    .select("key,value")
    .in("key", ["academy_profile", "support_hours"]);

  if (error) {
    throw new Error("public_app_settings_unavailable", { cause: error });
  }

  const settings = new Map((data ?? []).map((row) => [row.key, row.value]));

  return {
    academyProfile: parseAcademyProfile(settings.get("academy_profile")),
    supportHours: parseSupportHours(settings.get("support_hours")),
  };
}
