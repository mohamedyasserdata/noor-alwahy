import { describe, expect, it } from "vitest";

import { attendanceStatuses, recordAttendanceSchema } from "../../lib/validators/attendance";

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
