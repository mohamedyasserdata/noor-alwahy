import { after } from "next/server";

import { requireRole } from "@/lib/auth/require-role";
import { processAdminExport } from "@/lib/control-center/advanced-export-worker";
import { advancedExportRequestSchema } from "@/lib/control-center/advanced-report-schema";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const parsed = advancedExportRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid_request" }, { status: 400 });
  await requireRole("admin", parsed.data.locale);
  const supabase = await createClient();
  const { data: jobId, error } = await supabase.rpc("queue_admin_export", {
    p_report_type: parsed.data.reportType,
    p_format: parsed.data.format,
    p_filters: parsed.data.filters,
    p_columns: parsed.data.columns,
    p_locale: parsed.data.locale,
    p_timezone: parsed.data.timezone,
  });
  if (error || !jobId) return Response.json({ error: "export_queue_failed" }, { status: 400 });
  after(async () => processAdminExport(jobId));
  return Response.json({ id: jobId, status: "queued" }, { status: 202, headers: privateHeaders() });
}

export async function GET(request: Request) {
  const locale = new URL(request.url).searchParams.get("locale") === "en" ? "en" : "ar";
  await requireRole("admin", locale);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("export_jobs")
    .select("id,report_type,format,status,row_count,error_code,created_at,finished_at,expires_at")
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) return Response.json({ error: "export_jobs_unavailable" }, { status: 503 });
  return Response.json({ jobs: data ?? [] }, { headers: privateHeaders() });
}

function privateHeaders() {
  return {
    "Cache-Control": "private, no-store, max-age=0",
    "X-Content-Type-Options": "nosniff",
  };
}
