import { connection } from "next/server";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

const metricSchema = z.object({
  value: z.coerce.number().nullable(),
  numerator: z.coerce.number().optional(),
  denominator: z.coerce.number(),
  unit: z.enum([
    "people",
    "sessions",
    "percent",
    "subscriptions",
    "pages",
    "score",
    "evaluations",
    "reports",
  ]),
  period: z.enum(["snapshot", "range"]),
});

const sourceBaseSchema = z.object({
  source: z.enum(["operations", "learning", "finance"]),
  generated_at: z.string(),
  refreshed_at: z.string(),
});

const operationsSchema = sourceBaseSchema.extend({
  source: z.literal("operations"),
  metrics: z.object({
    students: metricSchema,
    teachers: metricSchema,
    sessions: metricSchema,
    held_sessions: metricSchema,
    missed_sessions: metricSchema,
    cancelled_sessions: metricSchema,
    attendance_rate: metricSchema,
    active_subscriptions: metricSchema,
  }),
});

const learningSchema = sourceBaseSchema.extend({
  source: z.literal("learning"),
  metrics: z.object({
    mastered_pages: metricSchema,
    due_reviews: metricSchema,
    evaluation_average: metricSchema,
    locked_evaluations: metricSchema,
    visible_reports: metricSchema,
    pending_reports: metricSchema,
  }),
});

const financeSchema = sourceBaseSchema.extend({
  source: z.literal("finance"),
  currencies: z.array(
    z.object({
      currency: z.string().regex(/^[A-Z]{3}$/),
      invoice_count: z.coerce.number(),
      invoiced: z.coerce.number(),
      overdue: z.coerce.number(),
      payment_count: z.coerce.number(),
      payments_net: z.coerce.number(),
      payout_count: z.coerce.number(),
      payouts_total: z.coerce.number(),
      payouts_due: z.coerce.number(),
    }),
  ),
});

const optionsSchema = z.object({
  countries: z.array(z.string().regex(/^[A-Z]{2}$/)),
  tracks: z.array(
    z.object({ id: z.string().uuid(), name_ar: z.string(), name_en: z.string().nullable() }),
  ),
  teachers: z.array(z.object({ id: z.string().uuid(), name: z.string() })),
  statuses: z.array(z.enum(["active", "dropped", "graduated", "suspended", "archived"])),
});

export type AdminMetric = z.infer<typeof metricSchema>;
export type OperationsMetrics = z.infer<typeof operationsSchema>;
export type LearningMetrics = z.infer<typeof learningSchema>;
export type FinanceMetrics = z.infer<typeof financeSchema>;
export type AdminMetricOptions = z.infer<typeof optionsSchema>;
export type MetricSourceState<T> =
  { available: true; data: T } | { available: false; error: "unavailable" | "invalid_response" };

export type AdminMetricFilters = {
  from: string;
  to: string;
  country: string;
  track: string;
  teacher: string;
  status: string;
  timezone: string;
};

export async function getAdminControlCenter(filters: AdminMetricFilters) {
  await connection();
  const supabase = await createClient();
  const parameters = {
    p_from: filters.from,
    p_to: filters.to,
    p_country: filters.country || undefined,
    p_track: filters.track || undefined,
    p_teacher: filters.teacher || undefined,
    p_status: filters.status || undefined,
    p_timezone: filters.timezone,
  };

  const results = await Promise.allSettled([
    supabase.rpc("get_admin_operations_metrics", parameters),
    supabase.rpc("get_admin_learning_metrics", parameters),
    supabase.rpc("get_admin_finance_metrics", parameters),
    supabase.rpc("get_admin_metric_filter_options"),
  ]);

  return {
    operations: parseSource(results[0], operationsSchema),
    learning: parseSource(results[1], learningSchema),
    finance: parseSource(results[2], financeSchema),
    options: parseOptions(results[3]),
  };
}

function parseSource<T>(
  result: PromiseSettledResult<{ data: unknown; error: { message: string } | null }>,
  schema: z.ZodType<T>,
): MetricSourceState<T> {
  if (result.status === "rejected" || result.value.error) {
    return { available: false, error: "unavailable" };
  }
  const parsed = schema.safeParse(result.value.data);
  return parsed.success
    ? { available: true, data: parsed.data }
    : { available: false, error: "invalid_response" };
}

function parseOptions(
  result: PromiseSettledResult<{ data: unknown; error: { message: string } | null }>,
): AdminMetricOptions {
  if (result.status === "rejected" || result.value.error) return emptyOptions();
  const parsed = optionsSchema.safeParse(result.value.data);
  return parsed.success ? parsed.data : emptyOptions();
}

function emptyOptions(): AdminMetricOptions {
  return { countries: [], tracks: [], teachers: [], statuses: [] };
}
