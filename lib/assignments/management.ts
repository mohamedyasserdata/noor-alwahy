import "server-only";

import { connection } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { assignmentSelectionSchema } from "@/lib/validators/assignments";

export async function getAssignmentWorkspace(raw: Record<string, string | string[] | undefined>) {
  await connection();
  const selected = assignmentSelectionSchema.safeParse({
    studentId: single(raw.studentId),
    trackId: single(raw.trackId),
  });
  const supabase = await createClient();
  const [studentsResult, tracksResult, assignmentsResult] = await Promise.all([
    supabase
      .from("students")
      .select("id,student_no,full_name,gender")
      .eq("status", "active")
      .order("full_name"),
    supabase
      .from("tracks")
      .select("id,code,name_ar,name_en")
      .eq("is_active", true)
      .order("sort_order"),
    supabase
      .from("teacher_assignments")
      .select(
        "id,student_id,teacher_id,track_id,status,start_date,end_date,reason,created_at,student:students(full_name,student_no),teacher:teachers(profile:profiles(full_name)),track:tracks(name_ar,name_en)",
      )
      .order("created_at", { ascending: false }),
  ]);
  if (studentsResult.error || tracksResult.error || assignmentsResult.error)
    throw new Error("assignment_workspace_unavailable");
  let suggestions: Awaited<ReturnType<typeof loadSuggestions>> = [];
  if (selected.success)
    suggestions = await loadSuggestions(selected.data.studentId, selected.data.trackId);
  return {
    students: studentsResult.data ?? [],
    tracks: tracksResult.data ?? [],
    assignments: assignmentsResult.data ?? [],
    selection: selected.success ? selected.data : null,
    suggestions,
  };
}

async function loadSuggestions(studentId: string, trackId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("suggest_teachers", {
    p_student: studentId,
    p_track: trackId,
  });
  if (error) throw new Error("teacher_suggestions_unavailable");
  return data ?? [];
}

function single(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
