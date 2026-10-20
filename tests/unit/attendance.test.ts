import { describe, expect, it } from "vitest";

import {
  attendanceStatuses,
  parseAttendanceReportFilters,
  recordAttendanceSchema,
} from "../../lib/validators/attendance";

describe("attendance action validation", () => {
  it.each(attendanceStatuses)("accepts the supported %s result", (status) => {
    expect(
      recordAttendanceSchema.safeParse({
        sessionId: "11111111-1111-4111-8111-111111111111",
        status,
      }).success,
    ).toBe(true);
  });

  it("rejects an unknown result or malformed session id", () => {
    expect(
      recordAttendanceSchema.safeParse({ sessionId: "not-a-uuid", status: "present" }).success,
    ).toBe(false);
    expect(
      recordAttendanceSchema.safeParse({
        sessionId: "11111111-1111-4111-8111-111111111111",
        status: "forged",
      }).success,
    ).toBe(false);
  });
});

describe("attendance report filters", () => {
  it("accepts a supported period and real ISO date", () => {
    expect(parseAttendanceReportFilters({ period: "weekly", anchor: "2026-10-20" })).toEqual({
      period: "weekly",
      anchor: "2026-10-20",
    });
  });

  it("falls back safely for malformed values", () => {
    const result = parseAttendanceReportFilters({ period: "yearly", anchor: "2026-02-31" });

    expect(result.period).toBe("monthly");
    expect(result.anchor).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(result.anchor).not.toBe("2026-02-31");
  });
});
