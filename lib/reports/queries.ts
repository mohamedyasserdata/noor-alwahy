import "server-only";

import { connection } from "next/server";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

const metricsSchema = z.object({
  mastered_pages: z.number(),
  attendance: z.object({ total: z.number(), present: z.number(), rate: z.number().nullable() }),
  evaluation_average: z.number().nullable(),
  criteria_average: z.record(z.string(), z.number()),
});

const bodySchema = z.object({
  metrics: metricsSchema,
  summary: z.string(),
  strengths: z.string(),
  improve: z.string(),
  plan: z.string(),
  recommendation: z.string(),
});

export async function getTeacherReportsData() {
  await connection();
  const supabase = await createClient();
  const { data: teacher, error: teacherError } = await supabase
    .from("teachers")
    .select("id")
    .single();
  if (teacherError) throw new Error("reports_unavailable");

  const [assignmentsResult, reportsResult] = await Promise.all([
    supabase
      .from("teacher_assignments")
      .select("student_id,students!teacher_assignments_student_id_fkey(full_name)")
      .eq("teacher_id", teacher.id)
      .eq("status", "active")
      .order("created_at", { ascending: false }),
    supabase
      .from("reports")
      .select(
        "id,student_id,period_type,period_start,period_end,body,status,approved_at,updated_at",
      )
      .eq("teacher_id", teacher.id)
      .order("period_start", { ascending: false }),
  ]);
  if (assignmentsResult.error || reportsResult.error) throw new Error("reports_unavailable");

  const students = new Map<string, string>();
  for (const assignment of assignmentsResult.data ?? []) {
    students.set(assignment.student_id, assignment.students.full_name);
  }
  return {
    students: [...students]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    reports: (reportsResult.data ?? []).map((report) => {
      const body = bodySchema.safeParse(report.body);
      if (!body.success) throw new Error("report_body_invalid");
      return { ...report, studentName: students.get(report.student_id) ?? "", body: body.data };
    }),
  };
}
