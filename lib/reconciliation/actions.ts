"use server";

import type { Route } from "next";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { routing, type AppLocale } from "@/i18n/routing";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";

export async function runReconciliationAction(localeValue: string): Promise<never> {
  const locale = routing.locales.includes(localeValue as AppLocale)
    ? (localeValue as AppLocale)
    : routing.defaultLocale;
  await requireRole("admin", locale);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("run_financial_reconciliation");
  if (error || !data)
    redirect(`/${locale}/admin/finance?financeError=reconciliation_failed` as Route);
  const { data: run } = await supabase
    .from("reconciliation_runs")
    .select("status,issue_count")
    .eq("id", data)
    .single();
  revalidatePath(`/${locale}/admin/finance`);
  const query = new URLSearchParams({
    financeStatus: run?.status === "passed" ? "reconciliation_passed" : "reconciliation_issues",
    issues: String(run?.issue_count ?? 0),
  });
  redirect(`/${locale}/admin/finance?${query}` as Route);
}
