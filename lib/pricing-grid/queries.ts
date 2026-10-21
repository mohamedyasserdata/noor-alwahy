import "server-only";

import Decimal from "decimal.js";
import { DateTime } from "luxon";
import { connection } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { pricingBulkSchema } from "@/lib/validators/pricing-grid";

export async function getPricingGridData(query: Record<string, string | string[] | undefined>) {
  await connection();
  const supabase = await createClient();
  const now = DateTime.utc().toISO();
  if (!now) throw new Error("pricing_grid_unavailable");
  const [packages, countries, prices, subscriptions] = await Promise.all([
    supabase
      .from("packages")
      .select("id,slug,name_ar,name_en,is_published,is_active")
      .eq("is_active", true)
      .order("sort_order"),
    supabase
      .from("countries")
      .select("code,name_ar,name_en,currency")
      .eq("is_enabled", true)
      .order("code"),
    supabase
      .from("package_prices")
      .select("id,package_id,country_code,currency,amount,is_active,valid_from")
      .order("valid_from", { ascending: false }),
    supabase
      .from("subscriptions")
      .select("package_id,status")
      .in("status", ["trial", "active", "paused"]),
  ]);
  if (packages.error || countries.error || prices.error || subscriptions.error)
    throw new Error("pricing_grid_unavailable");
  const current = new Map<string, (typeof prices.data)[number]>();
  const scheduled = [] as typeof prices.data;
  for (const price of prices.data ?? []) {
    const key = `${price.package_id}:${price.country_code}`;
    if (price.valid_from > now) scheduled.push(price);
    else if (!current.has(key)) current.set(key, price);
  }
  const rawPackageIds =
    typeof query.packageIds === "string" && query.packageIds ? query.packageIds.split(",") : [];
  const parsed = pricingBulkSchema.safeParse({
    sourceCountry: query.sourceCountry,
    targetCountry: query.targetCountry,
    multiplier: query.multiplier,
    roundTo: query.roundTo,
    validFrom: query.validFrom,
    packageIds: rawPackageIds,
  });
  const preview =
    parsed.success && query.preview === "1"
      ? (packages.data ?? [])
          .filter(
            (item) => !parsed.data.packageIds.length || parsed.data.packageIds.includes(item.id),
          )
          .flatMap((item) => {
            const source = current.get(`${item.id}:${parsed.data.sourceCountry}`);
            if (!source?.is_active) return [];
            const amount = new Decimal(source.amount)
              .times(parsed.data.multiplier)
              .div(parsed.data.roundTo)
              .round()
              .times(parsed.data.roundTo)
              .toDecimalPlaces(2)
              .toNumber();
            return [
              {
                package: item,
                source,
                amount,
                activeSubscriptions: (subscriptions.data ?? []).filter(
                  (subscription) => subscription.package_id === item.id,
                ).length,
              },
            ];
          })
      : [];
  return {
    packages: packages.data ?? [],
    countries: countries.data ?? [],
    current,
    scheduled,
    preview,
    bulk: parsed.success ? parsed.data : null,
    now,
  };
}
