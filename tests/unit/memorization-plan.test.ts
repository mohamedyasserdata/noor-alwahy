import { describe, expect, it } from "vitest";

import { memorizationPlanSchema } from "../../lib/validators/memorization-plan";

const valid = {
  studentId: "10000000-0000-4000-8000-000000000003",
  weeklyTargetPages: 4,
  monthlyTargetPages: 16,
  startsOn: "2026-10-20",
  endsOn: "",
};

describe("memorization plan validation", () => {
  it("accepts a bounded open-ended plan", () => {
    expect(memorizationPlanSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects a monthly target below the weekly target", () => {
    expect(
      memorizationPlanSchema.safeParse({ ...valid, weeklyTargetPages: 8, monthlyTargetPages: 4 })
        .success,
    ).toBe(false);
  });

  it("rejects an end date before the start date", () => {
    expect(memorizationPlanSchema.safeParse({ ...valid, endsOn: "2026-10-19" }).success).toBe(
      false,
    );
  });

  it("rejects targets outside the Quran page range", () => {
    expect(memorizationPlanSchema.safeParse({ ...valid, weeklyTargetPages: 0 }).success).toBe(
      false,
    );
    expect(memorizationPlanSchema.safeParse({ ...valid, monthlyTargetPages: 605 }).success).toBe(
      false,
    );
  });
});
