import "server-only";

import { connection } from "next/server";

import { createClient } from "@/lib/supabase/server";

export async function getFinanceAdminData(overdue?: { country: string; currency: string }) {
  await connection();
  const supabase = await createClient();
  let invoiceQuery = supabase
    .from("invoices")
    .select(
      "id,invoice_no,student_id,currency,total,status,due_date,issued_at,created_at,students!inner(full_name,country_code)",
    )
    .order("created_at", { ascending: false })
    .limit(200);
  if (overdue) {
    invoiceQuery = invoiceQuery.eq("status", "overdue");
    if (overdue.country) invoiceQuery = invoiceQuery.eq("students.country_code", overdue.country);
    if (overdue.currency) invoiceQuery = invoiceQuery.eq("currency", overdue.currency);
  }
  const [invoices, balances, payments, methods, countries, expenses, summary] = await Promise.all([
    invoiceQuery,
    supabase.from("invoice_balance").select("invoice_id,total,paid,due"),
    supabase
      .from("payments")
      .select(
        "id,invoice_id,kind,amount,currency,status,payment_method_id,paid_at,proof_note,confirmed_at,receipt_no,created_at",
      )
      .order("created_at", { ascending: false })
      .limit(500),
    supabase
      .from("payment_methods")
      .select(
        "id,country_code,type,label_ar,label_en,details,instructions_ar,instructions_en,is_active,sort_order",
      )
      .order("sort_order"),
    supabase.from("countries").select("code,name_ar,name_en").eq("is_enabled", true).order("code"),
    supabase
      .from("expenses")
      .select(
        "id,expense_no,category,description,amount,currency,incurred_on,payee,reference,status,void_reason,created_at",
      )
      .order("incurred_on", { ascending: false })
      .limit(200),
    supabase.from("financial_currency_summary").select("*").order("currency"),
  ]);
  if (
    invoices.error ||
    balances.error ||
    payments.error ||
    methods.error ||
    countries.error ||
    expenses.error ||
    summary.error
  ) {
    throw new Error("finance_management_unavailable");
  }
  return {
    invoices: invoices.data ?? [],
    balances: balances.data ?? [],
    payments: payments.data ?? [],
    methods: methods.data ?? [],
    countries: countries.data ?? [],
    expenses: expenses.data ?? [],
    summary: summary.data ?? [],
  };
}
