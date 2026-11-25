import "server-only";

import { connection } from "next/server";
import { DateTime } from "luxon";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function getAdminWorkQueue() {
  await connection();
  const supabase = await createClient();
  const admin = createAdminClient();
  const now = new Date().toISOString();
  const [
    applications,
    teacherApplications,
    reports,
    students,
    assignments,
    endedSessions,
    zoomReviews,
  ] = await Promise.all([
    supabase.from("applications").select("id", { count: "exact", head: true }).eq("status", "new"),
    supabase
      .from("teacher_applications")
      .select("id", { count: "exact", head: true })
      .in("status", ["new", "reviewing"]),
    supabase.from("reports").select("id", { count: "exact", head: true }).eq("status", "approved"),
    supabase.from("students").select("id").eq("status", "active"),
    supabase.from("teacher_assignments").select("student_id").in("status", ["active", "paused"]),
    admin
      .from("sessions")
      .select("id,teacher_attendance(id)")
      .lt("ends_at", now)
      .in("status", ["held", "missed", "cancelled"])
      .order("ends_at", { ascending: false })
      .limit(500),
    admin
      .from("sessions")
      .select("id,student_id,scheduled_at,student:students!sessions_student_id_fkey(full_name)")
      .eq("zoom_review_status", "pending")
      .not("zoom_override_url", "is", null)
      .order("scheduled_at", { ascending: true })
      .limit(100),
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
  const pendingZoomReviews = (zoomReviews.error ? [] : (zoomReviews.data ?? [])).map((review) => {
    const student = Array.isArray(review.student) ? review.student[0] : review.student;
    return {
      id: review.id,
      studentId: review.student_id,
      studentName: student?.full_name ?? "—",
      scheduledAt: review.scheduled_at,
    };
  });
  return {
    newApplications: applications.count ?? 0,
    teacherApplications: teacherApplications.count ?? 0,
    awaitingAssignment,
    reportsPendingReview: reports.count ?? 0,
    missingTeacherAttendance,
    zoomReviewsPending: pendingZoomReviews.length,
    firstZoomReviewStudentId: pendingZoomReviews[0]?.studentId ?? null,
    pendingZoomReviews,
  };
}

export async function getAdminDashboardSummary() {
  await connection();
  const supabase = await createClient();
  const start = DateTime.now().setZone("Africa/Cairo").startOf("day").toUTC().toISO();
  const end = DateTime.now()
    .setZone("Africa/Cairo")
    .plus({ days: 1 })
    .startOf("day")
    .toUTC()
    .toISO();
  if (!start || !end) throw new Error("admin_dashboard_summary_unavailable");
  const [students, teachers, subscriptions, sessions] = await Promise.all([
    supabase.from("students").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("teachers").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase
      .from("subscriptions")
      .select("id", { count: "exact", head: true })
      .in("status", ["trial", "active", "paused"]),
    supabase
      .from("sessions")
      .select("id", { count: "exact", head: true })
      .gte("scheduled_at", start)
      .lt("scheduled_at", end),
  ]);
  if ([students, teachers, subscriptions, sessions].some((item) => item.error)) {
    throw new Error("admin_dashboard_summary_unavailable");
  }
  return {
    students: students.count ?? 0,
    teachers: teachers.count ?? 0,
    subscriptions: subscriptions.count ?? 0,
    sessionsToday: sessions.count ?? 0,
  };
}
