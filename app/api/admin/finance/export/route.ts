import { DateTime } from "luxon";
import { z } from "zod";

import { requireRole } from "@/lib/auth/require-role";
import {
  createFinancialWorkbook,
  renderFinancialPdf,
  type FinancialSummaryRow,
} from "@/lib/billing/financial-export";
import { createClient } from "@/lib/supabase/server";

const querySchema = z.object({
  locale: z.enum(["ar", "en"]).default("ar"),
  format: z.enum(["pdf", "xlsx"]).default("pdf"),
});

export async function GET(request: Request) {
  const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return Response.json({ error: "invalid_request" }, { status: 400 });
  await requireRole("admin", parsed.data.locale);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("financial_currency_summary")
    .select("*")
    .order("currency");
  if (error) return Response.json({ error: "export_failed" }, { status: 503 });
  const rows: FinancialSummaryRow[] = (data ?? []).map((row) => ({
    currency: row.currency ?? "",
    invoiced: Number(row.invoiced ?? 0),
    received: Number(row.received ?? 0),
    refunded: Number(row.refunded ?? 0),
    expenses: Number(row.expenses ?? 0),
    outstanding: Number(row.outstanding ?? 0),
    netCash: Number(row.net_cash ?? 0),
  }));
  const headers = {
    "Cache-Control": "private, no-store, max-age=0",
    "X-Content-Type-Options": "nosniff",
  };
  if (parsed.data.format === "xlsx") {
    const workbook = createFinancialWorkbook(rows, parsed.data.locale);
    return new Response(Uint8Array.from(workbook).buffer, {
      headers: {
        ...headers,
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="financial-report.xlsx"',
      },
    });
  }
  const generatedAt = DateTime.utc()
    .setLocale(parsed.data.locale)
    .toLocaleString(DateTime.DATETIME_MED);
  const pdf = await renderFinancialPdf(rows, parsed.data.locale, generatedAt);
  return new Response(Uint8Array.from(pdf).buffer, {
    headers: {
      ...headers,
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="financial-report.pdf"',
    },
  });
}
