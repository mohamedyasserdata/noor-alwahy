"use server";

import type { Route } from "next";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { routing, type AppLocale } from "@/i18n/routing";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { publicAppSettingsSchema } from "@/lib/validators/app-settings";

function parseLocale(value: string): AppLocale {
  return routing.locales.includes(value as AppLocale)
    ? (value as AppLocale)
    : routing.defaultLocale;
}

function redirectToSettings(
  locale: AppLocale,
  key: "settingError" | "settingStatus",
  value: string,
): never {
  redirect(`/${locale}/admin/settings?${new URLSearchParams({ [key]: value })}` as Route);
}

export async function updatePublicAppSettingsAction(
  localeValue: string,
  formData: FormData,
): Promise<never> {
  const locale = parseLocale(localeValue);
  await requireRole("admin", locale);
  const parsed = publicAppSettingsSchema.safeParse({
    academyProfile: {
      nameAr: formData.get("nameAr"),
      nameEn: formData.get("nameEn"),
      descriptionAr: formData.get("descriptionAr"),
      descriptionEn: formData.get("descriptionEn"),
      logoPath: formData.get("logoPath") || null,
    },
    supportHours: {
      ar: formData.get("supportHoursAr"),
      en: formData.get("supportHoursEn"),
    },
  });

  if (!parsed.success) {
    redirectToSettings(locale, "settingError", "invalid_fields");
  }

  const supabase = await createClient();
  const { academyProfile, supportHours } = parsed.data;
  const { error } = await supabase.rpc("update_public_app_settings", {
    p_academy_profile: {
      name_ar: academyProfile.nameAr,
      name_en: academyProfile.nameEn,
      description_ar: academyProfile.descriptionAr,
      description_en: academyProfile.descriptionEn,
      logo_url: academyProfile.logoPath,
    },
    p_support_hours: supportHours,
  });

  if (error) {
    redirectToSettings(locale, "settingError", "request_failed");
  }

  revalidatePath(`/${locale}`, "layout");
  redirectToSettings(locale, "settingStatus", "updated");
}
