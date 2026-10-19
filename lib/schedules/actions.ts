"use server";

import type { Route } from "next";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { routing, type AppLocale } from "@/i18n/routing";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { scheduleSlotSchema } from "@/lib/validators/schedules";

export async function saveScheduleSlotAction(
  localeValue: string,
  formData: FormData,
): Promise<never> {
  const locale = routing.locales.includes(localeValue as AppLocale)
    ? (localeValue as AppLocale)
    : routing.defaultLocale;
  await requireRole("admin", locale);
  const parsed = scheduleSlotSchema.safeParse({
    assignmentId: formData.get("assignmentId"),
    weekday: formData.get("weekday"),
    localStartTime: formData.get("localStartTime"),
    durationMin: formData.get("durationMin"),
    anchorTimezone: formData.get("anchorTimezone"),
  });
  if (!parsed.success) go(locale, "scheduleError", "invalid_fields");
  const value = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.from("schedule_slots").insert({
    assignment_id: value.assignmentId,
    weekday: value.weekday,
    local_start_time: value.localStartTime,
    duration_min: value.durationMin,
    anchor_timezone: value.anchorTimezone,
  });
  if (error)
    go(
      locale,
      "scheduleError",
      error.message.includes("duplicate") ? "duplicate" : "request_failed",
    );
  for (const portal of ["admin", "teacher", "student", "parent"]) {
    revalidatePath(`/${locale}/${portal}/schedule`);
  }
  go(locale, "scheduleStatus", "saved");
}

function go(locale: AppLocale, key: string, value: string): never {
  redirect(`/${locale}/admin/schedule?${new URLSearchParams({ [key]: value })}` as Route);
}
