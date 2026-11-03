import "server-only";

import { connection } from "next/server";

import { createClient } from "@/lib/supabase/server";

export async function getTeacherCapacityForecast() {
  await connection();
  const supabase = await createClient();
  const now = new Date();
  const horizon = new Date(now);
  horizon.setUTCDate(horizon.getUTCDate() + 28);
  const [teachersResult, assignmentsResult, studentsResult, sessionsResult] = await Promise.all([
    supabase
      .from("teachers")
      .select("id,max_students,profile:profiles(full_name)")
      .eq("status", "active")
      .order("created_at"),
    supabase
      .from("teacher_assignments")
      .select("teacher_id,student_id")
      .in("status", ["active", "paused"]),
    supabase.from("students").select("id").eq("status", "active"),
    supabase
      .from("sessions")
      .select("teacher_id")
      .eq("status", "scheduled")
      .gte("scheduled_at", now.toISOString())
      .lt("scheduled_at", horizon.toISOString()),
  ]);
  if (
    [teachersResult, assignmentsResult, studentsResult, sessionsResult].some((item) => item.error)
  )
    throw new Error("teacher_capacity_forecast_unavailable");

  const assignments = assignmentsResult.data ?? [];
  const assignedStudents = new Set(assignments.map((item) => item.student_id));
  const waitingStudents = (studentsResult.data ?? []).filter(
    (student) => !assignedStudents.has(student.id),
  ).length;
  const rows = (teachersResult.data ?? []).map((teacher) => {
    const currentLoad = assignments.filter((item) => item.teacher_id === teacher.id).length;
    const scheduledSessions = (sessionsResult.data ?? []).filter(
      (item) => item.teacher_id === teacher.id,
    ).length;
    const remaining = Math.max(0, teacher.max_students - currentLoad);
    return {
      id: teacher.id,
      name: one(teacher.profile)?.full_name ?? "—",
      currentLoad,
      maxStudents: teacher.max_students,
      remaining,
      utilization: teacher.max_students
        ? Math.round((currentLoad / teacher.max_students) * 100)
        : 0,
      scheduledSessions,
    };
  });
  const totalRemaining = rows.reduce((sum, row) => sum + row.remaining, 0);
  return {
    rows: rows.sort((a, b) => b.utilization - a.utilization || a.name.localeCompare(b.name)),
    waitingStudents,
    totalRemaining,
    projectedBalance: totalRemaining - waitingStudents,
    nearCapacity: rows.filter((row) => row.utilization >= 85).length,
    horizonEnd: horizon.toISOString(),
  };
}

function one<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}
