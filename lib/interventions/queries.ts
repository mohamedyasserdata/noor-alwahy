import "server-only";

import { connection } from "next/server";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

const caseSchema = z.object({
  id: z.string().uuid(),
  rule_type: z.string(),
  subject_type: z.string(),
  subject_id: z.string().uuid(),
  subject_name: z.string(),
  status: z.enum(["open", "acknowledged", "resolved", "dismissed"]),
  priority: z.coerce.number().int().min(1).max(5),
  reason_code: z.string(),
  evidence: z.record(z.string(), z.unknown()),
  recommended_action: z.string(),
  action_path: z.string().startsWith("/admin/"),
  first_detected_at: z.string(),
  last_detected_at: z.string(),
  detection_count: z.coerce.number().int().positive(),
  escalated_at: z.string().nullable(),
  disposition_reason: z.string().nullable(),
});

const centerSchema = z.object({
  rows: z.array(caseSchema),
  total: z.coerce.number().int().nonnegative(),
  page: z.coerce.number().int().positive(),
  page_size: z.coerce.number().int().positive(),
  counts: z.object({
    open: z.coerce.number().int().nonnegative(),
    acknowledged: z.coerce.number().int().nonnegative(),
    resolved: z.coerce.number().int().nonnegative(),
    dismissed: z.coerce.number().int().nonnegative(),
  }),
  generated_at: z.string(),
});

const ruleSchema = z.object({
  id: z.string().uuid(),
  rule_type: z.string(),
  is_enabled: z.boolean(),
  priority: z.coerce.number().int().min(1).max(5),
  thresholds: z.record(z.string(), z.unknown()),
  window_interval: z.string(),
  cooldown_interval: z.string(),
});

export type InterventionCase = z.infer<typeof caseSchema>;
export type InterventionCenterData = z.infer<typeof centerSchema>;
export type InterventionRule = z.infer<typeof ruleSchema>;

export type InterventionFilters = {
  status: "" | "open" | "acknowledged" | "resolved" | "dismissed";
  priority: "" | "1" | "2" | "3" | "4" | "5";
  ruleType: string;
  page: number;
};

export async function getInterventionCenter(filters: InterventionFilters) {
  await connection();
  const supabase = await createClient();
  const [{ data, error }, rulesResult] = await Promise.all([
    supabase.rpc("get_intervention_center", {
      p_status: filters.status || undefined,
      p_priority: filters.priority ? Number(filters.priority) : undefined,
      p_rule_type: filters.ruleType || undefined,
      p_page: filters.page,
      p_page_size: 20,
    }),
    supabase
      .from("intervention_rules")
      .select("id,rule_type,is_enabled,priority,thresholds,window_interval,cooldown_interval")
      .order("priority", { ascending: false })
      .order("rule_type"),
  ]);
  if (error || rulesResult.error) throw new Error("intervention_center_unavailable");
  return {
    center: centerSchema.parse(data),
    rules: z.array(ruleSchema).parse(rulesResult.data ?? []),
  };
}

export function parseInterventionFilters(query: Record<string, string | string[] | undefined>) {
  const statusValue = scalar(query.caseStatus);
  const priorityValue = scalar(query.casePriority);
  const ruleValue = scalar(query.caseRule);
  const pageValue = Number(scalar(query.casePage));
  const statuses = ["open", "acknowledged", "resolved", "dismissed"] as const;
  const priorities = ["1", "2", "3", "4", "5"] as const;
  return {
    status: statuses.includes(statusValue as (typeof statuses)[number])
      ? (statusValue as (typeof statuses)[number])
      : "",
    priority: priorities.includes(priorityValue as (typeof priorities)[number])
      ? (priorityValue as (typeof priorities)[number])
      : "",
    ruleType: /^[a-z][a-z0-9_]{2,63}$/.test(ruleValue) ? ruleValue : "",
    page: Number.isInteger(pageValue) && pageValue > 0 && pageValue <= 100000 ? pageValue : 1,
  } satisfies InterventionFilters;
}

function scalar(value: string | string[] | undefined) {
  return typeof value === "string" ? value : "";
}
