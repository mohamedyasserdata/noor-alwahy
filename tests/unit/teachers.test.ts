import { describe, expect, it } from "vitest";

import { availabilitySchema, teacherFormSchema } from "../../lib/validators/teachers";

describe("teacher management validation", () => {
  it("accepts a bounded teacher profile", () => {
    const result = teacherFormSchema.safeParse({
      teacherId: null,
      profileId: "10000000-0000-4000-8000-000000000002",
      gender: "male",
      specialization: "Quran",
      ijazahRiwaya: "Hafs",
      ijazahSanad: "Verified",
      maxStudents: "15",
      status: "pending",
      identityVerified: true,
      trackIds: ["d2000000-0000-4000-8000-000000000001"],
    });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid capacity", () => {
    const result = teacherFormSchema.safeParse({
      profileId: "10000000-0000-4000-8000-000000000002",
      gender: "male",
      maxStudents: 0,
      status: "pending",
      identityVerified: false,
      trackIds: [],
    });
    expect(result.success).toBe(false);
  });

  it("accepts a weekly range whose end is after its start", () => {
    expect(
      availabilitySchema.safeParse({ weekday: "2", startTime: "09:00", endTime: "10:30" }).success,
    ).toBe(true);
  });

  it("rejects reversed and overnight availability", () => {
    expect(
      availabilitySchema.safeParse({ weekday: 2, startTime: "18:00", endTime: "09:00" }).success,
    ).toBe(false);
  });
});
