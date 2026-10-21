import { DateTime } from "luxon";
import { z } from "zod";

import { requireRole } from "@/lib/auth/require-role";
import {
  createPackageCsv,
  createPackageWorkbook,
  type PackageExportCell,
} from "@/lib/packages/xlsx-export";
import { createClient } from "@/lib/supabase/server";

const querySchema = z.object({
  locale: z.enum(["ar", "en"]).default("ar"),
  format: z.enum(["xlsx", "csv"]).default("xlsx"),
  template: z.enum(["true", "false"]).default("false"),
});

export async function GET(request: Request) {
  const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return Response.json({ error: "invalid_request" }, { status: 400 });
  await requireRole("admin", parsed.data.locale);
  if (parsed.data.template === "true")
    return workbookResponse([], parsed.data.locale, parsed.data.format, true);
  const now = DateTime.utc().toISO();
  if (!now) return Response.json({ error: "export_failed" }, { status: 503 });
  const supabase = await createClient();
  const [packagesResult, pricesResult, tracksResult] = await Promise.all([
    supabase.from("packages").select("*").order("sort_order").order("created_at"),
    supabase
      .from("package_prices")
      .select("*")
      .lte("valid_from", now)
      .order("valid_from", { ascending: false }),
    supabase.from("tracks").select("id,code"),
  ]);
  if (packagesResult.error || pricesResult.error || tracksResult.error)
    return Response.json({ error: "export_failed" }, { status: 503 });

  type PriceRow = NonNullable<typeof pricesResult.data>[number];
  const latest = new Map<string, PriceRow>();
  for (const price of pricesResult.data ?? []) {
    const key = `${price.package_id}:${price.country_code}`;
    if (!latest.has(key)) latest.set(key, price);
  }
  const trackCodes = new Map((tracksResult.data ?? []).map((track) => [track.id, track.code]));
  const rows: PackageExportCell[][] = [];
  for (const item of packagesResult.data ?? []) {
    const policy = item.policy as Record<string, unknown>;
    const trial = (policy.trial ?? {}) as Record<string, unknown>;
    const features = Array.isArray(item.features)
      ? (item.features as Array<{ ar?: string; en?: string }>)
      : [];
    const currentPrices = [...latest.values()].filter((price) => price.package_id === item.id);
    const packagePrices: Array<PriceRow | null> = currentPrices.length ? currentPrices : [null];
    for (const price of packagePrices) {
      rows.push([
        item.slug,
        item.name_ar,
        item.name_en ?? "",
        item.description_ar ?? "",
        item.description_en ?? "",
        item.track_id ? (trackCodes.get(item.track_id) ?? "") : "",
        item.audience ?? "",
        item.teacher_gender ?? "",
        item.sessions_per_week,
        item.duration_min,
        item.billing_period,
        features
          .map((feature) => feature.ar ?? "")
          .filter(Boolean)
          .join(" | "),
        features
          .map((feature) => feature.en ?? "")
          .filter(Boolean)
          .join(" | "),
        number(policy.cancel_notice_hours),
        number(policy.max_makeups_per_period),
        number(policy.makeup_valid_days),
        number(policy.late_tolerance_min),
        boolean(policy.student_no_show_consumes_credit),
        boolean(policy.student_no_show_pays_teacher),
        number(policy.partial_refund_pct),
        number(policy.max_pause_days),
        boolean(trial.enabled),
        number(trial.price_pct),
        price?.country_code ?? "",
        price?.currency ?? "",
        price?.amount ?? "",
        price?.min_amount ?? "",
        price?.max_amount ?? "",
        price ? String(price.is_active) : "",
        String(item.is_published),
      ]);
    }
  }

  return workbookResponse(rows, parsed.data.locale, parsed.data.format, false);
}

function workbookResponse(
  rows: PackageExportCell[][],
  locale: "ar" | "en",
  format: "xlsx" | "csv",
  template: boolean,
) {
  const headers = {
    "Cache-Control": "private, no-store, max-age=0",
    "X-Content-Type-Options": "nosniff",
  };
  const stem = template ? "package-import-template" : "packages";
  if (format === "csv") {
    return new Response(createPackageCsv(rows), {
      headers: {
        ...headers,
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${stem}.csv"`,
      },
    });
  }
  const workbook = createPackageWorkbook(rows, locale);
  return new Response(Uint8Array.from(workbook).buffer, {
    headers: {
      ...headers,
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${stem}.xlsx"`,
    },
  });
}

function number(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}
function boolean(value: unknown) {
  return String(value === true);
}
