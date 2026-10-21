import { DateTime } from "luxon";
import { z } from "zod";

import { requireRole } from "@/lib/auth/require-role";
import { getAdminDashboardData } from "@/lib/dashboard/admin-dashboard";
import { renderAdminDashboardPdf } from "@/lib/dashboard/export-pdf";
import { createAdminDashboardWorkbook } from "@/lib/dashboard/export-xlsx";

const querySchema = z
  .object({
    locale: z.enum(["ar", "en"]).default("ar"),
    format: z.enum(["pdf", "xlsx"]).default("pdf"),
    from: z.iso.date(),
    to: z.iso.date(),
    country: z.union([z.literal(""), z.string().regex(/^[A-Z]{2}$/)]).default(""),
    currency: z.union([z.literal(""), z.string().regex(/^[A-Z]{3}$/)]).default(""),
  })
  .refine((value) => value.from <= value.to, { path: ["to"], message: "invalid_period" });

export async function GET(request: Request) {
  const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return Response.json({ error: "invalid_request" }, { status: 400 });

  await requireRole("admin", parsed.data.locale);
  const data = await getAdminDashboardData(parsed.data);
  const generatedAt = DateTime.utc()
    .setLocale(parsed.data.locale)
    .toLocaleString(DateTime.DATETIME_MED_WITH_SECONDS);
  const filters = { ...parsed.data, generatedAt };
  const headers = {
    "Cache-Control": "private, no-store, max-age=0",
    "X-Content-Type-Options": "nosniff",
  };

  if (parsed.data.format === "xlsx") {
    const workbook = createAdminDashboardWorkbook(data, parsed.data.locale, filters);
    return new Response(Uint8Array.from(workbook).buffer, {
      headers: {
        ...headers,
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="admin-dashboard-report.xlsx"',
      },
    });
  }

  const pdf = await renderAdminDashboardPdf(data, parsed.data.locale, filters);
  return new Response(Uint8Array.from(pdf).buffer, {
    headers: {
      ...headers,
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="admin-dashboard-report.pdf"',
    },
  });
}
