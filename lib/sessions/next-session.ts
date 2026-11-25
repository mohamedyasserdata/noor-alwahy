import "server-only";

import { DateTime } from "luxon";
import { connection } from "next/server";

import type { AppLocale } from "@/i18n/routing";
import { convertNextOccurrence } from "@/lib/schedules/conversion";
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
  const [profileResult, sessionResult, scheduleResult] = await Promise.all([
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
    supabase.rpc("get_visible_schedule"),
  ]);

  if (profileResult.error || sessionResult.error || scheduleResult.error) {
    throw new Error("next_session_unavailable");
  }
  const session = sessionResult.data;
  if (!session) {
    const viewerTimezone = "Africa/Cairo";
    const nextSlot = (scheduleResult.data ?? [])
      .map((slot) => {
        const occurrence = convertNextOccurrence({
          weekday: slot.weekday,
          time: slot.local_start_time,
          anchorTimezone: slot.anchor_timezone,
          viewerTimezone,
        });
        if (!occurrence) return null;
        let start = DateTime.fromISO(occurrence.isoLocal, { setZone: true });
        if (start.plus({ minutes: slot.duration_min }).toUTC() < now.minus({ minutes: 15 })) {
          start = start.plus({ days: 7 });
        }
        return { slot, start };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
      .sort((left, right) => left.start.toMillis() - right.start.toMillis())[0];

    if (!nextSlot) return { serverNowMs: now.toMillis(), session: null };
    const end = nextSlot.start.plus({ minutes: nextSlot.slot.duration_min });
    return {
      serverNowMs: now.toMillis(),
      session: {
        id: nextSlot.slot.slot_id,
        scheduledAtMs: nextSlot.start.toMillis(),
        endsAtMs: end.toMillis(),
        dateLabel: nextSlot.start.setLocale(locale).toLocaleString({
          weekday: "long",
          day: "numeric",
          month: "long",
        }),
        timeLabel: `${nextSlot.start.toFormat("HH:mm")}–${end.toFormat("HH:mm")}`,
        timezone: viewerTimezone,
        studentName: nextSlot.slot.student_name,
        teacherName: nextSlot.slot.teacher_name,
        joinUrl: null,
        meetingId: null,
        passcode: null,
      },
    };
  }

  const { data: joinRows, error: joinError } = await supabase.rpc("get_session_join", {
    p_session_id: session.id,
  });
  if (joinError) throw new Error("session_join_unavailable");

  const start = DateTime.fromISO(session.scheduled_at, { setZone: true }).setZone("Africa/Cairo");
  const end = DateTime.fromISO(session.ends_at, { setZone: true }).setZone("Africa/Cairo");
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
      timezone: "Africa/Cairo",
      studentName: student?.full_name ?? null,
      teacherName: teacherProfile?.full_name ?? null,
      joinUrl: join?.join_url ?? null,
      meetingId: join?.meeting_id ?? null,
      passcode: join?.passcode ?? null,
    },
  };
}
