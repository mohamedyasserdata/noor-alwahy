"use server";

import type { Route } from "next";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { DateTime } from "luxon";

import { routing, type AppLocale } from "@/i18n/routing";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { paymentDecisionSchema, recordPaymentSchema } from "@/lib/validators/billing";

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
  revalidatePath(`/${value}/admin/subscriptions`);
  revalidatePath(`/${value}/parent/billing`);
}

export async function recordPaymentAction(localeValue: string, formData: FormData): Promise<never> {
  const currentLocale = locale(localeValue);
  const { user } = await requireRole("admin", currentLocale);
  const parsed = recordPaymentSchema.safeParse({
    invoiceId: formData.get("invoiceId"),
    kind: formData.get("kind"),
    amount: formData.get("amount"),
    currency: formData.get("currency"),
    paymentMethodId: formData.get("paymentMethodId") ?? "",
    proofNote: formData.get("proofNote") ?? "",
  });
  if (!parsed.success) go(currentLocale, "financeError", "invalid_payment");
  const paidAt = DateTime.utc().toISO();
  if (!paidAt) go(currentLocale, "financeError", "invalid_payment");
  const supabase = await createClient();
  const { error } = await supabase.from("payments").insert({
    invoice_id: parsed.data.invoiceId,
    kind: parsed.data.kind,
    amount: Number(parsed.data.amount),
    currency: parsed.data.currency,
    payment_method_id: parsed.data.paymentMethodId || null,
    paid_at: paidAt,
    proof_note: parsed.data.proofNote || null,
    recorded_by: user.id,
  });
  if (error) {
    const code = error.message.includes("currency_mismatch")
      ? "currency_mismatch"
      : error.message.includes("not_payable")
        ? "invoice_not_payable"
        : "record_failed";
    go(currentLocale, "financeError", code);
  }
  refresh(currentLocale);
  go(
    currentLocale,
    "financeStatus",
    parsed.data.kind === "refund" ? "refund_recorded" : "payment_recorded",
  );
}

export async function decidePaymentAction(localeValue: string, formData: FormData): Promise<never> {
  const currentLocale = locale(localeValue);
  await requireRole("admin", currentLocale);
  const parsed = paymentDecisionSchema.safeParse({
    paymentId: formData.get("paymentId"),
    decision: formData.get("decision"),
  });
  if (!parsed.success) go(currentLocale, "financeError", "invalid_decision");
  const supabase = await createClient();
  const { error } = await supabase
    .from("payments")
    .update({ status: parsed.data.decision })
    .eq("id", parsed.data.paymentId)
    .eq("status", "pending_confirmation");
  if (error) {
    const code = error.message.includes("refund_exceeds_paid")
      ? "refund_exceeds_paid"
      : error.message.includes("admin_mfa_required")
        ? "mfa_required"
        : "decision_failed";
    go(currentLocale, "financeError", code);
  }
  refresh(currentLocale);
  go(currentLocale, "financeStatus", parsed.data.decision);
}
