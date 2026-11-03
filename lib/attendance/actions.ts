"use server";

import type { Route } from "next";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { routing, type AppLocale } from "@/i18n/routing";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { studentAttendanceStatuses } from "@/lib/attendance/rate";
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
    studentId: formData.get("studentId"),
    status: formData.get("status"),
    correctionReason: formData.get("correctionReason"),
  });
  const returnToSession = formData.get("returnToSession") === "true";
  const requestedSessionId = String(formData.get("sessionId") ?? "");
  if (
    !parsed.success ||
    !studentAttendanceStatuses.includes(
      parsed.success
        ? (parsed.data.status as (typeof studentAttendanceStatuses)[number])
        : "present",
    )
  )
    go(
      locale,
      "attendanceError",
      "invalid_fields",
      returnToSession ? requestedSessionId : undefined,
    );

  const supabase = await createClient();
  let studentId = parsed.data.studentId;
  if (!studentId) {
    const { data: session, error: sessionError } = await supabase
      .from("sessions")
      .select("student_id")
      .eq("id", parsed.data.sessionId)
      .maybeSingle();
    if (sessionError || !session) {
      go(
        locale,
        "attendanceError",
        "attendance_session_not_found",
        returnToSession ? parsed.data.sessionId : undefined,
      );
    }
    studentId = session.student_id;
  }

  const { error } = await supabase.rpc("record_student_attendance", {
    p_session_id: parsed.data.sessionId,
    p_student_id: studentId,
    p_status: parsed.data.status,
    p_correction_reason: parsed.data.correctionReason,
  });

  if (error) {
    const knownCode = [
      "attendance_forbidden",
      "attendance_conflict",
      "attendance_locked",
      "attendance_student_not_participant",
      "attendance_correction_reason_required",
      "attendance_financial_correction_requires_admin_adjustment",
      "teacher_rate_missing",
      "active_subscription_required",
    ].find((code) => error.message.includes(code));
    go(
      locale,
      "attendanceError",
      knownCode ?? "request_failed",
      returnToSession ? parsed.data.sessionId : undefined,
    );
  }

  revalidatePath(`/${locale}/teacher/today`);
  revalidatePath(`/${locale}/teacher/sessions/${parsed.data.sessionId}`);
  go(locale, "attendanceStatus", "saved", returnToSession ? parsed.data.sessionId : undefined);
}

function go(locale: AppLocale, key: string, value: string, sessionId?: string): never {
  const target = sessionId
    ? `/${locale}/teacher/sessions/${sessionId}`
    : `/${locale}/teacher/today`;
  redirect(`${target}?${new URLSearchParams({ [key]: value })}` as Route);
}
