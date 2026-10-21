import "server-only";

import { connection } from "next/server";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

const audienceSchema = z.object({
  all: z.boolean().optional(),
  roles: z.array(z.enum(["admin", "teacher", "student", "parent"])).optional(),
  countries: z.array(z.string()).optional(),
  level_ids: z.array(z.string()).optional(),
  track_ids: z.array(z.string()).optional(),
});

export async function getAnnouncementAdminData() {
  await connection();
  const supabase = await createClient();
  const [announcementResult, countryResult, levelResult, trackResult] = await Promise.all([
    supabase
      .from("announcements")
      .select(
        "id,title_ar,title_en,body_ar,body_en,audience,starts_at,ends_at,status,published_at,created_at,announcement_deliveries(count)",
      )
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("countries")
      .select("code,name_ar,name_en")
      .eq("is_enabled", true)
      .order("name_ar"),
    supabase.from("levels").select("id,name_ar,name_en").eq("is_active", true).order("sort_order"),
    supabase.from("tracks").select("id,name_ar,name_en").eq("is_active", true).order("sort_order"),
  ]);
  if (announcementResult.error || countryResult.error || levelResult.error || trackResult.error) {
    throw new Error("announcements_unavailable");
  }
  return {
    announcements: (announcementResult.data ?? []).map((row) => ({
      id: row.id,
      titleAr: row.title_ar,
      titleEn: row.title_en,
      bodyAr: row.body_ar,
      bodyEn: row.body_en,
      audience: audienceSchema.parse(row.audience),
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      status: row.status,
      publishedAt: row.published_at,
      createdAt: row.created_at,
      deliveryCount: row.announcement_deliveries[0]?.count ?? 0,
    })),
    countries: countryResult.data ?? [],
    levels: levelResult.data ?? [],
    tracks: trackResult.data ?? [],
  };
}

export type AnnouncementAdminData = Awaited<ReturnType<typeof getAnnouncementAdminData>>;
