import "server-only";

import { connection } from "next/server";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

const filtersSchema = z.object({
  status: z
    .enum(["all", "new", "contacted", "trial_booked", "accepted", "rejected", "postponed"])
    .default("all"),
  q: z.string().trim().max(120).default(""),
});

export async function getApplicationCrm(query: Record<string, string | string[] | undefined>) {
  await connection();
  const filters = filtersSchema.parse({
    status: typeof query.status === "string" ? query.status : undefined,
    q: typeof query.q === "string" ? query.q : undefined,
  });
  const supabase = await createClient();
  let request = supabase
    .from("applications")
    .select(
      "id,order_no,status,student_name,student_gender,student_age,guardian_name,contact_email,contact_phone,country_code,timezone,track_id,package_id,self_level,preferred_times,preferred_teacher_gender,notes,source,internal_notes,converted_student_id,created_at,updated_at",
    )
    .order("created_at", { ascending: false })
    .limit(100);
  if (filters.status !== "all") request = request.eq("status", filters.status);
  if (filters.q)
    request = request.or(
      `student_name.ilike.%${escapeFilter(filters.q)}%,order_no.ilike.%${escapeFilter(filters.q)}%,contact_email.ilike.%${escapeFilter(filters.q)}%`,
    );
  const [applications, tracks, packages, placements] = await Promise.all([
    request,
    supabase.from("tracks").select("id,name_ar,name_en").eq("is_active", true).order("sort_order"),
    supabase
      .from("packages")
      .select("id,name_ar,name_en")
      .eq("is_active", true)
      .order("sort_order"),
    supabase
      .from("placement_tests")
      .select(
        "id,application_id,recitation_score,tajweed_score,memorization_score,recommended_track_id,recommended_package_id,notes,created_at",
      )
      .order("created_at", { ascending: false }),
  ]);
  if (applications.error || tracks.error || packages.error || placements.error)
    throw new Error("application_crm_unavailable");
  return {
    filters,
    applications: applications.data ?? [],
    tracks: tracks.data ?? [],
    packages: packages.data ?? [],
    placements: placements.data ?? [],
  };
}
function escapeFilter(value: string) {
  return value.replace(/[,%()]/g, "");
}
