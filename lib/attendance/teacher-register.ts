import "server-only";

import { DateTime } from "luxon";

import { createClient } from "@/lib/supabase/server";
import type { TeacherAttendanceStatus } from "@/lib/validators/attendance";

export type TeacherAttendanceRegisterRow = {
  sessionId: string;
  teacherId: string;
  studentId: string;
  teacherName: string;
  studentName: string;
  scheduledAt: string;
  durationMin: number;
  attendance: {
    id: string;
    status: TeacherAttendanceStatus;
    minutes: number | null;
    note: string | null;
    recordedAt: string;
    updatedAt: string;
  } | null;
};

export async function getAdminTeacherAttendanceRegister(days = 30) {
  const supabase = await createClient();
  const from = DateTime.utc().minus({ days }).startOf("day").toISO();
  const now = DateTime.utc().toISO();
  const { data, error } = await supabase
    .from("sessions")
    .select(
      "id,teacher_id,student_id,scheduled_at,duration_min,teachers!sessions_teacher_id_fkey(profiles!teachers_profile_id_fkey(full_name)),students!sessions_student_id_fkey(full_name),teacher_attendance(id,status,minutes,note,recorded_at,updated_at)",
    )
    .gte("scheduled_at", from)
    .lte("ends_at", now)
    .not("status", "in", '("cancelled","rescheduled")')
    .order("scheduled_at", { ascending: false })
    .limit(100);

  if (error) throw new Error("teacher_attendance_register_unavailable");

  return (data ?? []).map((session) => {
    const attendance = one(session.teacher_attendance);
    return {
      sessionId: session.id,
      teacherId: session.teacher_id,
      studentId: session.student_id,
      teacherName: session.teachers.profiles.full_name,
      studentName: session.students.full_name,
      scheduledAt: session.scheduled_at,
      durationMin: session.duration_min,
      attendance: attendance
        ? {
            id: attendance.id,
            status: attendance.status as TeacherAttendanceStatus,
            minutes: attendance.minutes,
            note: attendance.note,
            recordedAt: attendance.recorded_at,
            updatedAt: attendance.updated_at,
          }
        : null,
    } satisfies TeacherAttendanceRegisterRow;
  });
}

export async function getOwnTeacherAttendanceRegister(days = 30) {
  const supabase = await createClient();
  const { data: teacher, error: teacherError } = await supabase
    .from("teachers")
    .select("id")
    .maybeSingle();
  if (teacherError) throw new Error("teacher_attendance_register_unavailable");
  if (!teacher) return null;

  const from = DateTime.utc().minus({ days }).startOf("day").toISO();
  const { data, error } = await supabase
    .from("teacher_attendance")
    .select(
      "id,status,minutes,note,recorded_at,updated_at,sessions!teacher_attendance_session_id_fkey(id,scheduled_at,duration_min,students!sessions_student_id_fkey(full_name))",
    )
    .eq("teacher_id", teacher.id)
    .gte("recorded_at", from)
    .order("recorded_at", { ascending: false });

  if (error) throw new Error("teacher_attendance_register_unavailable");
  return (data ?? []).map((row) => ({
    id: row.id,
    status: row.status as TeacherAttendanceStatus,
    minutes: row.minutes,
    note: row.note,
    recordedAt: row.recorded_at,
    updatedAt: row.updated_at,
    sessionId: row.sessions.id,
    scheduledAt: row.sessions.scheduled_at,
    durationMin: row.sessions.duration_min,
    studentName: row.sessions.students.full_name,
  }));
}

function one<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}
