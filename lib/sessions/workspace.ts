import "server-only";

import { connection } from "next/server";

import { getEvaluationFormData } from "@/lib/evaluation/form-data";
import { createClient } from "@/lib/supabase/server";

function one<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export async function getTeacherSessionWorkspace(sessionId: string) {
  await connection();
  const supabase = await createClient();
  const [sessionResult, zoomResult] = await Promise.all([
    supabase
      .from("sessions")
      .select(
        "id,student_id,teacher_id,scheduled_at,ends_at,duration_min,status,kind,format,started_at,ended_at,student:students!sessions_student_id_fkey(full_name,student_no,timezone),participants:session_participants(student_id,is_primary,student:students!session_participants_student_id_fkey(full_name,student_no,timezone)),teacher:teachers!sessions_teacher_id_fkey(profile:profiles(full_name)),attendance(student_id,status,minutes,recorded_at,locked_at,correction_reason),evaluation:session_evaluations(id,is_locked,total_score,rating,session_type,family_note,locked_at)",
      )
      .eq("id", sessionId)
      .maybeSingle(),
    supabase.rpc("get_teacher_session_zoom", { p_session_id: sessionId }).maybeSingle(),
  ]);
  if (sessionResult.error || zoomResult.error) throw new Error("session_workspace_unavailable");
  if (!sessionResult.data || !zoomResult.data) return null;

  const session = sessionResult.data;
  const attendanceRows = Array.isArray(session.attendance)
    ? session.attendance
    : session.attendance
      ? [session.attendance]
      : [];
  const { data: reviewQueue, error: reviewError } = await supabase
    .from("v_review_queue")
    .select("page,status,review_stage,next_review_due,is_overdue,queue_position")
    .eq("student_id", session.student_id)
    .order("queue_position")
    .limit(12);
  if (reviewError) throw new Error("session_workspace_unavailable");

  let evaluationForm: Awaited<ReturnType<typeof getEvaluationFormData>> | null = null;
  const evaluation = one(session.evaluation);
  const primaryAttendance =
    attendanceRows.find((item) => item.student_id === session.student_id) ?? null;
  if (session.status === "held" && primaryAttendance && !evaluation?.is_locked) {
    const formData = await getEvaluationFormData();
    if (formData.sessions.some((item) => item.id === session.id)) evaluationForm = formData;
  }

  return {
    session: {
      id: session.id,
      studentId: session.student_id,
      scheduledAt: session.scheduled_at,
      endsAt: session.ends_at,
      durationMin: session.duration_min,
      status: session.status,
      kind: session.kind,
      format: session.format,
      startedAt: session.started_at,
      endedAt: session.ended_at,
      student: {
        name: session.student.full_name,
        number: session.student.student_no,
        timezone: session.student.timezone,
      },
      participants: session.participants
        .map((participant) => ({
          id: participant.student_id,
          isPrimary: participant.is_primary,
          name: participant.student.full_name,
          number: participant.student.student_no,
          timezone: participant.student.timezone,
        }))
        .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary)),
      teacherName: one(session.teacher.profile)?.full_name ?? "",
      attendance: primaryAttendance,
      attendances: attendanceRows,
      evaluation,
    },
    zoom: zoomResult.data,
    reviewQueue: (reviewQueue ?? []).filter(
      (item): item is typeof item & { page: number } => item.page !== null,
    ),
    evaluationForm,
  };
}

export type TeacherSessionWorkspaceData = NonNullable<
  Awaited<ReturnType<typeof getTeacherSessionWorkspace>>
>;
