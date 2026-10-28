import "server-only";

import { cacheLife, cacheTag } from "next/cache";

import { createPublicClient } from "@/lib/supabase/public";

export type PublishedTrack = {
  id: string;
  code: string;
  nameAr: string;
  nameEn: string | null;
  descriptionAr: string | null;
  descriptionEn: string | null;
  audience: string | null;
};

export async function getPublishedTracks(): Promise<PublishedTrack[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("public-packages", "public-tracks");

  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("packages")
    .select(
      "track_id,description_ar,description_en,audience,track:tracks!packages_track_id_fkey(id,code,name_ar,name_en,is_active)",
    )
    .not("track_id", "is", null)
    .order("sort_order");

  if (error) throw new Error("public_tracks_unavailable", { cause: error });

  const unique = new Map<string, PublishedTrack>();
  for (const item of data ?? []) {
    const track = Array.isArray(item.track) ? item.track[0] : item.track;
    if (!track?.is_active || unique.has(track.id)) continue;
    unique.set(track.id, {
      id: track.id,
      code: track.code,
      nameAr: track.name_ar,
      nameEn: track.name_en,
      descriptionAr: item.description_ar,
      descriptionEn: item.description_en,
      audience: item.audience,
    });
  }
  return [...unique.values()];
}
