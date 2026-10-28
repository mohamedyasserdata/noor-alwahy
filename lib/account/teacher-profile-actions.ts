"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { DateTime } from "luxon";
import { z } from "zod";

import type { AppLocale } from "@/i18n/routing";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  displayName: z.string().trim().min(2).max(100),
  preferredLocale: z.enum(["ar", "en"]),
  timezone: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .refine((value) => DateTime.now().setZone(value).isValid, "invalid_timezone"),
});

export async function saveTeacherProfileAction(locale: AppLocale, formData: FormData) {
  const parsed = schema.safeParse({
    displayName: formData.get("displayName"),
    preferredLocale: formData.get("preferredLocale"),
    timezone: formData.get("timezone"),
  });
  if (!parsed.success) redirect(`/${locale}/teacher/profile?profileError=invalid_fields`);

  const identity = await requireRole("teacher", locale);
  const supabase = await createClient();

  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: parsed.data.displayName,
      preferred_locale: parsed.data.preferredLocale,
      timezone: parsed.data.timezone,
    })
    .eq("id", identity.user.id);
  if (error) redirect(`/${locale}/teacher/profile?profileError=save_failed`);

  revalidatePath(`/${locale}/teacher`, "layout");
  redirect(`/${locale}/teacher/profile?profileStatus=saved`);
}
