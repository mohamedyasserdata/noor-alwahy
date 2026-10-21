"use server";

import type { Route } from "next";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { routing, type AppLocale } from "@/i18n/routing";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { createSubscriptionSchema } from "@/lib/validators/subscriptions";

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
