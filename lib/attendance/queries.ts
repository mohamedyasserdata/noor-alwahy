import "server-only";

import { DateTime } from "luxon";
import { connection } from "next/server";

import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";

type AttendanceRow = Pick<
  Database["public"]["Tables"]["attendance"]["Row"],
  "status" | "minutes" | "recorded_at"
>;

export type TeacherTodaySession = Pick<
  Database["public"]["Tables"]["sessions"]["Row"],
  "id" | "scheduled_at" | "duration_min" | "status"
> & {
  studentName: string;
  attendance: AttendanceRow | null;
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

  const { data, error } = await supabase
    .from("sessions")
    .select(
      "id,scheduled_at,duration_min,status,students!sessions_student_id_fkey(full_name),attendance(status,minutes,recorded_at)",
    )
    .eq("teacher_id", teacher.id)
    .gte("scheduled_at", start)
    .lt("scheduled_at", end)
    .order("scheduled_at");

  if (error) throw new Error("teacher_day_unavailable");

  return {
    dateInstant: localNow.toUTC().toISO(),
    timezone: profile.timezone,
    sessions: (data ?? []).map((session) => ({
      id: session.id,
      scheduled_at: session.scheduled_at,
      duration_min: session.duration_min,
      status: session.status,
      studentName: session.students.full_name,
      attendance: one(session.attendance),
    })) satisfies TeacherTodaySession[],
  };
}

function one<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}
