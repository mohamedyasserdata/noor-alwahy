import "server-only";

import { connection } from "next/server";

import { createClient } from "@/lib/supabase/server";

export async function getAdminReports() {
  await connection();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reports")
    .select(
      "id,period_type,period_start,period_end,status,approved_at,made_visible_at,students!reports_student_id_fkey(full_name),teachers!reports_teacher_id_fkey(profiles!teachers_profile_id_fkey(full_name))",
    )
    .order("updated_at", { ascending: false });
  if (error) throw new Error("admin_reports_unavailable");
  return (data ?? []).map((report) => ({
    id: report.id,
    periodType: report.period_type,
    periodStart: report.period_start,
    periodEnd: report.period_end,
    status: report.status,
    studentName: report.students.full_name,
    teacherName: report.teachers.profiles.full_name,
  }));
}
