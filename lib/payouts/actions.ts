"use server";

import type { Route } from "next";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { routing, type AppLocale } from "@/i18n/routing";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import {
  generatePayoutsSchema,
  payoutAdjustmentSchema,
  payoutTransitionSchema,
  teacherRateSchema,
} from "@/lib/validators/payouts";

function locale(value: string): AppLocale {
  return routing.locales.includes(value as AppLocale)
    ? (value as AppLocale)
    : routing.defaultLocale;
}
function go(value: AppLocale, key: string, code: string): never {
  redirect(`/${value}/admin/finance?${new URLSearchParams({ [key]: code })}` as Route);
}
function refresh(value: AppLocale) {
  revalidatePath(`/${value}/admin/finance`);
  revalidatePath(`/${value}/teacher/earnings`);
}

export async function saveTeacherRateAction(
  localeValue: string,
  formData: FormData,
): Promise<never> {
  const currentLocale = locale(localeValue);
  const { user } = await requireRole("admin", currentLocale);
  const parsed = teacherRateSchema.safeParse({
    teacherId: formData.get("teacherId"),
    trackId: formData.get("trackId") ?? "",
    durationMin: formData.get("durationMin") || "",
    amount: formData.get("amount"),
    currency: formData.get("currency"),
    validFrom: formData.get("validFrom"),
  });
  if (!parsed.success) go(currentLocale, "financeError", "invalid_rate");
  const supabase = await createClient();
  const { error } = await supabase.from("teacher_rates").insert({
    teacher_id: parsed.data.teacherId,
    track_id: parsed.data.trackId || null,
    duration_min: parsed.data.durationMin === "" ? null : parsed.data.durationMin,
    rate_per_session: parsed.data.amount,
    currency: parsed.data.currency,
    valid_from: parsed.data.validFrom,
    created_by: user.id,
  });
  if (error) go(currentLocale, "financeError", "rate_failed");
  refresh(currentLocale);
  go(currentLocale, "financeStatus", "rate_saved");
}

export async function generatePayoutsAction(
  localeValue: string,
  formData: FormData,
): Promise<never> {
  const currentLocale = locale(localeValue);
  await requireRole("admin", currentLocale);
  const parsed = generatePayoutsSchema.safeParse({
    periodStart: formData.get("periodStart"),
    periodEnd: formData.get("periodEnd"),
  });
  if (!parsed.success) go(currentLocale, "financeError", "invalid_payout_period");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("generate_teacher_payouts", {
    p_period_start: parsed.data.periodStart,
    p_period_end: parsed.data.periodEnd,
  });
  if (error) go(currentLocale, "financeError", "payout_generation_failed");
  refresh(currentLocale);
  go(currentLocale, "financeStatus", Number(data) ? "payouts_generated" : "payouts_unchanged");
}

export async function addPayoutAdjustmentAction(
  localeValue: string,
  formData: FormData,
): Promise<never> {
  const currentLocale = locale(localeValue);
  await requireRole("admin", currentLocale);
  const parsed = payoutAdjustmentSchema.safeParse({
    payoutId: formData.get("payoutId"),
    kind: formData.get("kind"),
    amount: formData.get("amount"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) go(currentLocale, "financeError", "invalid_adjustment");
  const supabase = await createClient();
  const { error } = await supabase.rpc("add_teacher_adjustment", {
    p_payout: parsed.data.payoutId,
    p_kind: parsed.data.kind,
    p_amount: parsed.data.amount,
    p_reason: parsed.data.reason,
  });
  if (error) go(currentLocale, "financeError", "adjustment_failed");
  refresh(currentLocale);
  go(currentLocale, "financeStatus", "adjustment_saved");
}

export async function transitionPayoutAction(
  localeValue: string,
  formData: FormData,
): Promise<never> {
  const currentLocale = locale(localeValue);
  await requireRole("admin", currentLocale);
  const parsed = payoutTransitionSchema.safeParse({
    payoutId: formData.get("payoutId"),
    action: formData.get("action"),
    reference: formData.get("reference") ?? "",
  });
  if (!parsed.success) go(currentLocale, "financeError", "invalid_payout_transition");
  const supabase = await createClient();
  const { error } = await supabase.rpc("transition_teacher_payout", {
    p_payout: parsed.data.payoutId,
    p_action: parsed.data.action,
    p_reference: parsed.data.reference || undefined,
  });
  if (error) go(currentLocale, "financeError", "payout_transition_failed");
  refresh(currentLocale);
  go(
    currentLocale,
    "financeStatus",
    parsed.data.action === "pay" ? "payout_paid" : "payout_approved",
  );
}
