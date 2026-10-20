import "server-only";

import { DateTime } from "luxon";
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
  const [profileResult, scheduleResult] = await Promise.all([
    supabase.from("profiles").select("timezone,role").eq("id", user.id).single(),
    supabase.rpc("get_visible_schedule"),
  ]);
  if (profileResult.error || scheduleResult.error) throw new Error("schedule_unavailable");
  const timezone = profileResult.data.timezone;
  const adminData =
    profileResult.data.role === "admin" ? await getAdminScheduleData(supabase) : null;
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
    assignments: adminData?.assignments ?? [],
    adjustments: adminData
      ? {
          sessions: adminData.sessions,
          teachers: adminData.teachers,
          entitlements: adminData.entitlements,
        }
      : null,
  };
}

async function getAdminScheduleData(supabase: Awaited<ReturnType<typeof createClient>>) {
  const now = DateTime.utc().toISO();
  const [assignmentsResult, sessionsResult, teachersResult, entitlementsResult] = await Promise.all(
    [
      supabase
        .from("teacher_assignments")
        .select(
          "id,student:students(full_name,timezone),teacher:teachers(profile:profiles(full_name)),track:tracks(name_ar,name_en)",
        )
        .eq("status", "active")
        .order("created_at", { ascending: false }),
      supabase
        .from("sessions")
        .select(
          "id,scheduled_at,duration_min,kind,student:students(full_name,gender),teacher:teachers!sessions_teacher_id_fkey(id,gender,profile:profiles(full_name)),assignment:teacher_assignments(track_id)",
        )
        .eq("status", "scheduled")
        .gte("scheduled_at", now)
        .order("scheduled_at")
        .limit(30),
      supabase
        .from("teachers")
        .select("id,gender,profile:profiles(full_name),teacher_tracks(track_id)")
        .eq("status", "active")
        .order("created_at", { ascending: false }),
      supabase
        .from("makeup_entitlements")
        .select(
          "id,expires_at,source_session_id,student:students(full_name,gender),source_session:sessions!makeup_entitlements_source_session_id_fkey(duration_min,assignment_id,teacher_id,original_teacher_id,assignment:teacher_assignments(track_id))",
        )
        .is("used_by_session_id", null)
        .gte("expires_at", now)
        .order("expires_at")
        .limit(30),
    ],
  );

  if (
    assignmentsResult.error ||
    sessionsResult.error ||
    teachersResult.error ||
    entitlementsResult.error
  ) {
    throw new Error("schedule_adjustments_unavailable");
  }

  return {
    assignments: assignmentsResult.data ?? [],
    sessions: sessionsResult.data ?? [],
    teachers: teachersResult.data ?? [],
    entitlements: entitlementsResult.data ?? [],
  };
}

export function relation<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}
