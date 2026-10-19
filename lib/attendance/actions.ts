"use server";

import type { Route } from "next";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { routing, type AppLocale } from "@/i18n/routing";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { recordAttendanceSchema } from "@/lib/validators/attendance";

export async function recordAttendanceAction(
  localeValue: string,
  formData: FormData,
): Promise<never> {
  const locale = routing.locales.includes(localeValue as AppLocale)
    ? (localeValue as AppLocale)
    : routing.defaultLocale;
  await requireRole("teacher", locale);

  const parsed = recordAttendanceSchema.safeParse({
    sessionId: formData.get("sessionId"),
    status: formData.get("status"),
  });
  if (!parsed.success) go(locale, "attendanceError", "invalid_fields");

  const supabase = await createClient();
  const { error } = await supabase.rpc("record_attendance", {
    p_session_id: parsed.data.sessionId,
    p_status: parsed.data.status,
  });

  if (error) {
    const knownCode = [
      "attendance_forbidden",
      "attendance_conflict",
      "teacher_rate_missing",
      "active_subscription_required",
    ].find((code) => error.message.includes(code));
    go(locale, "attendanceError", knownCode ?? "request_failed");
  }

  revalidatePath(`/${locale}/teacher/today`);
  go(locale, "attendanceStatus", "saved");
}

function go(locale: AppLocale, key: string, value: string): never {
  redirect(`/${locale}/teacher/today?${new URLSearchParams({ [key]: value })}` as Route);
}
