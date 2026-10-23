import { z } from "zod";

import { requireRole } from "@/lib/auth/require-role";
import {
  advancedReportResponseSchema,
  advancedReportTypeSchema,
} from "@/lib/control-center/advanced-report-schema";
import { createClient } from "@/lib/supabase/server";

const querySchema = z
  .object({
    reportType: advancedReportTypeSchema,
    locale: z.enum(["ar", "en"]),
    from: z.iso.date(),
    to: z.iso.date(),
    country: z.union([z.literal(""), z.string().regex(/^[A-Z]{2}$/)]).default(""),
    track: z.union([z.literal(""), z.string().uuid()]).default(""),
    teacher: z.union([z.literal(""), z.string().uuid()]).default(""),
    status: z.string().trim().max(40).default(""),
    sort: z.string().trim().max(40).default(""),
    direction: z.enum(["asc", "desc"]).default("asc"),
    timezone: z.string().trim().min(1).max(100).default("Africa/Cairo"),
    page: z.coerce.number().int().min(1).max(100000).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(25),
  })
  .refine((value) => value.from <= value.to, { path: ["to"], message: "invalid_period" });

export async function GET(request: Request) {
  const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return Response.json({ error: "invalid_request" }, { status: 400 });
  await requireRole("admin", parsed.data.locale);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_admin_advanced_report", {
    p_report_type: parsed.data.reportType,
    p_from: parsed.data.from,
    p_to: parsed.data.to,
    p_country: parsed.data.country || undefined,
    p_track: parsed.data.track || undefined,
    p_teacher: parsed.data.teacher || undefined,
    p_status: parsed.data.status || undefined,
    p_sort: parsed.data.sort || undefined,
    p_direction: parsed.data.direction,
    p_page: parsed.data.page,
    p_page_size: parsed.data.pageSize,
    p_locale: parsed.data.locale,
    p_timezone: parsed.data.timezone,
  });
  if (error) return Response.json({ error: "advanced_report_unavailable" }, { status: 503 });
  const result = advancedReportResponseSchema.safeParse(data);
  if (!result.success) return Response.json({ error: "invalid_report_response" }, { status: 503 });
  return Response.json(result.data, {
    headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" },
  });
}
