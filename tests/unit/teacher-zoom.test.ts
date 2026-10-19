import { describe, expect, it } from "vitest";

import { isAllowedZoomUrl, teacherZoomSchema } from "../../lib/validators/teacher-zoom";

describe("teacher Zoom URL validation", () => {
  it.each([
    "https://zoom.us/j/123",
    "https://academy.zoom.us/my/teacher",
    "https://zoom.com/j/123",
    "https://agency.zoomgov.com/j/123",
  ])("accepts approved HTTPS host %s", (url) => {
    expect(isAllowedZoomUrl(url)).toBe(true);
    expect(teacherZoomSchema.safeParse({ joinUrl: url }).success).toBe(true);
  });

  it.each([
    "http://zoom.us/j/123",
    "https://zoom.us.evil.test/j/123",
    "https://sub.zoom.com/j/123",
    "https://user:pass@zoom.us/j/123",
    "javascript:alert(1)",
  ])("rejects unsafe URL %s", (url) => {
    expect(isAllowedZoomUrl(url)).toBe(false);
  });
});
