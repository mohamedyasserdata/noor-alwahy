import { requireRole } from "@/lib/auth/require-role";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const locale = new URL(request.url).searchParams.get("locale") === "en" ? "en" : "ar";
  await requireRole("admin", locale);
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response(null, { status: 404 });
  const supabase = await createClient();
  const { data: job, error } = await supabase
    .from("export_jobs")
    .select("status,storage_path,expires_at")
    .eq("id", id)
    .maybeSingle();
  if (
    error ||
    !job ||
    job.status !== "completed" ||
    !job.storage_path ||
    !job.expires_at ||
    new Date(job.expires_at).getTime() <= Date.now()
  ) {
    return new Response(null, { status: 404, headers: { "Cache-Control": "private, no-store" } });
  }
  const admin = createAdminClient();
  const { data, error: signError } = await admin.storage
    .from("admin-exports")
    .createSignedUrl(job.storage_path, 60, { download: true });
  if (signError || !data.signedUrl) return new Response(null, { status: 503 });
  return new Response(null, {
    status: 302,
    headers: {
      Location: data.signedUrl,
      "Cache-Control": "private, no-store, max-age=0",
      "Referrer-Policy": "no-referrer",
    },
  });
}
