import "server-only";

import { connection } from "next/server";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

const bodySchema = z.object({
  metrics: z.record(z.string(), z.unknown()),
  summary: z.string(),
  strengths: z.string(),
  improve: z.string(),
  plan: z.string(),
  recommendation: z.string(),
});

export async function getAdminReports(
  filters: { studentId?: string; teacherId?: string; status?: string } = {},
) {
  await connection();
  const supabase = await createClient();
  let query = supabase
    .from("reports")
    .select(
      "id,student_id,teacher_id,period_type,period_start,period_end,status,approved_at,made_visible_at,body,review_note,published_version,students!reports_student_id_fkey(full_name),teachers!reports_teacher_id_fkey(profiles!teachers_profile_id_fkey(full_name))",
    )
    .order("updated_at", { ascending: false });
  if (filters.studentId) query = query.eq("student_id", filters.studentId);
  if (filters.teacherId) query = query.eq("teacher_id", filters.teacherId);
  if (["draft", "approved", "admin_review", "visible"].includes(filters.status ?? ""))
    query = query.eq("status", filters.status as "draft" | "approved" | "admin_review" | "visible");
  const { data, error } = await query;
  if (error) throw new Error("admin_reports_unavailable");
  return (data ?? []).map((report) => {
    const body = bodySchema.safeParse(report.body);
    if (!body.success) throw new Error("admin_report_body_invalid");
    return {
      id: report.id,
      studentId: report.student_id,
      teacherId: report.teacher_id,
      periodType: report.period_type,
      periodStart: report.period_start,
      periodEnd: report.period_end,
      status: report.status,
      studentName: report.students.full_name,
      teacherName: report.teachers.profiles.full_name,
      body: body.data,
      reviewNote: report.review_note,
      publishedVersion: report.published_version,
    };
  });
}
