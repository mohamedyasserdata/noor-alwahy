import { z } from "zod";

import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";

const requestSchema = z.object({
  versionId: z.string().uuid(),
  locale: z.enum(["ar", "en"]),
  values: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
});

const responseSchema = z.object({
  subject: z.string().nullable(),
  body: z.string(),
  missing: z.array(z.string()),
  version_id: z.string().uuid(),
  version_no: z.coerce.number().int().positive(),
  locale: z.enum(["ar", "en"]),
});

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid_request" }, { status: 400 });
  await requireRole("admin", parsed.data.locale);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("render_content_template", {
    p_version: parsed.data.versionId,
    p_values: parsed.data.values,
    p_locale: parsed.data.locale,
  });
  if (error) return Response.json({ error: "render_failed" }, { status: 400 });
  const result = responseSchema.safeParse(data);
  if (!result.success) return Response.json({ error: "invalid_render" }, { status: 503 });
  return Response.json(result.data, {
    headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" },
  });
}
