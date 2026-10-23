import { after } from "next/server";

import { requireRole } from "@/lib/auth/require-role";
import { processAdminExport } from "@/lib/control-center/advanced-export-worker";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const locale = new URL(request.url).searchParams.get("locale") === "en" ? "en" : "ar";
  await requireRole("admin", locale);
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }
  const supabase = await createClient();
  const { data: jobId, error } = await supabase.rpc("retry_admin_export", { p_job: id });
  if (error || !jobId) return Response.json({ error: "export_retry_failed" }, { status: 400 });
  after(async () => processAdminExport(jobId));
  return Response.json(
    { id: jobId, status: "queued" },
    { status: 202, headers: { "Cache-Control": "private, no-store" } },
  );
}
