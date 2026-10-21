"use server";

import type { Route } from "next";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { routing, type AppLocale } from "@/i18n/routing";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import {
  createSubscriptionSchema,
  pauseSubscriptionSchema,
  renewalRunSchema,
  subscriptionChangeSchema,
} from "@/lib/validators/subscriptions";

function locale(value: string): AppLocale {
  return routing.locales.includes(value as AppLocale)
    ? (value as AppLocale)
    : routing.defaultLocale;
}

function target(value: AppLocale, key: string, code: string, application = false) {
  const section = application ? "applications" : "subscriptions";
  return `/${value}/admin/${section}?${new URLSearchParams({ [key]: code })}` as Route;
}

export async function createSubscriptionAction(
  localeValue: string,
  fromApplication: boolean,
  formData: FormData,
): Promise<never> {
  const currentLocale = locale(localeValue);
  await requireRole("admin", currentLocale);
  const parsed = createSubscriptionSchema.safeParse({
    studentId: formData.get("studentId"),
    packageId: formData.get("packageId"),
    countryCode: formData.get("countryCode"),
    startDate: formData.get("startDate"),
    applicationId: formData.get("applicationId") ?? "",
  });
  if (!parsed.success) {
    redirect(target(currentLocale, "subscriptionError", "invalid_fields", fromApplication));
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_subscription", {
    p_student: parsed.data.studentId,
    p_package: parsed.data.packageId,
    p_country: parsed.data.countryCode,
    p_start_date: parsed.data.startDate,
    p_application: parsed.data.applicationId || undefined,
  });
  if (error || !data) {
    const code = error?.message.includes("already_has_current")
      ? "already_current"
      : error?.message.includes("price_not_found")
        ? "price_missing"
        : error?.message.includes("application_not_ready") ||
            error?.message.includes("application_package_mismatch")
          ? "application_mismatch"
          : "create_failed";
    redirect(target(currentLocale, "subscriptionError", code, fromApplication));
  }
  revalidatePath(`/${currentLocale}/admin/subscriptions`);
  revalidatePath(`/${currentLocale}/admin/applications`);
  redirect(target(currentLocale, "subscriptionStatus", "created", fromApplication));
}

export async function pauseSubscriptionAction(
  localeValue: string,
  formData: FormData,
): Promise<never> {
  const currentLocale = locale(localeValue);
  await requireRole("admin", currentLocale);
  const parsed = pauseSubscriptionSchema.safeParse({
    subscriptionId: formData.get("subscriptionId"),
    pausedUntil: formData.get("pausedUntil"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) redirect(target(currentLocale, "subscriptionError", "invalid_pause"));
  const supabase = await createClient();
  const { error } = await supabase.rpc("pause_subscription", {
    p_subscription: parsed.data.subscriptionId,
    p_until: parsed.data.pausedUntil,
    p_reason: parsed.data.reason,
  });
  if (error) {
    redirect(
      target(
        currentLocale,
        "subscriptionError",
        error.message.includes("pause_period_invalid") ? "invalid_pause" : "pause_failed",
      ),
    );
  }
  revalidatePath(`/${currentLocale}/admin/subscriptions`);
  redirect(target(currentLocale, "subscriptionStatus", "paused"));
}

export async function requestSubscriptionChangeAction(
  localeValue: string,
  formData: FormData,
): Promise<never> {
  const currentLocale = locale(localeValue);
  await requireRole("admin", currentLocale);
  const parsed = subscriptionChangeSchema.safeParse({
    subscriptionId: formData.get("subscriptionId"),
    targetPackageId: formData.get("targetPackageId"),
  });
  if (!parsed.success) redirect(target(currentLocale, "subscriptionError", "invalid_change"));
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("request_subscription_change", {
    p_subscription: parsed.data.subscriptionId,
    p_target_package: parsed.data.targetPackageId,
  });
  if (error) {
    redirect(
      target(
        currentLocale,
        "subscriptionError",
        error.message.includes("price_not_found") ? "price_missing" : "change_failed",
      ),
    );
  }
  revalidatePath(`/${currentLocale}/admin/subscriptions`);
  revalidatePath(`/${currentLocale}/admin/finance`);
  redirect(
    target(currentLocale, "subscriptionStatus", data ? "upgrade_invoice" : "downgrade_scheduled"),
  );
}

export async function processRenewalsAction(
  localeValue: string,
  formData: FormData,
): Promise<never> {
  const currentLocale = locale(localeValue);
  await requireRole("admin", currentLocale);
  const parsed = renewalRunSchema.safeParse({ asOf: formData.get("asOf") });
  if (!parsed.success) redirect(target(currentLocale, "subscriptionError", "invalid_run"));
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("process_subscription_renewals", {
    p_as_of: parsed.data.asOf,
  });
  if (error) redirect(target(currentLocale, "subscriptionError", "renewal_failed"));
  revalidatePath(`/${currentLocale}/admin/subscriptions`);
  revalidatePath(`/${currentLocale}/admin/finance`);
  const result =
    data && typeof data === "object" && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : {};
  const query = new URLSearchParams({
    subscriptionStatus: "renewals_processed",
    alerts: String(Number(result.alerts ?? 0)),
    invoices: String(Number(result.invoices ?? 0)),
  });
  redirect(`/${currentLocale}/admin/subscriptions?${query}` as Route);
}
