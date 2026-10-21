import "server-only";

import { connection } from "next/server";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

const moneyRow = z.object({ currency: z.string(), amount: z.coerce.number() });
const riskFlagSchema = z.object({
  student_id: z.string(),
  student_no: z.string(),
  full_name: z.string(),
  country: z.string().nullable(),
  level_name_ar: z.string(),
  level_name_en: z.string(),
  risk_score: z.coerce.number(),
  risk_level: z.enum(["low", "medium", "high"]),
  reasons: z.array(z.string()),
  eligible_sessions: z.coerce.number(),
  absent_sessions: z.coerce.number(),
  absence_rate: z.coerce.number().nullable(),
  inactive_days: z.coerce.number().nullable(),
  evaluation_average: z.coerce.number().nullable(),
  overdue_review_pages: z.coerce.number(),
  subscription_status: z.string().nullable(),
  subscription_period_end: z.string().nullable(),
  last_report_period_end: z.string().nullable(),
});
const dashboardSchema = z.object({
  totals: z.object({
    students: z.coerce.number(),
    teachers: z.coerce.number(),
    active_subscriptions: z.coerce.number(),
    new_applications: z.coerce.number(),
    today_attendance: z.coerce.number().nullable(),
  }),
  conversion_rate: z.coerce.number().nullable(),
  churn_rate: z.coerce.number().nullable(),
  mrr: z.array(moneyRow),
  overdue: z.array(moneyRow),
  attendance: z.array(z.object({ day: z.string(), rate: z.coerce.number().nullable() })),
  finance: z.array(
    z.object({
      month: z.string(),
      currency: z.string(),
      revenue: z.coerce.number(),
      expense: z.coerce.number(),
    }),
  ),
  levels: z.array(
    z.object({ name_ar: z.string(), name_en: z.string(), students: z.coerce.number() }),
  ),
  teachers: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      rate: z.coerce.number().nullable(),
      eligible: z.coerce.number(),
    }),
  ),
  packages: z.array(
    z.object({
      name_ar: z.string(),
      name_en: z.string().nullable(),
      subscriptions: z.coerce.number(),
    }),
  ),
  countries: z.array(z.object({ country: z.string().nullable(), students: z.coerce.number() })),
  currencies: z.array(z.string()),
  recent_activity: z.array(
    z.object({
      action: z.string(),
      table: z.string().nullable(),
      record: z.string().nullable(),
      at: z.string(),
    }),
  ),
});

export type AdminDashboardData = z.infer<typeof dashboardSchema>;
export type StudentRiskFlag = z.infer<typeof riskFlagSchema>;
export type AdminDashboardReport = AdminDashboardData & { riskFlags: StudentRiskFlag[] };
export async function getAdminDashboardData(filters: {
  from: string;
  to: string;
  country: string;
  currency: string;
}) {
  await connection();
  const supabase = await createClient();
  const [dashboard, risks] = await Promise.all([
    supabase.rpc("get_admin_dashboard", {
      p_from: filters.from,
      p_to: filters.to,
      p_country: filters.country || undefined,
      p_currency: filters.currency || undefined,
    }),
    supabase.rpc("get_admin_student_risk_flags", {
      p_country: filters.country || undefined,
      p_limit: 100,
    }),
  ]);
  if (dashboard.error || risks.error) throw new Error("admin_dashboard_unavailable");
  return {
    ...dashboardSchema.parse(dashboard.data),
    riskFlags: z.array(riskFlagSchema).parse(risks.data),
  } satisfies AdminDashboardReport;
}
