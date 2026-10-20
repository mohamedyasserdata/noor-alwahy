import "server-only";

import { DateTime } from "luxon";
import { connection } from "next/server";

import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";

type AttendanceRow = Pick<
  Database["public"]["Tables"]["attendance"]["Row"],
  "status" | "minutes" | "recorded_at"
>;

type ReviewQueueRow = Omit<
  Pick<
    Database["public"]["Views"]["v_review_queue"]["Row"],
    | "page"
    | "status"
    | "review_stage"
    | "next_review_due"
    | "days_overdue"
    | "is_overdue"
    | "queue_position"
  >,
  "page"
> & { page: number };

export type TeacherTodaySession = Pick<
  Database["public"]["Tables"]["sessions"]["Row"],
  "id" | "scheduled_at" | "ends_at" | "duration_min" | "status"
> & {
  studentName: string;
  attendance: AttendanceRow | null;
  evaluationLocked: boolean;
  reviewQueue: ReviewQueueRow[];
};

export async function getTeacherTodaySessions() {
  await connection();
  const supabase = await createClient();
  const [{ data: profile, error: profileError }, { data: teacher, error: teacherError }] =
    await Promise.all([
      supabase.from("profiles").select("timezone").maybeSingle(),
      supabase.from("teachers").select("id").maybeSingle(),
    ]);

  if (profileError || teacherError) throw new Error("teacher_day_unavailable");
  if (!profile || !teacher) return null;

  const localNow = DateTime.now().setZone(profile.timezone);
  if (!localNow.isValid) throw new Error("teacher_timezone_invalid");
  const start = localNow.startOf("day").toUTC().toISO();
  const end = localNow.plus({ days: 1 }).startOf("day").toUTC().toISO();

  const [sessionsResult, assignmentsResult, recentReportsResult] = await Promise.all([
    supabase
      .from("sessions")
      .select(
        "id,student_id,scheduled_at,ends_at,duration_min,status,students!sessions_student_id_fkey(full_name),attendance(status,minutes,recorded_at),evaluation:session_evaluations(is_locked)",
      )
      .eq("teacher_id", teacher.id)
      .gte("scheduled_at", start)
      .lt("scheduled_at", end)
      .order("scheduled_at"),
    supabase
      .from("teacher_assignments")
      .select("student_id,students!teacher_assignments_student_id_fkey(full_name)")
      .eq("teacher_id", teacher.id)
      .eq("status", "active"),
    supabase
      .from("reports")
      .select("student_id")
      .eq("teacher_id", teacher.id)
      .gte("period_end", localNow.minus({ days: 7 }).toISODate()),
  ]);
  if (sessionsResult.error || assignmentsResult.error || recentReportsResult.error) {
    throw new Error("teacher_day_unavailable");
  }
  const data = sessionsResult.data ?? [];
  const assignedStudents = assignmentsResult.data ?? [];
  const studentIds = [...new Set(assignedStudents.map((assignment) => assignment.student_id))];
  const { data: reviewRows, error: reviewError } = studentIds.length
    ? await supabase
        .from("v_review_queue")
        .select(
          "student_id,page,status,review_stage,next_review_due,days_overdue,is_overdue,queue_position",
        )
        .in("student_id", studentIds)
        .order("student_id")
        .order("queue_position")
    : { data: [], error: null };

  if (reviewError) throw new Error("teacher_day_unavailable");

  const queuesByStudent = new Map<string, ReviewQueueRow[]>();
  for (const row of reviewRows ?? []) {
    if (!row.student_id || row.page === null) continue;
    const queue = queuesByStudent.get(row.student_id) ?? [];
    queue.push({
      page: row.page,
      status: row.status,
      review_stage: row.review_stage,
      next_review_due: row.next_review_due,
      days_overdue: row.days_overdue,
      is_overdue: row.is_overdue,
      queue_position: row.queue_position,
    });
    queuesByStudent.set(row.student_id, queue);
  }

  return {
    dateInstant: localNow.toUTC().toISO(),
    timezone: profile.timezone,
    sessions: (data ?? []).map((session) => ({
      id: session.id,
      scheduled_at: session.scheduled_at,
      ends_at: session.ends_at,
      duration_min: session.duration_min,
      status: session.status,
      studentName: session.students.full_name,
      attendance: one(session.attendance),
      evaluationLocked: Boolean(one(session.evaluation)?.is_locked),
      reviewQueue: queuesByStudent.get(session.student_id) ?? [],
    })) satisfies TeacherTodaySession[],
    overview: {
      absentStudents: data
        .filter((session) => one(session.attendance)?.status === "student_absent")
        .map((session) => session.students.full_name),
      lateStudents: data
        .filter((session) => one(session.attendance)?.status === "late")
        .map((session) => session.students.full_name),
      pendingAttendance: data.filter(
        (session) => DateTime.fromISO(session.ends_at) < localNow && !one(session.attendance),
      ).length,
      pendingEvaluations: data
        .filter(
          (session) =>
            DateTime.fromISO(session.ends_at) < localNow &&
            Boolean(one(session.attendance)) &&
            !one(session.evaluation)?.is_locked,
        )
        .map((session) => ({ id: session.id, studentName: session.students.full_name })),
      reportReminders: assignedStudents
        .filter(
          (assignment) =>
            !(recentReportsResult.data ?? []).some(
              (report) => report.student_id === assignment.student_id,
            ),
        )
        .map((assignment) => ({
          id: assignment.student_id,
          studentName: assignment.students.full_name,
        })),
      overdueReviewStudents: assignedStudents
        .filter((assignment) =>
          (queuesByStudent.get(assignment.student_id) ?? []).some((item) => item.is_overdue),
        )
        .map((assignment) => assignment.students.full_name),
    },
  };
}

function one<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}
