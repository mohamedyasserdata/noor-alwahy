import "server-only";

import { connection } from "next/server";

import type { AppLocale } from "@/i18n/routing";
import { createClient } from "@/lib/supabase/server";

export async function getAdminStudentProfile(studentId: string, locale: AppLocale) {
  await connection();
  const supabase = await createClient();
  const [
    studentResult,
    guardiansResult,
    assignmentsResult,
    sessionsResult,
    attendanceResult,
    evaluationsResult,
    reportsResult,
    subscriptionsResult,
    progressResult,
  ] = await Promise.all([
    supabase
      .from("students")
      .select(
        "id,profile_id,student_no,full_name,gender,status,country_code,timezone,birth_date,joined_at,level_id,level:levels(name_ar,name_en,track_id,track:tracks(name_ar,name_en))",
      )
      .eq("id", studentId)
      .maybeSingle(),
    supabase
      .from("student_guardians")
      .select(
        "relation,is_primary,is_payer,guardian:guardians(id,profile:profiles(full_name,timezone))",
      )
      .eq("student_id", studentId)
      .order("is_primary", { ascending: false }),
    supabase
      .from("teacher_assignments")
      .select(
        "id,teacher_id,track_id,status,start_date,end_date,reason,created_at,teacher:teachers(profile:profiles(full_name,timezone)),track:tracks(name_ar,name_en)",
      )
      .eq("student_id", studentId)
      .order("created_at", { ascending: false }),
    supabase
      .from("sessions")
      .select(
        "id,teacher_id,kind,scheduled_at,ends_at,status,duration_min,teacher:teachers!sessions_teacher_id_fkey(profile:profiles(full_name))",
      )
      .eq("student_id", studentId)
      .order("scheduled_at", { ascending: false })
      .limit(12),
    supabase
      .from("attendance")
      .select("session_id,status,recorded_at")
      .eq("student_id", studentId)
      .order("recorded_at", { ascending: false })
      .limit(100),
    supabase
      .from("session_evaluations")
      .select(
        "id,total_score,rating,is_locked,locked_at,decision,family_note,session:sessions!inner(id,student_id,scheduled_at)",
      )
      .eq("session.student_id", studentId)
      .eq("is_locked", true)
      .order("locked_at", { ascending: false })
      .limit(10),
    supabase
      .from("reports")
      .select("id,teacher_id,period_type,period_start,period_end,status,updated_at,made_visible_at")
      .eq("student_id", studentId)
      .order("updated_at", { ascending: false })
      .limit(10),
    supabase
      .from("subscriptions")
      .select("id,status,start_date,current_period_start,current_period_end,sessions_per_period")
      .eq("student_id", studentId)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("memorization_progress")
      .select("status,next_review_due,avg_score,review_count")
      .eq("student_id", studentId),
  ]);

  if (studentResult.error) throw new Error("admin_student_profile_unavailable");
  if (!studentResult.data) return null;
  const related = [
    guardiansResult,
    assignmentsResult,
    sessionsResult,
    attendanceResult,
    evaluationsResult,
    reportsResult,
    subscriptionsResult,
    progressResult,
  ];
  if (related.some((result) => result.error)) throw new Error("admin_student_profile_unavailable");

  const level = one(studentResult.data.level);
  const track = one(level?.track);
  const assignments = assignmentsResult.data ?? [];
  const currentAssignment = assignments.find((item) => ["active", "paused"].includes(item.status));
  const attendance = attendanceResult.data ?? [];
  const eligibleAttendance = attendance.filter((item) =>
    ["present", "late", "student_absent", "student_excused"].includes(item.status),
  );
  const attended = eligibleAttendance.filter((item) =>
    ["present", "late"].includes(item.status),
  ).length;
  const progress = progressResult.data ?? [];
  const masteredPages = progress.filter((item) => item.status === "mastered").length;
  const reviewDue = progress.filter(
    (item) => item.next_review_due && item.next_review_due <= new Date().toISOString().slice(0, 10),
  ).length;

  return {
    student: {
      ...studentResult.data,
      levelName: level
        ? locale === "ar"
          ? level.name_ar
          : (level.name_en ?? level.name_ar)
        : null,
      trackId: level?.track_id ?? currentAssignment?.track_id ?? null,
      trackName: track
        ? locale === "ar"
          ? track.name_ar
          : (track.name_en ?? track.name_ar)
        : null,
    },
    guardians: guardiansResult.data ?? [],
    assignments,
    currentAssignment: currentAssignment ?? null,
    sessions: sessionsResult.data ?? [],
    attendance: {
      attended,
      total: eligibleAttendance.length,
      rate: eligibleAttendance.length
        ? Math.round((attended / eligibleAttendance.length) * 100)
        : null,
      latest: attendance[0] ?? null,
    },
    evaluations: evaluationsResult.data ?? [],
    reports: reportsResult.data ?? [],
    subscriptions: subscriptionsResult.data ?? [],
    progress: { masteredPages, reviewDue, totalTracked: progress.length },
  };
}

function one<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}
