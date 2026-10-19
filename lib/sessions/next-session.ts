import "server-only";

import { DateTime } from "luxon";
import { connection } from "next/server";

import type { AppLocale } from "@/i18n/routing";
import { createClient } from "@/lib/supabase/server";

function firstRelation<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export async function getNextSessionCard(locale: AppLocale) {
  await connection();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("session_auth_required");

  const now = DateTime.utc();
  const [profileResult, sessionResult] = await Promise.all([
    supabase.from("profiles").select("timezone").eq("id", user.id).single(),
    supabase
      .from("sessions")
      .select(
        "id,scheduled_at,ends_at,status,student:students!sessions_student_id_fkey(full_name),teacher:teachers!sessions_teacher_id_fkey(profile:profiles!teachers_profile_id_fkey(full_name))",
      )
      .in("status", ["scheduled", "held"])
      .gte("ends_at", now.minus({ minutes: 15 }).toISO())
      .order("scheduled_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);

  if (profileResult.error || sessionResult.error) throw new Error("next_session_unavailable");
  const session = sessionResult.data;
  if (!session) return { serverNowMs: now.toMillis(), session: null };

  const { data: joinRows, error: joinError } = await supabase.rpc("get_session_join", {
    p_session_id: session.id,
  });
  if (joinError) throw new Error("session_join_unavailable");

  const start = DateTime.fromISO(session.scheduled_at, { setZone: true }).setZone(
    profileResult.data.timezone,
  );
  const end = DateTime.fromISO(session.ends_at, { setZone: true }).setZone(
    profileResult.data.timezone,
  );
  const student = firstRelation(session.student);
  const teacher = firstRelation(session.teacher);
  const teacherProfile = teacher ? firstRelation(teacher.profile) : null;
  const join = joinRows?.[0] ?? null;

  return {
    serverNowMs: now.toMillis(),
    session: {
      id: session.id,
      scheduledAtMs: start.toMillis(),
      endsAtMs: end.toMillis(),
      dateLabel: start.setLocale(locale).toLocaleString({
        weekday: "long",
        day: "numeric",
        month: "long",
      }),
      timeLabel: `${start.toFormat("HH:mm")}–${end.toFormat("HH:mm")}`,
      timezone: profileResult.data.timezone,
      studentName: student?.full_name ?? null,
      teacherName: teacherProfile?.full_name ?? null,
      joinUrl: join?.join_url ?? null,
      meetingId: join?.meeting_id ?? null,
      passcode: join?.passcode ?? null,
    },
  };
}
