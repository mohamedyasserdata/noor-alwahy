import { DateTime } from "luxon";

export type CalendarFeedRow = {
  owner_name: string;
  owner_timezone: string;
  owner_locale: string;
  session_id: string | null;
  scheduled_at: string | null;
  ends_at: string | null;
  status: string | null;
  student_name: string | null;
  teacher_name: string | null;
  track_name_ar: string | null;
  track_name_en: string | null;
};

type CalendarDocument = {
  ownerName: string;
  ownerTimezone: string;
  ownerLocale: "ar" | "en";
  rows: CalendarFeedRow[];
  generatedAt: string;
};

const productId = "-//Noor Al-Wahy Academy//Calendar//EN";

export function createICalendar({
  ownerName,
  ownerTimezone,
  ownerLocale,
  rows,
  generatedAt,
}: CalendarDocument) {
  const calendarName = ownerLocale === "ar" ? `جدول ${ownerName}` : `${ownerName}'s schedule`;
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:${productId}`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeICalText(calendarName)}`,
    `X-WR-TIMEZONE:${escapeICalText(ownerTimezone)}`,
  ];

  for (const row of rows) {
    if (!isCalendarEvent(row)) continue;

    const trackName =
      ownerLocale === "ar"
        ? (row.track_name_ar ?? row.track_name_en ?? "حصة")
        : (row.track_name_en ?? row.track_name_ar ?? "Session");
    const summary = `${trackName} — ${row.student_name}`;
    const description =
      ownerLocale === "ar"
        ? `الطالب: ${row.student_name}\nالمعلم: ${row.teacher_name}`
        : `Student: ${row.student_name}\nTeacher: ${row.teacher_name}`;

    lines.push(
      "BEGIN:VEVENT",
      `UID:${escapeICalText(`${row.session_id}@noor-alwahy`)}`,
      `DTSTAMP:${formatICalUtc(generatedAt)}`,
      `DTSTART:${formatICalUtc(row.scheduled_at)}`,
      `DTEND:${formatICalUtc(row.ends_at)}`,
      `SUMMARY:${escapeICalText(summary)}`,
      `DESCRIPTION:${escapeICalText(description)}`,
      "STATUS:CONFIRMED",
      "END:VEVENT",
    );
  }

  lines.push("END:VCALENDAR");
  return `${lines.map(foldICalLine).join("\r\n")}\r\n`;
}

export function escapeICalText(value: string) {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll(/\r\n|\r|\n/g, "\\n")
    .replaceAll(",", "\\,")
    .replaceAll(";", "\\;");
}

export function foldICalLine(line: string) {
  const parts: string[] = [];
  let current = "";
  let byteLimit = 75;

  for (const character of line) {
    if (Buffer.byteLength(current + character, "utf8") > byteLimit) {
      parts.push(current);
      current = character;
      byteLimit = 74;
    } else {
      current += character;
    }
  }

  parts.push(current);
  return parts.join("\r\n ");
}

function formatICalUtc(value: string) {
  const parsed = DateTime.fromISO(value, { setZone: true });
  if (!parsed.isValid) throw new Error("invalid_calendar_timestamp");
  return parsed.toUTC().toFormat("yyyyMMdd'T'HHmmss'Z'");
}

function isCalendarEvent(row: CalendarFeedRow): row is CalendarFeedRow & {
  session_id: string;
  scheduled_at: string;
  ends_at: string;
  student_name: string;
  teacher_name: string;
} {
  return Boolean(
    row.session_id && row.scheduled_at && row.ends_at && row.student_name && row.teacher_name,
  );
}
