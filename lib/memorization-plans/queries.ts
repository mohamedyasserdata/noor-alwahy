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
  plan: PlanRow | null;
  adherence: PlanAdherence | null;
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
    .select("student_id,students!teacher_assignments_student_id_fkey(full_name)")
    .eq("teacher_id", teacher.id)
    .eq("status", "active")
    .order("created_at", { ascending: false });
  if (assignmentsError) throw new Error("memorization_plans_unavailable");

  const students = new Map<string, string>();
  for (const assignment of assignments ?? []) {
    students.set(assignment.student_id, assignment.students.full_name);
  }
  const studentIds = [...students.keys()];
  if (!studentIds.length) return [];

  const [plansResult, adherenceResult] = await Promise.all([
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
  ]);
  if (plansResult.error || adherenceResult.error) {
    throw new Error("memorization_plans_unavailable");
  }

  const plans = new Map((plansResult.data ?? []).map((plan) => [plan.student_id, plan]));
  const adherence = new Map(
    (adherenceResult.data ?? [])
      .filter((row): row is typeof row & { student_id: string } => Boolean(row.student_id))
      .map((row) => [row.student_id, row]),
  );

  return studentIds
    .map((studentId) => ({
      studentId,
      studentName: students.get(studentId) ?? "",
      plan: plans.get(studentId) ?? null,
      adherence: adherence.get(studentId) ?? null,
    }))
    .sort((left, right) => left.studentName.localeCompare(right.studentName));
}

export async function getStudentMemorizationPlan(): Promise<PlanAdherence | null> {
  await connection();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("memorization_plan_auth_required");

  const { data: student, error: studentError } = await supabase
    .from("students")
    .select("id")
    .eq("profile_id", user.id)
    .single();
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
