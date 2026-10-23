"use server";

import type { Route } from "next";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { routing, type AppLocale } from "@/i18n/routing";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { reportApprovalSchema, reportDraftSchema } from "@/lib/validators/report";
import { z } from "zod";

const templateVersionSchema = z.union([z.literal(""), z.string().uuid()]);
const renderedTemplateSchema = z.object({
  subject: z.string().nullable(),
  body: z.string(),
  missing: z.array(z.string()),
  version_id: z.string().uuid(),
  version_no: z.coerce.number().int().positive(),
  locale: z.enum(["ar", "en"]),
});

type TemplateScalar = string | number | boolean | null;

function templateScalar(value: unknown, fallback: TemplateScalar): TemplateScalar {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return fallback;
}

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
  const templateVersion = templateVersionSchema.safeParse(formData.get("templateVersionId") ?? "");
  if (!templateVersion.success) go(locale, "reportError", "invalid_fields");
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
    ? await supabase
        .from("reports")
        .update({ body })
        .eq("id", value.reportId)
        .eq("status", "draft")
        .select("id,student_id,period_start,period_end,body")
        .single()
    : await supabase
        .from("reports")
        .insert({
          student_id: value.studentId,
          teacher_id: teacher.id,
          period_type: value.periodType,
          period_start: value.periodStart,
          period_end: value.periodEnd,
          body,
        })
        .select("id,student_id,period_start,period_end,body")
        .single();
  if (result.error) {
    const code = result.error.code === "23505" ? "duplicate_period" : "request_failed";
    go(locale, "reportError", code);
  }

  if (templateVersion.data) {
    const metrics =
      result.data.body && typeof result.data.body === "object" && "metrics" in result.data.body
        ? (result.data.body.metrics as Record<string, unknown>)
        : {};
    const [studentResult, profileResult] = await Promise.all([
      supabase.from("students").select("full_name").eq("id", result.data.student_id).single(),
      supabase.from("profiles").select("full_name").single(),
    ]);
    if (studentResult.error || profileResult.error) go(locale, "reportError", "request_failed");
    const attendance =
      metrics.attendance && typeof metrics.attendance === "object"
        ? (metrics.attendance as Record<string, unknown>)
        : {};
    const { data: rendered, error: renderError } = await supabase.rpc("render_content_template", {
      p_version: templateVersion.data,
      p_locale: locale,
      p_values: {
        student_name: studentResult.data.full_name,
        teacher_name: profileResult.data.full_name,
        period_start: result.data.period_start,
        period_end: result.data.period_end,
        attendance_rate: templateScalar(attendance.rate, "—"),
        evaluation_average: templateScalar(metrics.evaluation_average, "—"),
        mastered_pages: templateScalar(metrics.mastered_pages, 0),
        recommendation: value.recommendation,
      },
    });
    const parsedRender = renderedTemplateSchema.safeParse(rendered);
    if (renderError || !parsedRender.success || parsedRender.data.missing.length)
      go(locale, "reportError", "request_failed");
    const currentBody = result.data.body as Record<string, unknown>;
    const { error: templateError } = await supabase
      .from("reports")
      .update({
        content_template_version_id: templateVersion.data,
        body: { ...currentBody, template_rendered: parsedRender.data },
      })
      .eq("id", result.data.id)
      .eq("status", "draft");
    if (templateError) go(locale, "reportError", "request_failed");
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
