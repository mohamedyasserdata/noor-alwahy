"use server";

import type { Route } from "next";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { routing, type AppLocale } from "@/i18n/routing";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { evaluationSettingsFormSchema } from "@/lib/validators/evaluation-settings";

function parseLocale(value: string): AppLocale {
  return routing.locales.includes(value as AppLocale)
    ? (value as AppLocale)
    : routing.defaultLocale;
}

function redirectToSettings(
  locale: AppLocale,
  key: "evaluationError" | "evaluationStatus",
  value: string,
  sessionType?: string,
): never {
  const query = new URLSearchParams({ [key]: value });
  if (sessionType) query.set("evaluationSession", sessionType);
  redirect(`/${locale}/admin/settings?${query}#evaluation-settings` as Route);
}

export async function updateEvaluationSettingsAction(
  localeValue: string,
  formData: FormData,
): Promise<never> {
  const locale = parseLocale(localeValue);
  await requireRole("admin", locale);
  const sessionType = formData.get("sessionType");
  const weights = Object.fromEntries(
    [...formData.entries()]
      .filter(([key]) => key.startsWith("weight:"))
      .map(([key, value]) => [key.slice("weight:".length), value]),
  );
  const parsed = evaluationSettingsFormSchema.safeParse({
    sessionType,
    dMajor: formData.get("dMajor"),
    dMinor: formData.get("dMinor"),
    dPrompt: formData.get("dPrompt"),
    dForgot: formData.get("dForgot"),
    ratingThresholds: [0, 1, 2, 3, 4].map((index) => formData.get(`threshold:${index}`)),
    weights,
  });

  if (!parsed.success) {
    redirectToSettings(locale, "evaluationError", "invalid_fields", String(sessionType ?? ""));
  }

  const supabase = await createClient();
  const { data } = parsed;
  const { error } = await supabase.rpc("update_evaluation_settings", {
    p_session_type: data.sessionType,
    p_weights: data.weights,
    p_d_major: data.dMajor,
    p_d_minor: data.dMinor,
    p_d_prompt: data.dPrompt,
    p_d_forgot: data.dForgot,
    p_rating_thresholds: data.ratingThresholds,
  });

  if (error) {
    redirectToSettings(locale, "evaluationError", "request_failed", data.sessionType);
  }

  revalidatePath(`/${locale}/admin/settings`);
  redirectToSettings(locale, "evaluationStatus", "updated", data.sessionType);
}
