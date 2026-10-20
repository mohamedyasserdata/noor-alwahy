"use server";

import type { Route } from "next";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { routing, type AppLocale } from "@/i18n/routing";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { scoresFromFormData, sessionEvaluationSchema } from "@/lib/validators/session-evaluation";

export async function submitSessionEvaluationAction(localeValue: string, formData: FormData) {
  const locale = routing.locales.includes(localeValue as AppLocale)
    ? (localeValue as AppLocale)
    : routing.defaultLocale;
  const { user } = await requireRole("teacher", locale);
  const parsed = sessionEvaluationSchema.safeParse({
    sessionId: formData.get("sessionId"),
    sessionType: formData.get("sessionType"),
    fromSurah: formData.get("fromSurah"),
    fromAyah: formData.get("fromAyah"),
    toSurah: formData.get("toSurah"),
    toAyah: formData.get("toAyah"),
    scores: scoresFromFormData(formData),
    errorsMajor: formData.get("errorsMajor"),
    errorsMinor: formData.get("errorsMinor"),
    promptsCount: formData.get("promptsCount"),
    forgotCount: formData.get("forgotCount"),
    weakTags: String(formData.get("weakTags") ?? "")
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean),
    decision: formData.get("decision"),
    homework: formData.get("homework"),
    familyNote: formData.get("familyNote"),
  });
  if (!parsed.success) go(locale, "evaluationError", "invalid_fields", formData);

  const value = parsed.data;
  const supabase = await createClient();
  const [fromResult, toResult] = await Promise.all([
    supabase
      .from("quran_ayahs")
      .select("id,page,juz")
      .eq("surah_id", value.fromSurah)
      .eq("ayah_no", value.fromAyah)
      .maybeSingle(),
    supabase
      .from("quran_ayahs")
      .select("id,page,juz")
      .eq("surah_id", value.toSurah)
      .eq("ayah_no", value.toAyah)
      .maybeSingle(),
  ]);

  if (fromResult.error || toResult.error || !fromResult.data || !toResult.data) {
    go(locale, "evaluationError", "ayah_not_found", formData);
  }
  if (fromResult.data.id > toResult.data.id) go(locale, "evaluationError", "ayah_order", formData);

  const { data, error } = await supabase
    .from("session_evaluations")
    .upsert(
      {
        session_id: value.sessionId,
        session_type: value.sessionType,
        from_ayah_id: fromResult.data.id,
        to_ayah_id: toResult.data.id,
        pages: toResult.data.page - fromResult.data.page + 1,
        scores: value.scores,
        errors_major: value.errorsMajor,
        errors_minor: value.errorsMinor,
        prompts_count: value.promptsCount,
        forgot_count: value.forgotCount,
        weak_tags: value.weakTags,
        decision: value.decision,
        homework: value.homework ? { text: value.homework } : null,
        family_note: value.familyNote || null,
        is_locked: true,
        created_by: user.id,
      },
      { onConflict: "session_id" },
    )
    .select("total_score,rating")
    .single();

  if (error || !data) {
    const code = error?.message.includes("evaluation_locked")
      ? "evaluation_locked"
      : error?.message.includes("evaluation_criterion")
        ? "criteria_invalid"
        : "request_failed";
    go(locale, "evaluationError", code, formData);
  }

  revalidatePath(`/${locale}/teacher/evaluations`);
  redirect(
    `/${locale}/teacher/evaluations?${new URLSearchParams({
      evaluationStatus: "saved",
      score: String(data.total_score),
      rating: String(data.rating),
    })}` as Route,
  );
}

function go(locale: AppLocale, key: string, value: string, formData: FormData): never {
  const sessionId = String(formData.get("sessionId") ?? "");
  redirect(
    `/${locale}/teacher/evaluations?${new URLSearchParams({
      [key]: value,
      ...(sessionId ? { sessionId } : {}),
    })}` as Route,
  );
}
