"use server";

import type { Route } from "next";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { routing, type AppLocale } from "@/i18n/routing";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { priceCellSchema, pricingBulkSchema } from "@/lib/validators/pricing-grid";

function locale(value: string): AppLocale {
  return routing.locales.includes(value as AppLocale)
    ? (value as AppLocale)
    : routing.defaultLocale;
}
function target(value: AppLocale, values: Record<string, string>) {
  return `/${value}/admin/packages/pricing-grid?${new URLSearchParams(values)}` as Route;
}
function refresh(value: AppLocale) {
  revalidatePath(`/${value}/admin/packages/pricing-grid`);
  revalidatePath(`/${value}/admin/packages`);
  revalidatePath(`/${value}/packages`);
}
function bulk(formData: FormData) {
  return pricingBulkSchema.safeParse({
    sourceCountry: formData.get("sourceCountry"),
    targetCountry: formData.get("targetCountry"),
    multiplier: formData.get("multiplier"),
    roundTo: formData.get("roundTo"),
    validFrom: formData.get("validFrom"),
    packageIds: formData.getAll("packageIds"),
  });
}

export async function appendPriceAction(localeValue: string, formData: FormData): Promise<never> {
  const currentLocale = locale(localeValue);
  const { user } = await requireRole("admin", currentLocale);
  const parsed = priceCellSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect(target(currentLocale, { pricingError: "invalid_price" }));
  const supabase = await createClient();
  const { error } = await supabase.from("package_prices").insert({
    package_id: parsed.data.packageId,
    country_code: parsed.data.countryCode,
    currency: parsed.data.currency,
    amount: Number(parsed.data.amount),
    valid_from: parsed.data.validFrom,
    created_by: user.id,
  });
  if (error) {
    const code = error.message.includes("price_currency_mismatch")
      ? "currency_mismatch"
      : error.message.includes("duplicate")
        ? "schedule_conflict"
        : "save_failed";
    redirect(target(currentLocale, { pricingError: code }));
  }
  refresh(currentLocale);
  redirect(target(currentLocale, { pricingStatus: "saved" }));
}

export async function previewBulkPricingAction(
  localeValue: string,
  formData: FormData,
): Promise<never> {
  const currentLocale = locale(localeValue);
  await requireRole("admin", currentLocale);
  const parsed = bulk(formData);
  if (!parsed.success) redirect(target(currentLocale, { pricingError: "invalid_bulk" }));
  const values: Record<string, string> = {
    preview: "1",
    sourceCountry: parsed.data.sourceCountry,
    targetCountry: parsed.data.targetCountry,
    multiplier: String(parsed.data.multiplier),
    roundTo: String(parsed.data.roundTo),
    validFrom: parsed.data.validFrom,
  };
  if (parsed.data.packageIds.length) values.packageIds = parsed.data.packageIds.join(",");
  redirect(target(currentLocale, values));
}

export async function confirmBulkPricingAction(
  localeValue: string,
  formData: FormData,
): Promise<never> {
  const currentLocale = locale(localeValue);
  await requireRole("admin", currentLocale);
  const parsed = bulk(formData);
  if (!parsed.success) redirect(target(currentLocale, { pricingError: "invalid_bulk" }));
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("bulk_append_package_prices", {
    p_source_country: parsed.data.sourceCountry,
    p_target_country: parsed.data.targetCountry,
    p_multiplier: parsed.data.multiplier,
    p_round_to: parsed.data.roundTo,
    p_valid_from: parsed.data.validFrom,
    p_package_ids: parsed.data.packageIds.length ? parsed.data.packageIds : undefined,
  });
  if (error) {
    const code = error.message.includes("source_prices_not_found")
      ? "source_missing"
      : error.message.includes("schedule_conflict")
        ? "schedule_conflict"
        : "bulk_failed";
    redirect(target(currentLocale, { pricingError: code }));
  }
  refresh(currentLocale);
  redirect(target(currentLocale, { pricingStatus: "bulk_saved", count: String(data ?? 0) }));
}
