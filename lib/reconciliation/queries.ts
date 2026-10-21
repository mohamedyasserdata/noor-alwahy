import "server-only";

import { connection } from "next/server";

import { createClient } from "@/lib/supabase/server";

export async function getReconciliationData() {
  await connection();
  const supabase = await createClient();
  const runs = await supabase
    .from("reconciliation_runs")
    .select("id,status,issue_count,started_at,finished_at,details")
    .order("started_at", { ascending: false })
    .limit(20);
  if (runs.error) throw new Error("reconciliation_unavailable");
  const ids = (runs.data ?? []).map((run) => run.id);
  const issues = ids.length
    ? await supabase
        .from("reconciliation_issues")
        .select("id,run_id,category,entity_id,expected,actual,details,created_at")
        .in("run_id", ids)
        .order("created_at", { ascending: false })
        .limit(500)
    : { data: [], error: null };
  if (issues.error) throw new Error("reconciliation_unavailable");
  return { runs: runs.data ?? [], issues: issues.data ?? [] };
}
