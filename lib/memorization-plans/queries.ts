import "server-only";

import { connection } from "next/server";

import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";

type PlanRow = Pick<
  Database["public"]["Tables"]["memorization_plans"]["Row"],
  "id" | "student_id" | "weekly_target_pages" | "monthly_target_pages" | "starts_on" | "ends_on"
>;

export type PlanAdherence = Pick<
  Database["public"]["Views"]["v_memorization_plan_adherence"]["Row"],
  | "student_id"
  | "weekly_target_pages"
  | "monthly_target_pages"
  | "weekly_achieved_pages"
  | "monthly_achieved_pages"
  | "weekly_adherence_percent"
  | "monthly_adherence_percent"
  | "starts_on"
  | "ends_on"
>;

export type TeacherStudentPlan = {
  studentId: string;
  studentName: string;
  studentNumber: string;
  status: Database["public"]["Enums"]["student_status"];
  level: { name_ar: string; name_en: string | null } | null;
  track: { name_ar: string; name_en: string | null } | null;
  plan: PlanRow | null;
  adherence: PlanAdherence | null;
  latestAttendance: { status: string; scheduledAt: string } | null;
  latestEvaluation: { score: number | null; sessionId: string; scheduledAt: string } | null;
  pendingReport: { id: string; status: "draft" | "approved" | "admin_review" } | null;
};

export async function getTeacherStudentPlans(): Promise<TeacherStudentPlan[]> {
  await connection();
  const supabase = await createClient();
  const { data: teacher, error: teacherError } = await supabase
    .from("teachers")
    .select("id")
    .maybeSingle();
  if (teacherError) throw new Error("memorization_plans_unavailable");
  if (!teacher) return [];

  const { data: assignments, error: assignmentsError } = await supabase
    .from("teacher_assignments")
    .select(
      "student_id,students!teacher_assignments_student_id_fkey(full_name,student_no,status,level:levels(name_ar,name_en,track:tracks(name_ar,name_en)))",
    )
    .eq("teacher_id", teacher.id)
    .eq("status", "active")
    .order("created_at", { ascending: false });
  if (assignmentsError) throw new Error("memorization_plans_unavailable");

  const students = new Map<
    string,
    {
      name: string;
      number: string;
      status: Database["public"]["Enums"]["student_status"];
      level: { name_ar: string; name_en: string | null } | null;
      track: { name_ar: string; name_en: string | null } | null;
    }
  >();
  for (const assignment of assignments ?? []) {
    const level = assignment.students.level;
    students.set(assignment.student_id, {
      name: assignment.students.full_name,
      number: assignment.students.student_no,
      status: assignment.students.status,
      level: level ? { name_ar: level.name_ar, name_en: level.name_en } : null,
      track: level?.track ? { name_ar: level.track.name_ar, name_en: level.track.name_en } : null,
    });
  }
  const studentIds = [...students.keys()];
  if (!studentIds.length) return [];

  const [plansResult, adherenceResult, sessionsResult, reportsResult] = await Promise.all([
    supabase
      .from("memorization_plans")
      .select("id,student_id,weekly_target_pages,monthly_target_pages,starts_on,ends_on")
      .in("student_id", studentIds),
    supabase
      .from("v_memorization_plan_adherence")
      .select(
        "student_id,weekly_target_pages,monthly_target_pages,weekly_achieved_pages,monthly_achieved_pages,weekly_adherence_percent,monthly_adherence_percent,starts_on,ends_on",
      )
      .in("student_id", studentIds),
    supabase
      .from("sessions")
      .select(
        "id,student_id,scheduled_at,attendance(status),evaluation:session_evaluations(total_score,is_locked)",
      )
      .in("student_id", studentIds)
      .order("scheduled_at", { ascending: false })
      .limit(300),
    supabase
      .from("reports")
      .select("id,student_id,status,updated_at")
      .eq("teacher_id", teacher.id)
      .in("student_id", studentIds)
      .in("status", ["draft", "approved", "admin_review"])
      .order("updated_at", { ascending: false }),
  ]);
  if (plansResult.error || adherenceResult.error || sessionsResult.error || reportsResult.error) {
    throw new Error("memorization_plans_unavailable");
  }

  const plans = new Map((plansResult.data ?? []).map((plan) => [plan.student_id, plan]));
  const adherence = new Map(
    (adherenceResult.data ?? [])
      .filter((row): row is typeof row & { student_id: string } => Boolean(row.student_id))
      .map((row) => [row.student_id, row]),
  );
  const latestAttendance = new Map<string, { status: string; scheduledAt: string }>();
  const latestEvaluation = new Map<
    string,
    { score: number | null; sessionId: string; scheduledAt: string }
  >();
  for (const session of sessionsResult.data ?? []) {
    const attendanceRow = one(session.attendance);
    const evaluationRow = one(session.evaluation);
    if (attendanceRow && !latestAttendance.has(session.student_id)) {
      latestAttendance.set(session.student_id, {
        status: attendanceRow.status,
        scheduledAt: session.scheduled_at,
      });
    }
    if (evaluationRow?.is_locked && !latestEvaluation.has(session.student_id)) {
      latestEvaluation.set(session.student_id, {
        score: evaluationRow.total_score,
        sessionId: session.id,
        scheduledAt: session.scheduled_at,
      });
    }
  }
  const pendingReports = new Map<
    string,
    { id: string; status: "draft" | "approved" | "admin_review" }
  >();
  for (const report of reportsResult.data ?? []) {
    if (!pendingReports.has(report.student_id)) {
      pendingReports.set(report.student_id, {
        id: report.id,
        status: report.status as "draft" | "approved" | "admin_review",
      });
    }
  }

  return studentIds
    .map((studentId) => ({
      studentId,
      studentName: students.get(studentId)?.name ?? "",
      studentNumber: students.get(studentId)?.number ?? "",
      status: students.get(studentId)?.status ?? "active",
      level: students.get(studentId)?.level ?? null,
      track: students.get(studentId)?.track ?? null,
      plan: plans.get(studentId) ?? null,
      adherence: adherence.get(studentId) ?? null,
      latestAttendance: latestAttendance.get(studentId) ?? null,
      latestEvaluation: latestEvaluation.get(studentId) ?? null,
      pendingReport: pendingReports.get(studentId) ?? null,
    }))
    .sort((left, right) => left.studentName.localeCompare(right.studentName));
}

function one<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export async function getStudentMemorizationPlan(
  requestedStudentId?: string,
): Promise<PlanAdherence | null> {
  await connection();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("memorization_plan_auth_required");

  const studentQuery = supabase.from("students").select("id");
  const { data: student, error: studentError } = requestedStudentId
    ? await studentQuery.eq("id", requestedStudentId).single()
    : await studentQuery.eq("profile_id", user.id).single();
  if (studentError) throw new Error("memorization_plan_student_unavailable");

  const { data, error } = await supabase
    .from("v_memorization_plan_adherence")
    .select(
      "student_id,weekly_target_pages,monthly_target_pages,weekly_achieved_pages,monthly_achieved_pages,weekly_adherence_percent,monthly_adherence_percent,starts_on,ends_on",
    )
    .eq("student_id", student.id)
    .maybeSingle();
  if (error) throw new Error("memorization_plan_unavailable");
  return data;
}
