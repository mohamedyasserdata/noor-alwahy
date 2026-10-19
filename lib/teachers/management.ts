import "server-only";

import { connection } from "next/server";

import { createClient } from "@/lib/supabase/server";

export async function getTeacherManagement() {
  await connection();
  const supabase = await createClient();
  const [profilesResult, teachersResult, tracksResult, availabilityResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("id,full_name,timezone,is_active")
      .eq("role", "teacher")
      .order("full_name"),
    supabase
      .from("teachers")
      .select("*,profile:profiles(full_name,timezone,is_active),teacher_tracks(track_id)")
      .order("created_at"),
    supabase
      .from("tracks")
      .select("id,code,name_ar,name_en")
      .eq("is_active", true)
      .order("sort_order"),
    supabase
      .from("teacher_availability")
      .select(
        "id,teacher_id,weekday,start_time,end_time,status,teacher:teachers(profile:profiles(full_name,timezone))",
      )
      .order("weekday")
      .order("start_time"),
  ]);
  if (
    profilesResult.error ||
    teachersResult.error ||
    tracksResult.error ||
    availabilityResult.error
  )
    throw new Error("teacher_management_unavailable");
  return {
    profiles: profilesResult.data ?? [],
    teachers: teachersResult.data ?? [],
    tracks: tracksResult.data ?? [],
    availability: availabilityResult.data ?? [],
  };
}

export async function getOwnTeacherAvailability() {
  await connection();
  const supabase = await createClient();
  const { data: teacher, error } = await supabase
    .from("teachers")
    .select(
      "id,status,identity_verified_at,code_of_conduct_accepted_at,profile:profiles(full_name,timezone),teacher_availability(id,weekday,start_time,end_time,status)",
    )
    .maybeSingle();
  if (error) throw new Error("teacher_availability_unavailable");
  return teacher;
}
