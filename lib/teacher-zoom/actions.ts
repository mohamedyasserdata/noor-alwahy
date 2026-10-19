"use server";

import type { Route } from "next";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { routing, type AppLocale } from "@/i18n/routing";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { teacherZoomSchema } from "@/lib/validators/teacher-zoom";

export async function saveTeacherZoomAction(
  localeValue: string,
  formData: FormData,
): Promise<never> {
  const locale = routing.locales.includes(localeValue as AppLocale)
    ? (localeValue as AppLocale)
    : routing.defaultLocale;
  await requireRole("teacher", locale);
  const parsed = teacherZoomSchema.safeParse({ joinUrl: formData.get("joinUrl") });
  if (!parsed.success) go(locale, "zoomError", "invalid_url");
  const supabase = await createClient();
  const { data: teacher } = await supabase.from("teachers").select("id").maybeSingle();
  if (!teacher) go(locale, "zoomError", "profile_missing");
  const { error } = await supabase
    .from("teacher_zoom_settings")
    .upsert(
      { teacher_id: teacher.id, join_url: parsed.data.joinUrl },
      { onConflict: "teacher_id" },
    );
  if (error) go(locale, "zoomError", "request_failed");
  revalidatePath(`/${locale}/teacher/zoom`);
  go(locale, "zoomStatus", "saved");
}

function go(locale: AppLocale, key: string, value: string): never {
  redirect(`/${locale}/teacher/zoom?${new URLSearchParams({ [key]: value })}` as Route);
}
