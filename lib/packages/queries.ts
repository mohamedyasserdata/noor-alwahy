import "server-only";

import { connection } from "next/server";
import { DateTime } from "luxon";

import { createClient } from "@/lib/supabase/server";

export async function getPackageAdminData() {
  await connection();
  const supabase = await createClient();
  const now = DateTime.utc().toISO();
  if (!now) throw new Error("package_management_unavailable");
  const [packagesResult, pricesResult, tracksResult, countriesResult] = await Promise.all([
    supabase
      .from("packages")
      .select(
        "id,slug,track_id,name_ar,name_en,description_ar,description_en,audience,teacher_gender,sessions_per_week,duration_min,billing_period,features,policy,is_published,is_active,sort_order,updated_at",
      )
      .order("sort_order")
      .order("created_at"),
    supabase
      .from("package_prices")
      .select(
        "id,package_id,country_code,currency,amount,min_amount,max_amount,is_active,valid_from",
      )
      .lte("valid_from", now)
      .order("valid_from", { ascending: false }),
    supabase.from("tracks").select("id,name_ar,name_en").eq("is_active", true).order("sort_order"),
    supabase
      .from("countries")
      .select("code,name_ar,name_en,currency,default_timezone")
      .eq("is_enabled", true)
      .order("code"),
  ]);
  if (packagesResult.error || pricesResult.error || tracksResult.error || countriesResult.error) {
    throw new Error("package_management_unavailable");
  }

  const latestPriceKeys = new Set<string>();
  const prices = (pricesResult.data ?? []).filter((price) => {
    const key = `${price.package_id}:${price.country_code}`;
    if (latestPriceKeys.has(key)) return false;
    latestPriceKeys.add(key);
    return true;
  });
  return {
    packages: packagesResult.data ?? [],
    prices,
    tracks: tracksResult.data ?? [],
    countries: countriesResult.data ?? [],
  };
}
