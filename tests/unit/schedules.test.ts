import { describe, expect, it } from "vitest";

import { convertNextOccurrence } from "../../lib/schedules/conversion";
import {
  makeupSessionSchema,
  rescheduleSessionSchema,
  scheduleSlotSchema,
  substituteSessionSchema,
} from "../../lib/validators/schedules";

describe("weekly schedules", () => {
  it("accepts bounded weekly slots with an IANA anchor", () => {
    expect(
      scheduleSlotSchema.safeParse({
        assignmentId: "10000000-0000-4000-8000-000000000001",
        weekday: "5",
        localStartTime: "18:30",
        durationMin: "30",
        anchorTimezone: "Africa/Cairo",
      }).success,
    ).toBe(true);
  });

  it("rejects invalid time zones and durations", () => {
    expect(
      scheduleSlotSchema.safeParse({
        assignmentId: "10000000-0000-4000-8000-000000000001",
        weekday: 5,
        localStartTime: "18:30",
        durationMin: 5,
        anchorTimezone: "Cairo",
      }).success,
    ).toBe(false);
  });

  it("converts the next anchored occurrence to the viewer zone", () => {
    const value = convertNextOccurrence({
      weekday: 5,
      time: "18:30",
      anchorTimezone: "Africa/Cairo",
      viewerTimezone: "Asia/Riyadh",
    });
    expect(value?.time).toMatch(/^\d{2}:30:00$/);
    expect(value?.timeZone).toBe("Asia/Riyadh");
  });

  it("validates the three administrative session adjustments", () => {
    const sessionId = "10000000-0000-4000-8000-000000000001";
    const teacherId = "10000000-0000-4000-8000-000000000002";

    expect(
      substituteSessionSchema.safeParse({
        sessionId,
        substituteTeacherId: teacherId,
        scope: "week",
      }).success,
    ).toBe(true);
    expect(
      makeupSessionSchema.safeParse({
        entitlementId: sessionId,
        teacherId: "",
        scheduledLocal: "2030-02-10T18:30",
      }).success,
    ).toBe(true);
    expect(
      rescheduleSessionSchema.safeParse({
        sessionId,
        scheduledLocal: "2030-02-10 18:30",
      }).success,
    ).toBe(false);
  });
});
