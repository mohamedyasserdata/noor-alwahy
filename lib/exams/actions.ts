"use server";

import type { Route } from "next";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { routing, type AppLocale } from "@/i18n/routing";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import {
  examResultSchema,
  examSchema,
  examStatusSchema,
  lockExamResultSchema,
} from "@/lib/validators/exams";

type ExamPortal = "admin" | "teacher";
function locale(value: string): AppLocale {
  return routing.locales.includes(value as AppLocale)
    ? (value as AppLocale)
    : routing.defaultLocale;
}
function go(value: AppLocale, portal: ExamPortal, key: string, code: string): never {
  redirect(`/${value}/${portal}/exams?${new URLSearchParams({ [key]: code })}` as Route);
}
function refresh(value: AppLocale) {
  revalidatePath(`/${value}/admin/exams`);
  revalidatePath(`/${value}/teacher/exams`);
}
export async function createExamAction(localeValue: string, formData: FormData): Promise<never> {
  const current = locale(localeValue);
  const { user } = await requireRole("admin", current);
  const parsed = examSchema.safeParse({
    titleAr: formData.get("titleAr"),
    titleEn: formData.get("titleEn") ?? "",
    kind: formData.get("kind"),
    sessionType: formData.get("sessionType"),
    trackId: formData.get("trackId") ?? "",
    maxScore: formData.get("maxScore"),
    weight: formData.get("weight"),
    heldOn: formData.get("heldOn"),
  });
  if (!parsed.success) go(current, "admin", "examError", "invalid_exam");
  const supabase = await createClient();
  const { error } = await supabase.from("exams").insert({
    title_ar: parsed.data.titleAr,
    title_en: parsed.data.titleEn || null,
    kind: parsed.data.kind,
    session_type: parsed.data.sessionType,
    track_id: parsed.data.trackId || null,
    max_score: parsed.data.maxScore,
    weight: parsed.data.weight,
    held_on: parsed.data.heldOn,
    created_by: user.id,
  });
  if (error) go(current, "admin", "examError", "create_failed");
  refresh(current);
  go(current, "admin", "examStatus", "created");
}
export async function changeExamStatusAction(
  localeValue: string,
  formData: FormData,
): Promise<never> {
  const current = locale(localeValue);
  await requireRole("admin", current);
  const parsed = examStatusSchema.safeParse({
    examId: formData.get("examId"),
    status: formData.get("status"),
  });
  if (!parsed.success) go(current, "admin", "examError", "invalid_status");
  const supabase = await createClient();
  const { error } = await supabase
    .from("exams")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.examId);
  if (error) go(current, "admin", "examError", "status_failed");
  refresh(current);
  go(current, "admin", "examStatus", parsed.data.status);
}
export async function saveExamResultAction(
  localeValue: string,
  portal: ExamPortal,
  formData: FormData,
): Promise<never> {
  const current = locale(localeValue);
  await requireRole(portal, current);
  const scores = Object.fromEntries(
    [...formData.entries()]
      .filter(([key]) => key.startsWith("score:"))
      .map(([key, value]) => [key.slice(6), value]),
  );
  const parsed = examResultSchema.safeParse({
    examId: formData.get("examId"),
    studentId: formData.get("studentId"),
    scores,
    major: formData.get("major"),
    minor: formData.get("minor"),
    prompts: formData.get("prompts"),
    forgot: formData.get("forgot"),
  });
  if (!parsed.success) go(current, portal, "examError", "invalid_result");
  const supabase = await createClient();
  const { error } = await supabase.rpc("save_exam_result", {
    p_exam: parsed.data.examId,
    p_student: parsed.data.studentId,
    p_scores: parsed.data.scores,
    p_errors: {
      major: parsed.data.major,
      minor: parsed.data.minor,
      prompts: parsed.data.prompts,
      forgot: parsed.data.forgot,
    },
  });
  if (error)
    go(
      current,
      portal,
      "examError",
      error.message.includes("locked") ? "result_locked" : "save_failed",
    );
  refresh(current);
  go(current, portal, "examStatus", "result_saved");
}
export async function lockExamResultAction(
  localeValue: string,
  formData: FormData,
): Promise<never> {
  const current = locale(localeValue);
  await requireRole("admin", current);
  const parsed = lockExamResultSchema.safeParse({ resultId: formData.get("resultId") });
  if (!parsed.success) go(current, "admin", "examError", "invalid_result");
  const supabase = await createClient();
  const { error } = await supabase.rpc("lock_exam_result", { p_result: parsed.data.resultId });
  if (error) go(current, "admin", "examError", "lock_failed");
  refresh(current);
  go(current, "admin", "examStatus", "locked");
}
