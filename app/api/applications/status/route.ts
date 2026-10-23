import { applicationHash } from "@/lib/applications/security";
import { createAdminClient } from "@/lib/supabase/admin";
import { applicationStatusLookupSchema } from "@/lib/validators/applications";

export async function POST(request: Request) {
  const raw = await request.text();
  if (raw.length > 4096) return Response.json({ error: "invalid_request" }, { status: 413 });
  let input: unknown;
  try {
    input = JSON.parse(raw);
  } catch {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }
  const parsed = applicationStatusLookupSchema.safeParse(input);
  if (!parsed.success) return Response.json({ error: "not_found" }, { status: 404 });
  const admin = createAdminClient();
  const { data, error } = await admin
    .rpc("lookup_application_status", {
      p_order_no: parsed.data.order_no,
      p_lookup_hash: applicationHash(parsed.data.identifier),
    })
    .maybeSingle();
  if (error || !data) return Response.json({ error: "not_found" }, { status: 404 });
  return Response.json(
    { status: data.status, updated_at: data.updated_at },
    { headers: { "Cache-Control": "private, no-store, max-age=0" } },
  );
}
