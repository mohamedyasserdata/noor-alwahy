import "server-only";

import { createClient } from "@/lib/supabase/server";

import { getEvaluationSettings } from "./settings";

export async function getEvaluationFormData() {
  const supabase = await createClient();
  const sessionsPromise = supabase
    .from("sessions")
    .select(
      "id,scheduled_at,duration_min,student:students!sessions_student_id_fkey(full_name),evaluation:session_evaluations(id,is_locked,total_score,rating,session_type)",
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
      evaluation: Array.isArray(session.evaluation) ? session.evaluation[0] : session.evaluation,
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
