import "server-only";

import { connection } from "next/server";

import type { AuditLogFilters, AuditLogRow } from "@/lib/audit/audit-log";
import { createClient } from "@/lib/supabase/server";

export const auditLogPageSize = 20;

export type AuditLogQueryResult =
  | { status: "forbidden" }
  | { message: string; status: "error" }
  | {
      actors: Record<string, string>;
      count: number;
      entries: AuditLogRow[];
      status: "success";
    };

export async function getAuditLogs(filters: AuditLogFilters): Promise<AuditLogQueryResult> {
  await connection();
  const supabase = await createClient();
  const { data: isAdmin, error: authorizationError } = await supabase.rpc("is_admin");

  if (authorizationError || !isAdmin) {
    return { status: "forbidden" };
  }

  const offset = (filters.page - 1) * auditLogPageSize;
  let query = supabase
    .from("audit_logs")
    .select("id,user_id,action,table_name,record_id,before,after,ip,created_at,updated_at", {
      count: "exact",
    })
    .order("created_at", { ascending: false })
    .range(offset, offset + auditLogPageSize - 1);

  if (filters.action) {
    query = query.eq("action", filters.action);
  }

  if (filters.tableName) {
    query = query.eq("table_name", filters.tableName);
  }

  if (filters.recordId) {
    query = query.eq("record_id", filters.recordId);
  }

  const { count, data, error } = await query;

  if (error) {
    return { message: error.message, status: "error" };
  }

  const entries = data ?? [];
  const actorIds = [...new Set(entries.flatMap((entry) => (entry.user_id ? [entry.user_id] : [])))];
  let actors: Record<string, string> = {};

  if (actorIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id,full_name")
      .in("id", actorIds);

    actors = Object.fromEntries((profiles ?? []).map((profile) => [profile.id, profile.full_name]));
  }

  return {
    actors,
    count: count ?? 0,
    entries,
    status: "success",
  };
}
