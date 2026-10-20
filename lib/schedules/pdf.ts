import "server-only";

import { DateTime } from "luxon";

import { createClient } from "@/lib/supabase/server";

import { renderHtmlPdf } from "../pdf/chromium";
import { convertNextOccurrence } from "./conversion";
import { createSchedulePdfHtml, type SchedulePdfRow } from "./pdf-template";

export async function getSchedulePdf(locale: "ar" | "en") {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { kind: "unauthorized" as const };

  const [profileResult, scheduleResult] = await Promise.all([
    supabase.from("profiles").select("full_name,timezone").eq("id", user.id).single(),
    supabase.rpc("get_visible_schedule"),
  ]);
  if (profileResult.error || scheduleResult.error) throw new Error("schedule_pdf_unavailable");

  const profile = profileResult.data;
  const now = DateTime.now().setZone(profile.timezone);
  if (!now.isValid) throw new Error("schedule_pdf_timezone_invalid");
  const rows: SchedulePdfRow[] = (scheduleResult.data ?? []).map((slot) => {
    const viewer = convertNextOccurrence({
      weekday: slot.weekday,
      time: slot.local_start_time,
      anchorTimezone: slot.anchor_timezone,
      viewerTimezone: profile.timezone,
    });
    if (!viewer) throw new Error("schedule_pdf_time_conversion_failed");
    return {
      weekday: viewer.weekday,
      time: viewer.time.slice(0, 5),
      durationMinutes: slot.duration_min,
      studentName: slot.student_name,
      teacherName: slot.teacher_name,
      trackName: locale === "ar" ? slot.track_name_ar : (slot.track_name_en ?? slot.track_name_ar),
    };
  });

  const html = await createSchedulePdfHtml({
    locale,
    ownerName: profile.full_name,
    timezone: profile.timezone,
    generatedAt: now.toFormat("yyyy-LL-dd HH:mm ZZZZ"),
    rows,
  });
  return { kind: "ok" as const, pdf: await renderHtmlPdf(html) };
}
