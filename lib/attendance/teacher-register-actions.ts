"use server";

import type { Route } from "next";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { routing, type AppLocale } from "@/i18n/routing";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { recordTeacherAttendanceSchema } from "@/lib/validators/attendance";

export async function recordTeacherAttendanceAction(
  localeValue: string,
  formData: FormData,
): Promise<never> {
  const locale = routing.locales.includes(localeValue as AppLocale)
    ? (localeValue as AppLocale)
    : routing.defaultLocale;
  await requireRole("admin", locale);
  const parsed = recordTeacherAttendanceSchema.safeParse({
    sessionId: formData.get("sessionId"),
    status: formData.get("status"),
    minutes: formData.get("minutes"),
    note: formData.get("note"),
  });
  if (!parsed.success) go(locale, "invalid_fields");

  const supabase = await createClient();
  const { error } = await supabase.rpc("record_teacher_attendance", {
    p_session_id: parsed.data.sessionId,
    p_status: parsed.data.status,
    ...(parsed.data.minutes === undefined ? {} : { p_minutes: parsed.data.minutes }),
    ...(parsed.data.note === undefined ? {} : { p_note: parsed.data.note }),
  });
  if (error) {
    const known = [
      "teacher_attendance_session_not_found",
      "teacher_attendance_session_not_ended",
      "teacher_attendance_admin_required",
      "teacher_attendance_correction_reason_required",
    ].find((code) => error.message.includes(code));
    go(locale, known ?? "request_failed");
  }

  revalidatePath(`/${locale}/admin/attendance`);
  revalidatePath(`/${locale}/teacher/profile`);
  redirect(`/${locale}/admin/attendance?teacherAttendanceStatus=saved` as Route);
}

function go(locale: AppLocale, code: string): never {
  redirect(`/${locale}/admin/attendance?teacherAttendanceError=${code}` as Route);
}
