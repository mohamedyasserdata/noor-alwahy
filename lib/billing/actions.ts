"use server";

import type { Route } from "next";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { DateTime } from "luxon";

import { routing, type AppLocale } from "@/i18n/routing";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import {
  paymentDecisionSchema,
  paymentMethodSchema,
  paymentMethodToggleSchema,
  recordPaymentSchema,
  expenseSchema,
  voidExpenseSchema,
} from "@/lib/validators/billing";

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

export async function savePaymentMethodAction(
  localeValue: string,
  formData: FormData,
): Promise<never> {
  const currentLocale = locale(localeValue);
  const { user } = await requireRole("admin", currentLocale);
  const parsed = paymentMethodSchema.safeParse({
    id: formData.get("id") ?? "",
    countryCode: formData.get("countryCode"),
    type: formData.get("type"),
    labelAr: formData.get("labelAr"),
    labelEn: formData.get("labelEn") ?? "",
    accountName: formData.get("accountName") ?? "",
    accountNumber: formData.get("accountNumber") ?? "",
    iban: formData.get("iban") ?? "",
    phone: formData.get("phone") ?? "",
    branch: formData.get("branch") ?? "",
    referenceHint: formData.get("referenceHint") ?? "",
    instructionsAr: formData.get("instructionsAr") ?? "",
    instructionsEn: formData.get("instructionsEn") ?? "",
    sortOrder: formData.get("sortOrder"),
  });
  if (!parsed.success) go(currentLocale, "financeError", "invalid_method");
  const details = Object.fromEntries(
    Object.entries({
      account_name: parsed.data.accountName,
      account_number: parsed.data.accountNumber,
      iban: parsed.data.iban,
      phone: parsed.data.phone,
      branch: parsed.data.branch,
      reference_hint: parsed.data.referenceHint,
    }).filter(([, value]) => value),
  );
  const supabase = await createClient();
  const payload = {
    country_code: parsed.data.countryCode,
    type: parsed.data.type,
    label_ar: parsed.data.labelAr,
    label_en: parsed.data.labelEn || null,
    details,
    instructions_ar: parsed.data.instructionsAr || null,
    instructions_en: parsed.data.instructionsEn || null,
    sort_order: parsed.data.sortOrder,
    created_by: user.id,
  };
  const result = parsed.data.id
    ? await supabase.from("payment_methods").update(payload).eq("id", parsed.data.id)
    : await supabase.from("payment_methods").insert(payload);
  if (result.error) go(currentLocale, "financeError", "method_save_failed");
  refresh(currentLocale);
  go(currentLocale, "financeStatus", "method_saved");
}

export async function togglePaymentMethodAction(
  localeValue: string,
  formData: FormData,
): Promise<never> {
  const currentLocale = locale(localeValue);
  await requireRole("admin", currentLocale);
  const parsed = paymentMethodToggleSchema.safeParse({
    id: formData.get("id"),
    isActive: formData.get("isActive"),
  });
  if (!parsed.success) go(currentLocale, "financeError", "invalid_method");
  const supabase = await createClient();
  const { error } = await supabase
    .from("payment_methods")
    .update({ is_active: parsed.data.isActive === "true" })
    .eq("id", parsed.data.id);
  if (error) go(currentLocale, "financeError", "method_save_failed");
  refresh(currentLocale);
  go(currentLocale, "financeStatus", "method_saved");
}

export async function createExpenseAction(localeValue: string, formData: FormData): Promise<never> {
  const currentLocale = locale(localeValue);
  const { user } = await requireRole("admin", currentLocale);
  const parsed = expenseSchema.safeParse({
    category: formData.get("category"),
    description: formData.get("description"),
    amount: formData.get("amount"),
    currency: formData.get("currency"),
    incurredOn: formData.get("incurredOn"),
    payee: formData.get("payee") ?? "",
    reference: formData.get("reference") ?? "",
  });
  if (!parsed.success) go(currentLocale, "financeError", "invalid_expense");
  const supabase = await createClient();
  const { error } = await supabase.from("expenses").insert({
    category: parsed.data.category,
    description: parsed.data.description,
    amount: Number(parsed.data.amount),
    currency: parsed.data.currency,
    incurred_on: parsed.data.incurredOn,
    payee: parsed.data.payee || null,
    reference: parsed.data.reference || null,
    created_by: user.id,
  });
  if (error) go(currentLocale, "financeError", "expense_failed");
  refresh(currentLocale);
  go(currentLocale, "financeStatus", "expense_recorded");
}

export async function voidExpenseAction(localeValue: string, formData: FormData): Promise<never> {
  const currentLocale = locale(localeValue);
  await requireRole("admin", currentLocale);
  const parsed = voidExpenseSchema.safeParse({
    expenseId: formData.get("expenseId"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) go(currentLocale, "financeError", "invalid_void");
  const supabase = await createClient();
  const { error } = await supabase
    .from("expenses")
    .update({ status: "void", void_reason: parsed.data.reason })
    .eq("id", parsed.data.expenseId)
    .eq("status", "recorded");
  if (error) go(currentLocale, "financeError", "void_failed");
  refresh(currentLocale);
  go(currentLocale, "financeStatus", "expense_voided");
}
