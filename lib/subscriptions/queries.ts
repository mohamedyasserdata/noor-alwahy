import "server-only";

import { connection } from "next/server";

import { createClient } from "@/lib/supabase/server";

export async function getSubscriptionAdminData(studentId?: string) {
  await connection();
  const supabase = await createClient();
  let subscriptionsQuery = supabase
    .from("subscriptions")
    .select(
      "id,student_id,package_id,scheduled_package_id,source_application_id,status,start_date,current_period_start,current_period_end,renew_date,paused_until,pause_reason,price_amount,price_currency,price_country,sessions_per_period,package_snapshot,created_at,students(full_name),packages:packages!subscriptions_package_id_fkey(name_ar,name_en)",
    )
    .order("created_at", { ascending: false })
    .limit(200);
  if (studentId) subscriptionsQuery = subscriptionsQuery.eq("student_id", studentId);
  const [subscriptions, students, packages, countries] = await Promise.all([
    subscriptionsQuery,
    supabase
      .from("students")
      .select("id,full_name,country_code")
      .eq("status", "active")
      .order("full_name"),
    supabase
      .from("packages")
      .select("id,name_ar,name_en,billing_period,sessions_per_week")
      .eq("is_active", true)
      .eq("is_published", true)
      .order("sort_order"),
    supabase
      .from("countries")
      .select("code,name_ar,name_en,currency")
      .eq("is_enabled", true)
      .order("code"),
  ]);
  if (subscriptions.error || students.error || packages.error || countries.error) {
    throw new Error("subscription_management_unavailable");
  }
  return {
    subscriptions: subscriptions.data ?? [],
    students: students.data ?? [],
    packages: packages.data ?? [],
    countries: countries.data ?? [],
  };
}
