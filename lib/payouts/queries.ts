import "server-only";

import { connection } from "next/server";

import { createClient } from "@/lib/supabase/server";

export async function getPayoutAdminData() {
  await connection();
  const supabase = await createClient();
  const [teachers, tracks, rates, payouts, items, adjustments] = await Promise.all([
    supabase
      .from("teachers")
      .select("id,profile:profiles(full_name)")
      .eq("status", "active")
      .order("created_at"),
    supabase.from("tracks").select("id,name_ar,name_en").eq("is_active", true).order("sort_order"),
    supabase
      .from("teacher_rates")
      .select(
        "id,teacher_id,track_id,duration_min,rate_per_session,currency,valid_from,teacher:teachers(profile:profiles(full_name)),track:tracks(name_ar,name_en)",
      )
      .order("valid_from", { ascending: false })
      .limit(200),
    supabase
      .from("teacher_payouts")
      .select(
        "id,payout_no,teacher_id,period_start,period_end,currency,gross,bonuses,deductions,net,status,approved_at,paid_at,payment_reference,teacher:teachers(profile:profiles(full_name))",
      )
      .order("period_end", { ascending: false })
      .limit(200),
    supabase
      .from("teacher_payout_items")
      .select("id,payout_id,session_id,amount,currency,rate_snapshot,kind")
      .not("payout_id", "is", null)
      .limit(1000),
    supabase
      .from("teacher_adjustments")
      .select("id,payout_id,kind,amount,reason,created_at")
      .order("created_at", { ascending: false })
      .limit(500),
  ]);
  if (
    teachers.error ||
    tracks.error ||
    rates.error ||
    payouts.error ||
    items.error ||
    adjustments.error
  )
    throw new Error("payout_management_unavailable");
  return {
    teachers: teachers.data ?? [],
    tracks: tracks.data ?? [],
    rates: rates.data ?? [],
    payouts: payouts.data ?? [],
    items: items.data ?? [],
    adjustments: adjustments.data ?? [],
  };
}

export async function getMyEarnings() {
  await connection();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("my_earnings")
    .select("*")
    .order("period_end", { ascending: false });
  if (error) throw new Error("earnings_unavailable");
  return data ?? [];
}
