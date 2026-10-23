import { getPublicSupabaseEnv } from "@/lib/env";

export async function GET() {
  const startedAt = performance.now();
  try {
    const env = getPublicSupabaseEnv();
    const response = await fetch(
      `${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/quran_dataset_meta?select=id&limit=1`,
      {
        headers: { apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY },
        cache: "no-store",
        signal: AbortSignal.timeout(3_000),
      },
    );
    if (!response.ok) throw new Error("database_unavailable");
    return Response.json(
      { status: "ok", database: "reachable", latencyMs: Math.round(performance.now() - startedAt) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      { status: "degraded", database: "unreachable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
