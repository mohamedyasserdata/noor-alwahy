import "server-only";

import { connection } from "next/server";

import { createClient } from "@/lib/supabase/server";

export type AdminSavedViewPage = "students" | "control-center" | "reports";

export async function getAdminSavedViews(pageKey: AdminSavedViewPage) {
  await connection();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("admin_saved_views")
    .select("id,name,query_params,updated_at")
    .eq("page_key", pageKey)
    .order("updated_at", { ascending: false });
  if (error) throw new Error("admin_saved_views_unavailable");
  return data ?? [];
}
