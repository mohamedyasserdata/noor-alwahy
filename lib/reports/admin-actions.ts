"use server";

import type { Route } from "next";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { routing, type AppLocale } from "@/i18n/routing";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";

const transitionSchema = z.object({
  reportId: z.uuid(),
  status: z.enum(["admin_review", "visible", "draft"]),
  reviewNote: z.string().trim().max(2000),
  summary: z.string().trim().min(2).max(2000).optional(),
  strengths: z.string().trim().min(2).max(2000).optional(),
  improve: z.string().trim().min(2).max(2000).optional(),
  plan: z.string().trim().min(2).max(2000).optional(),
  recommendation: z.string().trim().min(2).max(2000).optional(),
});

export async function transitionReportAction(localeValue: string, formData: FormData) {
  const locale = routing.locales.includes(localeValue as AppLocale)
    ? (localeValue as AppLocale)
    : routing.defaultLocale;
  await requireRole("admin", locale);
  const parsed = transitionSchema.safeParse({
    reportId: formData.get("reportId"),
    status: formData.get("status"),
    reviewNote: formData.get("reviewNote") ?? "",
    summary: formData.get("summary") || undefined,
    strengths: formData.get("strengths") || undefined,
    improve: formData.get("improve") || undefined,
    plan: formData.get("plan") || undefined,
    recommendation: formData.get("recommendation") || undefined,
  });
  if (!parsed.success) go(locale, "invalid_fields");
  if (parsed.data.status === "admin_review" && parsed.data.reviewNote.length < 2)
    go(locale, "revision_reason_required");
  const supabase = await createClient();
  const current = await supabase
    .from("reports")
    .select("body,status")
    .eq("id", parsed.data.reportId)
    .single();
  if (current.error || !current.data.body || typeof current.data.body !== "object")
    go(locale, "request_failed");
  const canEditBody = parsed.data.status === "admin_review" || parsed.data.status === "visible";
  const body = canEditBody
    ? {
        ...current.data.body,
        summary: parsed.data.summary,
        strengths: parsed.data.strengths,
        improve: parsed.data.improve,
        plan: parsed.data.plan,
        recommendation: parsed.data.recommendation,
      }
    : current.data.body;
  const { data, error } = await supabase
    .from("reports")
    .update({
      status: parsed.data.status,
      body,
      review_note: parsed.data.status === "admin_review" ? parsed.data.reviewNote : null,
    })
    .eq("id", parsed.data.reportId)
    .eq("status", parsed.data.status === "draft" ? "visible" : "approved")
    .select("id")
    .maybeSingle();
  if (error || !data) go(locale, "request_failed");
  revalidatePath(`/${locale}/admin/reports`);
  revalidatePath(`/${locale}/parent/children`);
  revalidatePath(`/${locale}/student/progress`);
  redirect(`/${locale}/admin/reports?reportStatus=updated` as Route);
}

function go(locale: AppLocale, code: string): never {
  redirect(`/${locale}/admin/reports?reportError=${code}` as Route);
}
