import "server-only";

import { connection } from "next/server";

import { createClient } from "@/lib/supabase/server";

export async function getFamilyBillingData() {
  await connection();
  const supabase = await createClient();
  const invoices = await supabase
    .from("invoices")
    .select(
      "id,invoice_no,student_id,subscription_id,currency,subtotal,discount_total,total,status,due_date,issued_at,locale,created_at,students(full_name,country_code),subscriptions(price_country,package_snapshot)",
    )
    .order("created_at", { ascending: false })
    .limit(100);
  if (invoices.error) throw new Error("family_billing_unavailable");
  const ids = (invoices.data ?? []).map((item) => item.id);
  const studentIds = [...new Set((invoices.data ?? []).map((item) => item.student_id))];
  const [items, balances, payments, methods, statement] = await Promise.all([
    ids.length
      ? supabase
          .from("invoice_items")
          .select("id,invoice_id,kind,description_ar,description_en,quantity,unit_amount,amount")
          .in("invoice_id", ids)
      : Promise.resolve({ data: [], error: null }),
    ids.length
      ? supabase.from("invoice_balance").select("invoice_id,total,paid,due").in("invoice_id", ids)
      : Promise.resolve({ data: [], error: null }),
    ids.length
      ? supabase
          .from("payments")
          .select("id,invoice_id,kind,amount,currency,status,receipt_no,confirmed_at")
          .in("invoice_id", ids)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from("payment_methods")
      .select(
        "id,country_code,type,label_ar,label_en,details,instructions_ar,instructions_en,sort_order",
      )
      .eq("is_active", true)
      .order("sort_order"),
    studentIds.length
      ? supabase
          .from("student_account_statement")
          .select("student_id,currency,entry_at,entry_type,reference,debit,credit,running_balance")
          .in("student_id", studentIds)
          .order("entry_at", { ascending: false })
          .limit(300)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (items.error || balances.error || payments.error || methods.error || statement.error)
    throw new Error("family_billing_unavailable");
  return {
    invoices: invoices.data ?? [],
    items: items.data ?? [],
    balances: balances.data ?? [],
    payments: payments.data ?? [],
    methods: methods.data ?? [],
    statement: statement.data ?? [],
  };
}
