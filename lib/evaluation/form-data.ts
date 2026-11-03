import "server-only";

import { createClient } from "@/lib/supabase/server";

import { evaluationDraftVersion, type EvaluationDraft } from "./draft";
import { getEvaluationSettings } from "./settings";

export async function getEvaluationFormData() {
  const supabase = await createClient();
  const sessionsPromise = supabase
    .from("sessions")
    .select(
      "id,scheduled_at,duration_min,student:students!sessions_student_id_fkey(full_name),evaluation:session_evaluations(id,is_locked,total_score,rating,session_type,from_ayah:quran_ayahs!session_evaluations_from_ayah_id_fkey(surah_id,ayah_no),to_ayah:quran_ayahs!session_evaluations_to_ayah_id_fkey(surah_id,ayah_no),scores,errors_major,errors_minor,prompts_count,forgot_count,weak_tags,decision,homework,family_note,updated_at)",
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
    sessions: sessionsResult.data.map((session) => ({
      id: session.id,
      scheduledAt: session.scheduled_at,
      durationMin: session.duration_min,
      studentName: session.student?.full_name ?? "—",
      evaluation: normalizeEvaluation(
        Array.isArray(session.evaluation) ? session.evaluation[0] : session.evaluation,
      ),
    })),
    surahs: surahsResult.data.map((surah) => ({
      id: surah.id,
      nameAr: surah.name_ar,
      nameEn: surah.name_en,
      ayahCount: surah.ayah_count,
    })),
    settings,
  };
}

function normalizeEvaluation(
  evaluation: {
    id: string;
    is_locked: boolean;
    total_score: number;
    rating: number;
    session_type:
      "new_memo" | "near_review" | "far_review" | "recitation" | "noorani" | "matn_theory";
    from_ayah: { surah_id: number; ayah_no: number } | null;
    to_ayah: { surah_id: number; ayah_no: number } | null;
    scores: unknown;
    errors_major: number;
    errors_minor: number;
    prompts_count: number;
    forgot_count: number;
    weak_tags: string[];
    decision: string | null;
    homework: unknown;
    family_note: string | null;
    updated_at: string;
  } | null,
) {
  if (!evaluation) return null;
  const scores =
    evaluation.scores && typeof evaluation.scores === "object" && !Array.isArray(evaluation.scores)
      ? Object.fromEntries(
          Object.entries(evaluation.scores).filter(
            (entry): entry is [string, number] => typeof entry[1] === "number",
          ),
        )
      : {};
  const homework =
    evaluation.homework &&
    typeof evaluation.homework === "object" &&
    !Array.isArray(evaluation.homework) &&
    "text" in evaluation.homework &&
    typeof evaluation.homework.text === "string"
      ? evaluation.homework.text
      : "";
  const draft: EvaluationDraft | null =
    !evaluation.is_locked && evaluation.from_ayah && evaluation.to_ayah
      ? {
          version: evaluationDraftVersion,
          sessionType: evaluation.session_type,
          fromSurah: evaluation.from_ayah.surah_id,
          fromAyah: evaluation.from_ayah.ayah_no,
          toSurah: evaluation.to_ayah.surah_id,
          toAyah: evaluation.to_ayah.ayah_no,
          scores,
          errorsMajor: evaluation.errors_major,
          errorsMinor: evaluation.errors_minor,
          promptsCount: evaluation.prompts_count,
          forgotCount: evaluation.forgot_count,
          weakTags: evaluation.weak_tags.join(", "),
          decision:
            evaluation.decision === "repeat" || evaluation.decision === "next"
              ? evaluation.decision
              : "passed",
          homework,
          familyNote: evaluation.family_note ?? "",
        }
      : null;
  return {
    ...evaluation,
    scores,
    homework,
    decision:
      evaluation.decision === "repeat" || evaluation.decision === "next"
        ? evaluation.decision
        : "passed",
    draft,
  };
}
