"use server";

import type { Route } from "next";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { routing, type AppLocale } from "@/i18n/routing";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { reportApprovalSchema, reportDraftSchema } from "@/lib/validators/report";

function localeFrom(value: string): AppLocale {
  return routing.locales.includes(value as AppLocale)
    ? (value as AppLocale)
    : routing.defaultLocale;
}

function go(locale: AppLocale, key: "reportStatus" | "reportError", value: string): never {
  redirect(`/${locale}/teacher/reports?${new URLSearchParams({ [key]: value })}` as Route);
}

export async function saveReportDraftAction(localeValue: string, formData: FormData) {
  const locale = localeFrom(localeValue);
  await requireRole("teacher", locale);
  const reportId = formData.get("reportId");
  const parsed = reportDraftSchema.safeParse({
    reportId: typeof reportId === "string" && reportId ? reportId : undefined,
    studentId: formData.get("studentId"),
    periodType: formData.get("periodType"),
    periodStart: formData.get("periodStart"),
    periodEnd: formData.get("periodEnd"),
    summary: formData.get("summary"),
    strengths: formData.get("strengths"),
    improve: formData.get("improve"),
    plan: formData.get("plan"),
    recommendation: formData.get("recommendation"),
  });
  if (!parsed.success) go(locale, "reportError", "invalid_fields");

  const supabase = await createClient();
  const { data: teacher, error: teacherError } = await supabase
    .from("teachers")
    .select("id")
    .single();
  if (teacherError) go(locale, "reportError", "request_failed");

  const value = parsed.data;
  const body = {
    metrics: {},
    summary: value.summary,
    strengths: value.strengths,
    improve: value.improve,
    plan: value.plan,
    recommendation: value.recommendation,
  };
  const result = value.reportId
    ? await supabase.from("reports").update({ body }).eq("id", value.reportId).eq("status", "draft")
    : await supabase.from("reports").insert({
        student_id: value.studentId,
        teacher_id: teacher.id,
        period_type: value.periodType,
        period_start: value.periodStart,
        period_end: value.periodEnd,
        body,
      });
  if (result.error) {
    const code = result.error.code === "23505" ? "duplicate_period" : "request_failed";
    go(locale, "reportError", code);
  }

  revalidatePath(`/${locale}/teacher/reports`);
  go(locale, "reportStatus", "saved");
}

export async function approveReportAction(localeValue: string, formData: FormData) {
  const locale = localeFrom(localeValue);
  await requireRole("teacher", locale);
  const parsed = reportApprovalSchema.safeParse({ reportId: formData.get("reportId") });
  if (!parsed.success) go(locale, "reportError", "invalid_fields");

  const supabase = await createClient();
  const { error } = await supabase
    .from("reports")
    .update({ status: "approved" })
    .eq("id", parsed.data.reportId)
    .eq("status", "draft");
  if (error) go(locale, "reportError", "request_failed");

  revalidatePath(`/${locale}/teacher/reports`);
  go(locale, "reportStatus", "approved");
}
