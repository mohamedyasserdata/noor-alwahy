import "server-only";

import { connection } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { convertNextOccurrence } from "@/lib/schedules/conversion";

export async function getAdminTeacherProfile(teacherId: string) {
  await connection();
  const supabase = await createClient();
  const [
    teacherResult,
    assignmentsResult,
    sessionsResult,
    attendanceResult,
    reportsResult,
    scheduleResult,
  ] = await Promise.all([
    supabase
      .from("teachers")
      .select(
        "id,profile_id,gender,specialization,ijazah_info,max_students,status,identity_verified_at,code_of_conduct_accepted_at,profile:profiles(full_name,timezone,is_active),teacher_tracks(track_id,track:tracks(name_ar,name_en)),teacher_availability(id,weekday,start_time,end_time,status)",
      )
      .eq("id", teacherId)
      .maybeSingle(),
    supabase
      .from("teacher_assignments")
      .select(
        "id,student_id,track_id,status,start_date,end_date,reason,student:students(full_name,student_no,status,level:levels(name_ar,name_en)),track:tracks(name_ar,name_en)",
      )
      .eq("teacher_id", teacherId)
      .order("created_at", { ascending: false }),
    supabase
      .from("sessions")
      .select(
        "id,student_id,kind,scheduled_at,ends_at,status,duration_min,student:students(full_name,student_no)",
      )
      .eq("teacher_id", teacherId)
      .order("scheduled_at", { ascending: false })
      .limit(20),
    supabase
      .from("teacher_attendance")
      .select("id,session_id,status,minutes,recorded_at")
      .eq("teacher_id", teacherId)
      .order("recorded_at", { ascending: false })
      .limit(100),
    supabase
      .from("reports")
      .select("id,student_id,status,period_start,period_end,updated_at")
      .eq("teacher_id", teacherId)
      .order("updated_at", { ascending: false })
      .limit(20),
    supabase
      .from("schedule_slots")
      .select(
        "id,weekday,local_start_time,duration_min,anchor_timezone,assignment:teacher_assignments!inner(teacher_id,status,student:students(full_name),teacher:teachers(profile:profiles(full_name)),track:tracks(name_ar,name_en))",
      )
      .eq("is_active", true)
      .eq("assignment.teacher_id", teacherId)
      .eq("assignment.status", "active")
      .order("weekday")
      .order("local_start_time"),
  ]);

  if (teacherResult.error) throw new Error("admin_teacher_profile_unavailable");
  if (!teacherResult.data) return null;
  if (
    [assignmentsResult, sessionsResult, attendanceResult, reportsResult, scheduleResult].some(
      (result) => result.error,
    )
  )
    throw new Error("admin_teacher_profile_unavailable");

  const assignments = assignmentsResult.data ?? [];
  const currentAssignments = assignments.filter((item) =>
    ["active", "paused"].includes(item.status),
  );
  const attendance = attendanceResult.data ?? [];
  const attended = attendance.filter((item) => ["present", "late"].includes(item.status)).length;
  return {
    teacher: teacherResult.data,
    assignments,
    currentAssignments,
    sessions: sessionsResult.data ?? [],
    attendance: {
      attended,
      total: attendance.length,
      rate: attendance.length ? Math.round((attended / attendance.length) * 100) : null,
    },
    reports: reportsResult.data ?? [],
    scheduleSlots: (scheduleResult.data ?? []).flatMap((slot) => {
      const assignment = one(slot.assignment);
      const student = assignment ? one(assignment.student) : null;
      const teacher = assignment ? one(assignment.teacher) : null;
      const profile = teacher ? one(teacher.profile) : null;
      const track = assignment ? one(assignment.track) : null;
      if (!assignment || !student || !profile || !track) return [];
      return [
        {
          slot_id: slot.id,
          student_name: student.full_name,
          teacher_name: profile.full_name,
          track_name_ar: track.name_ar,
          track_name_en: track.name_en,
          weekday: slot.weekday,
          local_start_time: slot.local_start_time,
          duration_min: slot.duration_min,
          anchor_timezone: slot.anchor_timezone,
          viewer: convertNextOccurrence({
            weekday: slot.weekday,
            time: slot.local_start_time,
            anchorTimezone: slot.anchor_timezone,
            viewerTimezone: "Africa/Cairo",
          }),
        },
      ];
    }),
  };
}

function one<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}
