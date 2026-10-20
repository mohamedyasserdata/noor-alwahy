import "server-only";

import { createHash } from "node:crypto";

import { DateTime } from "luxon";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

import { createICalendar, type CalendarFeedRow } from "./ical";

const rawTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);

export async function getAuthenticatedCalendar() {
  const result = await getAuthenticatedCalendarData();
  if (result.kind !== "ok") return result;

  return {
    kind: "ok" as const,
    calendar: createICalendar(result.document),
  };
}

export async function getAuthenticatedCalendarData() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { kind: "unauthorized" as const };

  const { data, error } = await supabase.rpc("get_my_calendar_feed");
  if (error) throw new Error("calendar_feed_unavailable");
  return calendarDataResult(data as CalendarFeedRow[]);
}

export async function getSubscriptionCalendar(rawToken: string) {
  const parsed = rawTokenSchema.safeParse(rawToken);
  if (!parsed.success) return { kind: "not_found" as const };

  const tokenHash = createHash("sha256").update(parsed.data, "utf8").digest("hex");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_calendar_feed", {
    p_token_hash: tokenHash,
  });
  if (error) throw new Error("calendar_feed_unavailable");
  return calendarResult(data as CalendarFeedRow[]);
}

export function calendarResponse(
  calendar: string,
  disposition: "attachment" | "inline" = "inline",
) {
  return new Response(calendar, {
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      "Content-Disposition": `${disposition}; filename="noor-alwahy-calendar.ics"`,
      "Content-Type": "text/calendar; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function calendarResult(rows: CalendarFeedRow[]) {
  const result = calendarDataResult(rows);
  if (result.kind !== "ok") return result;

  return {
    kind: "ok" as const,
    calendar: createICalendar(result.document),
  };
}

function calendarDataResult(rows: CalendarFeedRow[]) {
  const metadata = rows[0];
  if (!metadata) return { kind: "not_found" as const };

  const ownerLocale: "ar" | "en" = metadata.owner_locale === "en" ? "en" : "ar";
  const generatedAt = DateTime.utc().toISO();
  if (!generatedAt) throw new Error("calendar_time_unavailable");

  return {
    kind: "ok" as const,
    document: {
      ownerName: metadata.owner_name,
      ownerTimezone: metadata.owner_timezone,
      ownerLocale,
      rows,
      generatedAt,
    },
  };
}
