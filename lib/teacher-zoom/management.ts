import "server-only";

import { connection } from "next/server";

import { createClient } from "@/lib/supabase/server";

export async function getOwnZoomSetting() {
  await connection();
  const supabase = await createClient();
  const { data: teacher, error } = await supabase
    .from("teachers")
    .select("id,teacher_zoom_settings(join_url,updated_at)")
    .maybeSingle();
  if (error) throw new Error("zoom_setting_unavailable");
  return teacher;
}
