import "server-only";

import { connection } from "next/server";

import { createClient } from "@/lib/supabase/server";

export async function getAdminWorkQueue() {
  await connection();
  const supabase = await createClient();
  const now = new Date().toISOString();
  const [applications, teacherApplications, reports, students, assignments, endedSessions] =
    await Promise.all([
      supabase
        .from("applications")
        .select("id", { count: "exact", head: true })
        .eq("status", "new"),
      supabase
        .from("teacher_applications")
        .select("id", { count: "exact", head: true })
        .in("status", ["new", "reviewing"]),
      supabase
        .from("reports")
        .select("id", { count: "exact", head: true })
        .eq("status", "approved"),
      supabase.from("students").select("id").eq("status", "active"),
      supabase.from("teacher_assignments").select("student_id").in("status", ["active", "paused"]),
      supabase
        .from("sessions")
        .select("id,teacher_attendance(id)")
        .lt("ends_at", now)
        .in("status", ["held", "missed", "cancelled"])
        .order("ends_at", { ascending: false })
        .limit(500),
    ]);
  const results = [
    applications,
    teacherApplications,
    reports,
    students,
    assignments,
    endedSessions,
  ];
  if (results.some((result) => result.error)) throw new Error("admin_work_queue_unavailable");
  const assigned = new Set((assignments.data ?? []).map((item) => item.student_id));
  const awaitingAssignment = (students.data ?? []).filter(
    (student) => !assigned.has(student.id),
  ).length;
  const missingTeacherAttendance = (endedSessions.data ?? []).filter((session) => {
    const attendance = session.teacher_attendance;
    return Array.isArray(attendance) ? attendance.length === 0 : !attendance?.id;
  }).length;
  return {
    newApplications: applications.count ?? 0,
    teacherApplications: teacherApplications.count ?? 0,
    awaitingAssignment,
    reportsPendingReview: reports.count ?? 0,
    missingTeacherAttendance,
  };
}
