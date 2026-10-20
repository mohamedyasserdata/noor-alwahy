"use server";

import type { Route } from "next";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { routing, type AppLocale } from "@/i18n/routing";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { evaluationSettingsUpdateSchema } from "@/lib/validators/evaluation-settings";

function parseLocale(value: string): AppLocale {
  return routing.locales.includes(value as AppLocale)
    ? (value as AppLocale)
    : routing.defaultLocale;
}

function redirectToEvaluation(
  locale: AppLocale,
  sessionType: string,
  key: "evaluationError" | "evaluationStatus",
  value: string,
): never {
  const query = new URLSearchParams({ sessionType, [key]: value });
  redirect(`/${locale}/admin/evaluation?${query}` as Route);
}

export async function updateEvaluationSettingsAction(
  localeValue: string,
  formData: FormData,
): Promise<never> {
  const locale = parseLocale(localeValue);
  await requireRole("admin", locale);

  const weights = Object.fromEntries(
    [...formData.entries()]
      .filter(([key]) => key.startsWith("weight."))
      .map(([key, value]) => [key.slice("weight.".length), value]),
  );
  const sessionType = String(formData.get("sessionType") ?? "new_memo");
  const parsed = evaluationSettingsUpdateSchema.safeParse({
    sessionType,
    dMajor: formData.get("dMajor"),
    dMinor: formData.get("dMinor"),
    dPrompt: formData.get("dPrompt"),
    dForgot: formData.get("dForgot"),
    thresholds: Array.from({ length: 5 }, (_, index) => formData.get(`threshold.${index}`)),
    weights,
  });

  if (!parsed.success) {
    redirectToEvaluation(locale, sessionType, "evaluationError", "invalid_fields");
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_evaluation_settings", {
    p_session_type: parsed.data.sessionType,
    p_d_major: parsed.data.dMajor,
    p_d_minor: parsed.data.dMinor,
    p_d_prompt: parsed.data.dPrompt,
    p_d_forgot: parsed.data.dForgot,
    p_rating_thresholds: parsed.data.thresholds,
    p_weights: parsed.data.weights,
  });

  if (error) {
    redirectToEvaluation(locale, parsed.data.sessionType, "evaluationError", "request_failed");
  }

  revalidatePath(`/${locale}/admin/evaluation`);
  redirectToEvaluation(locale, parsed.data.sessionType, "evaluationStatus", "updated");
}
