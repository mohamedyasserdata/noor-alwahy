import { describe, expect, it } from "vitest";

import {
  buildSchedulePdfHtml,
  escapeHtml,
  type SchedulePdfInput,
} from "../../lib/schedules/pdf-template";

const fonts = {
  cairoArabic: "data:font/woff2;base64,YQ==",
  cairoLatin: "data:font/woff2;base64,Yg==",
  amiriArabic: "data:font/woff2;base64,Yw==",
  amiriLatin: "data:font/woff2;base64,ZA==",
};

const input: SchedulePdfInput = {
  locale: "ar",
  ownerName: 'طالب <script>alert("x")</script>',
  timezone: "Africa/Cairo",
  generatedAt: "2026-10-20 03:00 GMT+3",
  rows: [
    {
      weekday: 2,
      time: "18:30",
      durationMinutes: 45,
      studentName: "أحمد & علي",
      teacherName: "المعلم الأول",
      trackName: "القرآن الكريم",
    },
  ],
};

describe("weekly schedule PDF template", () => {
  it("escapes every HTML-sensitive character", () => {
    expect(escapeHtml(`<>&\"'`)).toBe("&lt;&gt;&amp;&quot;&#39;");
  });

  it("renders Arabic RTL with the visible IANA time zone and local time", () => {
    const html = buildSchedulePdfHtml(input, fonts);

    expect(html).toContain('<html lang="ar" dir="rtl">');
    expect(html).toContain("Africa/Cairo");
    expect(html).toContain("18:30");
    expect(html).toContain("الثلاثاء");
    expect(html).toContain("جميع المواعيد معروضة بالمنطقة الزمنية");
  });

  it("never interpolates user-controlled markup", () => {
    const html = buildSchedulePdfHtml(input, fonts);

    expect(html).not.toContain("<script>alert");
    expect(html).toContain("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;");
  });

  it("renders a localized empty state", () => {
    const html = buildSchedulePdfHtml({ ...input, locale: "en", rows: [] }, fonts);

    expect(html).toContain('<html lang="en" dir="ltr">');
    expect(html).toContain("No active weekly sessions.");
  });
});
