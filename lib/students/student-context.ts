import "server-only";

import { DateTime } from "luxon";
import { connection } from "next/server";

import { summarizeStudentAttendance } from "@/lib/attendance/student-rate";
import { createClient } from "@/lib/supabase/server";

function relation<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export async function getAdminStudentContext(studentId: string) {
  await connection();
  const supabase = await createClient();
  const attendanceFrom = DateTime.utc().minus({ days: 30 }).toISO();

  const [assignmentResult, sessionsResult, progressResult, reportResult, subscriptionResult] =
    await Promise.all([
      supabase
        .from("teacher_assignments")
        .select(
          "id,teacher:teachers!teacher_assignments_teacher_id_fkey(profile:profiles!teachers_profile_id_fkey(full_name))",
        )
        .eq("student_id", studentId)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("sessions")
        .select("attendance(status)")
        .eq("student_id", studentId)
        .gte("scheduled_at", attendanceFrom),
      supabase
        .from("memorization_progress")
        .select("status,updated_at")
        .eq("student_id", studentId),
      supabase
        .from("reports")
        .select("id,status,period_end,updated_at")
        .eq("student_id", studentId)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("subscriptions")
        .select("id,status,current_period_end")
        .eq("student_id", studentId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  if (
    assignmentResult.error ||
    sessionsResult.error ||
    progressResult.error ||
    reportResult.error ||
    subscriptionResult.error
  ) {
    throw new Error("student_context_unavailable");
  }

  const attendance = summarizeStudentAttendance(
    (sessionsResult.data ?? []).flatMap((session) => {
      const row = relation(session.attendance);
      return row ? [row.status] : [];
    }),
  );
  const progress = progressResult.data ?? [];
  const assignment = assignmentResult.data;
  const teacher = assignment ? relation(assignment.teacher) : null;
  const profile = teacher ? relation(teacher.profile) : null;

  return {
    assignmentId: assignment?.id ?? null,
    teacherName: profile?.full_name ?? null,
    attendance: { periodDays: 30, ...attendance },
    progress: {
      mastered: progress.filter((row) => row.status === "mastered").length,
      inProgress: progress.filter((row) => row.status === "in_progress").length,
      needsReview: progress.filter((row) => row.status === "needs_review").length,
      updatedAt:
        progress
          .map((row) => row.updated_at)
          .toSorted((left, right) => right.localeCompare(left))[0] ?? null,
    },
    report: reportResult.data,
    subscription: subscriptionResult.data,
  };
}
