import "server-only";

import { connection } from "next/server";
import { z } from "zod";

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
  const requestedStudentId = single(raw.studentId);
  const requestedTrackId = single(raw.trackId);
  const safeStudentId = (studentsResult.data ?? []).some(
    (student) => student.id === requestedStudentId,
  )
    ? requestedStudentId
    : undefined;
  const safeTrackId = (tracksResult.data ?? []).some((track) => track.id === requestedTrackId)
    ? requestedTrackId
    : undefined;
  let suggestions: Awaited<ReturnType<typeof loadSuggestions>> = [];
  const scheduleSelection = scheduleSelectionSchema.safeParse({
    weekdays: list(raw.weekdays),
    localStartTime: single(raw.localStartTime),
    durationMin: single(raw.durationMin),
  });
  if (selected.success) {
    suggestions = await loadSuggestions(selected.data.studentId, selected.data.trackId);
    if (scheduleSelection.success) {
      suggestions = await markAvailability(suggestions, scheduleSelection.data);
    }
  }
  return {
    students: studentsResult.data ?? [],
    tracks: tracksResult.data ?? [],
    assignments: assignmentsResult.data ?? [],
    selection: selected.success ? selected.data : null,
    requestedStudentId: safeStudentId,
    requestedTrackId: safeTrackId,
    suggestions,
    scheduleSelection: scheduleSelection.success ? scheduleSelection.data : null,
  };
}

async function loadSuggestions(studentId: string, trackId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("suggest_teachers", {
    p_student: studentId,
    p_track: trackId,
  });
  if (error) throw new Error("teacher_suggestions_unavailable");
  return (data ?? []).map((item) => ({ ...item, availableForTime: false }));
}

const scheduleSelectionSchema = z.object({
  weekdays: z.array(z.coerce.number().int().min(0).max(6)).min(1).max(7),
  localStartTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  durationMin: z.coerce.number().int().min(10).max(120),
});

async function markAvailability(
  suggestions: Awaited<ReturnType<typeof loadSuggestions>>,
  selection: z.infer<typeof scheduleSelectionSchema>,
) {
  if (!suggestions.length) return suggestions;
  const supabase = await createClient();
  const teacherIds = suggestions.map((item) => item.teacher_id);
  const [availabilityResult, slotsResult] = await Promise.all([
    supabase
      .from("teacher_availability")
      .select("teacher_id,weekday,start_time,end_time,status")
      .in("teacher_id", teacherIds)
      .eq("status", "approved"),
    supabase
      .from("schedule_slots")
      .select(
        "weekday,local_start_time,duration_min,assignment:teacher_assignments!inner(teacher_id,status)",
      )
      .eq("is_active", true)
      .eq("assignment.status", "active")
      .in("assignment.teacher_id", teacherIds),
  ]);
  if (availabilityResult.error || slotsResult.error) return suggestions;
  const start = minutes(selection.localStartTime);
  const end = start + selection.durationMin;
  return suggestions.map((candidate) => {
    const coversAllDays = selection.weekdays.every((weekday) =>
      (availabilityResult.data ?? []).some(
        (slot) =>
          slot.teacher_id === candidate.teacher_id &&
          slot.weekday === weekday &&
          minutes(slot.start_time) <= start &&
          minutes(slot.end_time) >= end,
      ),
    );
    const hasConflict = (slotsResult.data ?? []).some((slot) => {
      const assignment = one(slot.assignment);
      if (
        assignment?.teacher_id !== candidate.teacher_id ||
        !selection.weekdays.includes(slot.weekday)
      )
        return false;
      const slotStart = minutes(slot.local_start_time);
      return slotStart < end && slotStart + slot.duration_min > start;
    });
    return { ...candidate, availableForTime: coversAllDays && !hasConflict };
  });
}

function minutes(value: string) {
  const [hour = "0", minute = "0"] = value.slice(0, 5).split(":");
  return Number(hour) * 60 + Number(minute);
}

function one<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function single(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function list(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value;
  return value ? [value] : [];
}
