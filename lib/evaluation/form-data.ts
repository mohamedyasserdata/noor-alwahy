import "server-only";

import { createClient } from "@/lib/supabase/server";

import { evaluationDraftVersion, type EvaluationDraft } from "./draft";

import { getEvaluationSettings } from "./settings";

export async function getEvaluationFormData() {
  const supabase = await createClient();
  const sessionsPromise = supabase
    .from("sessions")
    .select(
      "id,scheduled_at,duration_min,student:students!sessions_student_id_fkey(full_name),evaluation:session_evaluations(id,is_locked,total_score,rating,session_type,scores,errors_major,errors_minor,prompts_count,forgot_count,weak_tags,decision,homework,family_note,updated_at,from_ayah:quran_ayahs!session_evaluations_from_ayah_id_fkey(surah_id,ayah_no),to_ayah:quran_ayahs!session_evaluations_to_ayah_id_fkey(surah_id,ayah_no))",
    )
    .eq("status", "held")
    .order("scheduled_at", { ascending: false })
    .limit(24);
  const surahsPromise = supabase
    .from("quran_surahs")
    .select("id,name_ar,name_en,ayah_count")
    .order("id");
  const [sessionsResult, surahsResult, settings] = await Promise.all([
    sessionsPromise,
    surahsPromise,
    getEvaluationSettings(),
  ]);

  if (sessionsResult.error || surahsResult.error) throw new Error("evaluation_form_unavailable");

  return {
    sessions: sessionsResult.data.map((session) => {
      const evaluation = Array.isArray(session.evaluation)
        ? session.evaluation[0]
        : session.evaluation;
      return {
        id: session.id,
        scheduledAt: session.scheduled_at,
        durationMin: session.duration_min,
        studentName: session.student?.full_name ?? "—",
        evaluation: evaluation
          ? {
              ...evaluation,
              draft: evaluation.is_locked ? null : toDraft(evaluation),
            }
          : null,
      };
    }),
    surahs: surahsResult.data.map((surah) => ({
      id: surah.id,
      nameAr: surah.name_ar,
      nameEn: surah.name_en,
      ayahCount: surah.ayah_count,
    })),
    settings,
  };
}

function toDraft(evaluation: {
  session_type: EvaluationDraft["sessionType"];
  scores: unknown;
  errors_major: number;
  errors_minor: number;
  prompts_count: number;
  forgot_count: number;
  weak_tags: string[];
  decision: string | null;
  homework: unknown;
  family_note: string | null;
  from_ayah: { surah_id: number; ayah_no: number } | null;
  to_ayah: { surah_id: number; ayah_no: number } | null;
}): EvaluationDraft {
  const homework = evaluation.homework as { text?: unknown } | null;
  return {
    version: evaluationDraftVersion,
    sessionType: evaluation.session_type,
    fromSurah: evaluation.from_ayah?.surah_id ?? 1,
    fromAyah: evaluation.from_ayah?.ayah_no ?? 1,
    toSurah: evaluation.to_ayah?.surah_id ?? 1,
    toAyah: evaluation.to_ayah?.ayah_no ?? 7,
    scores: evaluation.scores as Record<string, number>,
    errorsMajor: evaluation.errors_major,
    errorsMinor: evaluation.errors_minor,
    promptsCount: evaluation.prompts_count,
    forgotCount: evaluation.forgot_count,
    weakTags: evaluation.weak_tags.join(", "),
    decision:
      evaluation.decision === "repeat" || evaluation.decision === "next"
        ? evaluation.decision
        : "passed",
    homework: typeof homework?.text === "string" ? homework.text : "",
    familyNote: evaluation.family_note ?? "",
  };
}
