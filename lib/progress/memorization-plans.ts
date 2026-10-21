import "server-only";

import { connection } from "next/server";

import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";

type AdherenceRow = Database["public"]["Views"]["v_memorization_plan_adherence"]["Row"];

export type MemorizationPlanAdherence = {
  studentId: string;
  weeklyTargetPages: number;
  monthlyTargetPages: number;
  weeklyAchievedPages: number;
  monthlyAchievedPages: number;
  weeklyAdherencePercent: number;
  monthlyAdherencePercent: number;
  startsOn: string;
  endsOn: string | null;
};

export type TeacherStudentPlan = {
  studentId: string;
  studentName: string;
  plan: MemorizationPlanAdherence | null;
};

function toPlan(row: AdherenceRow): MemorizationPlanAdherence | null {
  if (
    !row.student_id ||
    row.weekly_target_pages === null ||
    row.monthly_target_pages === null ||
    row.weekly_achieved_pages === null ||
    row.monthly_achieved_pages === null ||
    row.weekly_adherence_percent === null ||
    row.monthly_adherence_percent === null ||
    !row.starts_on
  ) {
    return null;
  }
  return {
    studentId: row.student_id,
    weeklyTargetPages: row.weekly_target_pages,
    monthlyTargetPages: row.monthly_target_pages,
    weeklyAchievedPages: row.weekly_achieved_pages,
    monthlyAchievedPages: row.monthly_achieved_pages,
    weeklyAdherencePercent: Number(row.weekly_adherence_percent),
    monthlyAdherencePercent: Number(row.monthly_adherence_percent),
    startsOn: row.starts_on,
    endsOn: row.ends_on,
  };
}

export async function getStudentMemorizationPlan(): Promise<MemorizationPlanAdherence | null> {
  await connection();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("v_memorization_plan_adherence")
    .select("*")
    .maybeSingle();
  if (error) throw new Error("memorization_plan_unavailable");
  return data ? toPlan(data) : null;
}

export async function getTeacherStudentPlans(): Promise<TeacherStudentPlan[]> {
  await connection();
  const supabase = await createClient();
  const { data: assignments, error: assignmentsError } = await supabase
    .from("teacher_assignments")
    .select("student_id,student:students!inner(id,full_name)")
    .in("status", ["active", "paused"])
    .order("created_at");
  if (assignmentsError) throw new Error("memorization_plan_students_unavailable");

  const students = new Map<string, string>();
  for (const assignment of assignments ?? []) {
    const student = Array.isArray(assignment.student) ? assignment.student[0] : assignment.student;
    if (student) students.set(student.id, student.full_name);
  }
  const studentIds = [...students.keys()];
  if (!studentIds.length) return [];

  const { data: plans, error: plansError } = await supabase
    .from("v_memorization_plan_adherence")
    .select("*")
    .in("student_id", studentIds);
  if (plansError) throw new Error("memorization_plans_unavailable");
  const plansByStudent = new Map(
    (plans ?? []).flatMap((row) => {
      const plan = toPlan(row);
      return plan ? [[plan.studentId, plan] as const] : [];
    }),
  );

  return studentIds.map((studentId) => ({
    studentId,
    studentName: students.get(studentId) ?? "",
    plan: plansByStudent.get(studentId) ?? null,
  }));
}
