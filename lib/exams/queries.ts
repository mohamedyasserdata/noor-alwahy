import "server-only";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function getExamManagementData() {
  await connection();
  const supabase = await createClient();
  const [exams, results, students, tracks, criteria] = await Promise.all([
    supabase
      .from("exams")
      .select(
        "id,title_ar,title_en,kind,session_type,track_id,max_score,weight,held_on,status,created_at,track:tracks(name_ar,name_en)",
      )
      .order("held_on", { ascending: false }),
    supabase
      .from("exam_results")
      .select(
        "id,exam_id,student_id,scores,errors,percentage,total,rating,grade,is_locked,locked_at,student:students(full_name)",
      )
      .order("created_at", { ascending: false }),
    supabase.from("students").select("id,full_name").eq("status", "active").order("full_name"),
    supabase.from("tracks").select("id,name_ar,name_en").eq("is_active", true).order("sort_order"),
    supabase
      .from("eval_criteria")
      .select("code,name_ar,name_en,applies_to,sort_order")
      .order("sort_order"),
  ]);
  if (exams.error || results.error || students.error || tracks.error || criteria.error)
    throw new Error("exam_management_unavailable");
  return {
    exams: exams.data ?? [],
    results: results.data ?? [],
    students: students.data ?? [],
    tracks: tracks.data ?? [],
    criteria: criteria.data ?? [],
  };
}
