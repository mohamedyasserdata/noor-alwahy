import "server-only";

import { connection } from "next/server";

import { createClient } from "@/lib/supabase/server";

export async function getFinanceAdminData() {
  await connection();
  const supabase = await createClient();
  const [invoices, balances, payments, methods] = await Promise.all([
    supabase
      .from("invoices")
      .select(
        "id,invoice_no,student_id,currency,total,status,due_date,issued_at,created_at,students(full_name)",
      )
      .order("created_at", { ascending: false })
      .limit(200),
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
      .select("id,country_code,type,label_ar,label_en")
      .eq("is_active", true)
      .order("sort_order"),
  ]);
  if (invoices.error || balances.error || payments.error || methods.error) {
    throw new Error("finance_management_unavailable");
  }
  return {
    invoices: invoices.data ?? [],
    balances: balances.data ?? [],
    payments: payments.data ?? [],
    methods: methods.data ?? [],
  };
}
