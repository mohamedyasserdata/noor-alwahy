"use server";

import type { Route } from "next";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { routing, type AppLocale } from "@/i18n/routing";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { assignmentActionSchema } from "@/lib/validators/assignments";

export async function manageAssignmentAction(
  localeValue: string,
  formData: FormData,
): Promise<never> {
  const locale = routing.locales.includes(localeValue as AppLocale)
    ? (localeValue as AppLocale)
    : routing.defaultLocale;
  await requireRole("admin", locale);
  const parsed = assignmentActionSchema.safeParse({
    studentId: formData.get("studentId"),
    teacherId: formData.get("teacherId"),
    trackId: formData.get("trackId"),
    action: formData.get("action"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) go(locale, "assignmentError", "invalid_fields");
  const value = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.rpc("manage_teacher_assignment", {
    p_action: value.action,
    p_reason: value.reason,
    p_student: value.studentId,
    p_teacher: value.teacherId,
    p_track: value.trackId,
  });
  if (error) {
    const code = error.message.includes("gender_mismatch")
      ? "gender_mismatch"
      : error.message.includes("capacity")
        ? "capacity_reached"
        : "request_failed";
    go(locale, "assignmentError", code);
  }
  revalidatePath(`/${locale}/admin/assignments`);
  revalidatePath(`/${locale}/admin/students`);
  go(locale, "assignmentStatus", value.action);
}

function go(locale: AppLocale, key: string, value: string): never {
  redirect(`/${locale}/admin/assignments?${new URLSearchParams({ [key]: value })}` as Route);
}
