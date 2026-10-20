import { describe, expect, it } from "vitest";

import {
  createICalendar,
  escapeICalText,
  foldICalLine,
  type CalendarFeedRow,
} from "../../lib/calendar/ical";
import { createScheduleHtml } from "../../lib/calendar/pdf";

const event: CalendarFeedRow = {
  owner_name: "طالب الاختبار",
  owner_timezone: "Africa/Cairo",
  owner_locale: "ar",
  session_id: "e8600000-0000-4000-8000-000000000001",
  scheduled_at: "2026-10-20T18:30:00+03:00",
  ends_at: "2026-10-20T19:00:00+03:00",
  status: "scheduled",
  student_name: "أحمد, علي; الطويل",
  teacher_name: "المعلم\\الأول",
  track_name_ar: "القرآن\nالكريم",
  track_name_en: "Quran",
};

describe("iCalendar export", () => {
  it("escapes every RFC 5545 text delimiter", () => {
    expect(escapeICalText("one\\two,three;four\nfive\r\nsix")).toBe(
      "one\\\\two\\,three\\;four\\nfive\\nsix",
    );
  });

  it("uses CRLF, UTC timestamps, a stable UID, and no local offset", () => {
    const calendar = render([event]);

    expect(calendar).toContain("\r\n");
    expect(calendar.replaceAll("\r\n", "")).not.toContain("\n");
    expect(calendar).toContain("UID:e8600000-0000-4000-8000-000000000001@noor-alwahy");
    expect(calendar).toContain("DTSTART:20261020T153000Z");
    expect(calendar).toContain("DTEND:20261020T160000Z");
    expect(calendar).toContain("X-WR-TIMEZONE:Africa/Cairo");
    expect(calendar).not.toContain("+03:00");
  });

  it("folds UTF-8 content without exceeding 75 octets per physical line", () => {
    const folded = foldICalLine(`SUMMARY:${"موعد طويل جدًا ".repeat(12)}`);
    const physicalLines = folded.split("\r\n");

    expect(physicalLines.length).toBeGreaterThan(1);
    expect(physicalLines.slice(1).every((line) => line.startsWith(" "))).toBe(true);
    expect(physicalLines.every((line) => Buffer.byteLength(line, "utf8") <= 75)).toBe(true);
  });

  it("escapes localized event text and emits only the safe event contract", () => {
    const calendar = render([event]);

    expect(calendar).toContain("القرآن\\nالكريم");
    expect(calendar).toContain("أحمد\\, علي\\; الطويل");
    expect(calendar).toContain("المعلم\\\\الأول");
    expect(calendar).not.toMatch(/zoom|meeting|passcode|secret/i);
  });

  it("creates a valid empty calendar from the metadata-only row", () => {
    const calendar = render([
      {
        ...event,
        session_id: null,
        scheduled_at: null,
        ends_at: null,
        status: null,
        student_name: null,
        teacher_name: null,
        track_name_ar: null,
        track_name_en: null,
      },
    ]);

    expect(calendar).toContain("X-WR-CALNAME:جدول طالب الاختبار");
    expect(calendar).not.toContain("BEGIN:VEVENT");
    expect(calendar.endsWith("END:VCALENDAR\r\n")).toBe(true);
  });

  it("rejects malformed timestamps instead of silently shifting them", () => {
    expect(() => render([{ ...event, scheduled_at: "not-a-time" }])).toThrow(
      "invalid_calendar_timestamp",
    );
  });
});

describe("schedule PDF template", () => {
  it("renders localized safe schedule content without meeting secrets", async () => {
    const html = await createScheduleHtml({
      ownerName: "طالب الاختبار الطويل",
      ownerTimezone: "Africa/Cairo",
      ownerLocale: "ar",
      rows: [event],
      generatedAt: "2026-10-20T12:00:00Z",
    });

    expect(html).toContain("جدول الحصص");
    expect(html).toContain("طالب الاختبار الطويل");
    expect(html).toContain("أحمد, علي; الطويل");
    expect(html).toContain("Africa/Cairo");
    expect(html).not.toMatch(/zoom|meeting-secret|passcode-secret/i);
    expect(html).not.toContain("<script");
  });
});

function render(rows: CalendarFeedRow[]) {
  return createICalendar({
    ownerName: "طالب الاختبار",
    ownerTimezone: "Africa/Cairo",
    ownerLocale: "ar",
    rows,
    generatedAt: "2026-10-20T12:00:00Z",
  });
}
