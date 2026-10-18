import "server-only";

import { connection } from "next/server";

import { createClient } from "@/lib/supabase/server";

export type ManagedUser = {
  createdAt: string;
  displayName: string | null;
  email: string | null;
  fullName: string;
  id: string;
  isActive: boolean;
  role: "admin" | "teacher" | "student" | "parent";
};

export async function getManagedUsers(): Promise<ManagedUser[]> {
  await connection();
  const supabase = await createClient();
  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, role, full_name, display_name, is_active, created_at")
    .order("created_at", { ascending: false });

  if (error || !profiles) {
    return [];
  }

  const ids = profiles.map(({ id }) => id);
  const { data: privateProfiles } = ids.length
    ? await supabase
        .from("profile_private")
        .select("profile_id, contact_email")
        .in("profile_id", ids)
    : { data: [] };
  const emails = new Map(
    (privateProfiles ?? []).map(({ contact_email, profile_id }) => [profile_id, contact_email]),
  );

  return profiles.map((profile) => ({
    createdAt: profile.created_at,
    displayName: profile.display_name,
    email: emails.get(profile.id) ?? null,
    fullName: profile.full_name,
    id: profile.id,
    isActive: profile.is_active,
    role: profile.role,
  }));
}
