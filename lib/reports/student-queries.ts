import "server-only";

import { connection } from "next/server";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

const bodySchema = z.object({
  summary: z.string(),
  strengths: z.string(),
  improve: z.string(),
  plan: z.string(),
  recommendation: z.string(),
});

export async function getStudentPublishedReports() {
  await connection();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reports")
    .select("id,period_type,period_start,period_end,body,made_visible_at,published_version")
    .eq("status", "visible")
    .order("period_end", { ascending: false });
  if (error) throw new Error("student_reports_unavailable");
  return (data ?? []).map((report) => {
    const body = bodySchema.safeParse(report.body);
    if (!body.success) throw new Error("student_report_body_invalid");
    return { ...report, body: body.data };
  });
}
