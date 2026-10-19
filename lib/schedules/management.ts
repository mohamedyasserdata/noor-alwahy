import "server-only";

import { connection } from "next/server";

import { convertNextOccurrence } from "@/lib/schedules/conversion";
import { createClient } from "@/lib/supabase/server";

export async function getScheduleWorkspace() {
  await connection();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("schedule_auth_required");
  const [profileResult, scheduleResult, assignmentsResult] = await Promise.all([
    supabase.from("profiles").select("timezone,role").eq("id", user.id).single(),
    supabase.rpc("get_visible_schedule"),
    supabase
      .from("teacher_assignments")
      .select(
        "id,student:students(full_name,timezone),teacher:teachers(profile:profiles(full_name)),track:tracks(name_ar,name_en)",
      )
      .eq("status", "active")
      .order("created_at", { ascending: false }),
  ]);
  if (profileResult.error || scheduleResult.error) throw new Error("schedule_unavailable");
  const timezone = profileResult.data.timezone;
  return {
    timezone,
    role: profileResult.data.role,
    slots: (scheduleResult.data ?? []).map((slot) => ({
      ...slot,
      viewer: convertNextOccurrence({
        weekday: slot.weekday,
        time: slot.local_start_time,
        anchorTimezone: slot.anchor_timezone,
        viewerTimezone: timezone,
      }),
    })),
    assignments:
      profileResult.data.role === "admin" && !assignmentsResult.error
        ? (assignmentsResult.data ?? [])
        : [],
  };
}

export function relation<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}
