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

export async function getManagedAccountSetupOptions() {
  await connection();
  const supabase = await createClient();
  const [packages, countries, tracks, students] = await Promise.all([
    supabase
      .from("packages")
      .select("id,name_ar,name_en")
      .eq("is_active", true)
      .eq("is_published", true)
      .order("sort_order"),
    supabase
      .from("countries")
      .select("code,name_ar,name_en,currency")
      .eq("is_enabled", true)
      .order("code"),
    supabase
      .from("tracks")
      .select("id,name_ar,name_en")
      .eq("is_active", true)
      .order("sort_order")
      .limit(1),
    supabase
      .from("students")
      .select("id,full_name,student_no,status")
      .neq("status", "archived")
      .order("full_name"),
  ]);
  if (packages.error || countries.error || tracks.error || students.error)
    throw new Error("managed_account_options_unavailable");
  return {
    packages: packages.data ?? [],
    countries: countries.data ?? [],
    track: tracks.data?.[0] ?? null,
    students: students.data ?? [],
  };
}
