"use server";

import type { Route } from "next";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { routing, type AppLocale } from "@/i18n/routing";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { quranBaselineSchema } from "@/lib/validators/quran-baseline";

export async function saveAdminQuranBaselineAction(localeValue: string, formData: FormData) {
  return saveQuranBaseline(localeValue, formData, "admin");
}

export async function saveTeacherQuranBaselineAction(localeValue: string, formData: FormData) {
  return saveQuranBaseline(localeValue, formData, "teacher");
}

async function saveQuranBaseline(
  localeValue: string,
  formData: FormData,
  role: "admin" | "teacher",
) {
  const locale = routing.locales.includes(localeValue as AppLocale)
    ? (localeValue as AppLocale)
    : routing.defaultLocale;
  const { user } = await requireRole(role, locale);
  const parsed = quranBaselineSchema.safeParse({
    studentId: formData.get("studentId"),
    priorFromPage: formData.get("priorFromPage"),
    priorToPage: formData.get("priorToPage"),
    academyStartPage: formData.get("academyStartPage"),
    studyDirection: formData.get("studyDirection"),
    assessedOn: formData.get("assessedOn"),
    assessmentNotes: formData.get("assessmentNotes"),
  });
  const studentId = String(formData.get("studentId") ?? "");
  if (!parsed.success) go(locale, role, studentId, "invalid_fields");

  const value = parsed.data;
  const supabase = await createClient();
  const priorPages = [value.priorFromPage, value.priorToPage].filter(
    (page): page is number => page !== null,
  );
  const payload = {
    prior_memorized_from_page: priorPages.length ? Math.min(...priorPages) : null,
    prior_memorized_to_page: priorPages.length ? Math.max(...priorPages) : null,
    academy_start_page: value.academyStartPage,
    study_direction: value.studyDirection,
    assessed_on: value.assessedOn,
    assessment_notes: value.assessmentNotes || null,
    updated_by: user.id,
  };
  const { data: existing, error: readError } = await supabase
    .from("student_quran_baselines")
    .select("student_id")
    .eq("student_id", value.studentId)
    .maybeSingle();
  if (readError) go(locale, role, value.studentId, "save_failed");
  const { error } = existing
    ? await supabase
        .from("student_quran_baselines")
        .update(payload)
        .eq("student_id", value.studentId)
    : await supabase.from("student_quran_baselines").insert({
        ...payload,
        student_id: value.studentId,
        created_by: user.id,
      });
  if (error) go(locale, role, value.studentId, "save_failed");

  revalidatePath(`/${locale}/admin/students/${value.studentId}`);
  revalidatePath(`/${locale}/teacher/students/${value.studentId}`);
  revalidatePath(`/${locale}/student/progress`);
  const destination =
    role === "admin"
      ? `/${locale}/admin/students/${value.studentId}?baselineStatus=saved`
      : `/${locale}/teacher/students/${value.studentId}?tab=plan&baselineStatus=saved`;
  redirect(destination as Route);
}

function go(locale: AppLocale, role: "admin" | "teacher", studentId: string, code: string): never {
  const destination =
    role === "admin"
      ? `/${locale}/admin/students/${studentId}?baselineError=${code}`
      : `/${locale}/teacher/students/${studentId}?tab=plan&baselineError=${code}`;
  redirect(destination as Route);
}
