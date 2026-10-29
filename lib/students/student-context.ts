import "server-only";

import { connection } from "next/server";

import { summarizeStudentAttendance } from "@/lib/attendance/student-rate";
import { createClient } from "@/lib/supabase/server";
import type { AttendanceStatus } from "@/lib/validators/attendance";

export async function getAdminStudentContext(studentId: string) {
  await connection();
  const supabase = await createClient();
  const [assignmentResult, sessionsResult, progressResult, reportResult, subscriptionResult] =
    await Promise.all([
      supabase
        .from("teacher_assignments")
        .select("teacher:teachers!teacher_assignments_teacher_id_fkey(profile:profiles(full_name))")
        .eq("student_id", studentId)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("sessions")
        .select("attendance(status)")
        .eq("student_id", studentId)
        .order("scheduled_at", { ascending: false }),
      supabase.from("memorization_progress").select("status").eq("student_id", studentId),
      supabase
        .from("reports")
        .select("status,period_start,updated_at")
        .eq("student_id", studentId)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("subscriptions")
        .select("status,current_period_end")
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
  )
    throw new Error("student_context_unavailable");

  const attendance = summarizeStudentAttendance(
    (sessionsResult.data ?? []).flatMap((session) => {
      const record = Array.isArray(session.attendance) ? session.attendance[0] : session.attendance;
      return record ? [record.status as AttendanceStatus] : [];
    }),
  );
  const assignment = assignmentResult.data;
  const teacher = Array.isArray(assignment?.teacher) ? assignment.teacher[0] : assignment?.teacher;
  const profile = Array.isArray(teacher?.profile) ? teacher.profile[0] : teacher?.profile;
  const masteredPages = (progressResult.data ?? []).filter(
    ({ status }) => status === "mastered",
  ).length;

  return {
    teacherName: profile?.full_name ?? null,
    attendance,
    progress: {
      masteredPages,
      percent: Math.round((masteredPages / 604) * 10_000) / 100,
    },
    latestReport: reportResult.data,
    subscription: subscriptionResult.data,
  };
}
