import { describe, expect, it } from "vitest";

import { memorizationPlanSchema } from "../../lib/validators/memorization-plan";

const validPlan = {
  studentId: "ed300000-0000-4000-8000-000000000001",
  weeklyTargetPages: "5",
  monthlyTargetPages: "20",
  startsOn: "2026-10-20",
  endsOn: "",
};

describe("memorization plan validation", () => {
  it("coerces valid targets and permits an open-ended plan", () => {
    const result = memorizationPlanSchema.parse(validPlan);
    expect(result.weeklyTargetPages).toBe(5);
    expect(result.monthlyTargetPages).toBe(20);
    expect(result.endsOn).toBeUndefined();
  });

  it("rejects page targets outside the Mushaf range", () => {
    expect(memorizationPlanSchema.safeParse({ ...validPlan, weeklyTargetPages: "0" }).success).toBe(
      false,
    );
    expect(
      memorizationPlanSchema.safeParse({ ...validPlan, monthlyTargetPages: "605" }).success,
    ).toBe(false);
  });

  it("rejects a monthly target below the weekly target", () => {
    expect(
      memorizationPlanSchema.safeParse({
        ...validPlan,
        weeklyTargetPages: "12",
        monthlyTargetPages: "10",
      }).success,
    ).toBe(false);
  });

  it("rejects an end date before the start date", () => {
    expect(memorizationPlanSchema.safeParse({ ...validPlan, endsOn: "2026-10-19" }).success).toBe(
      false,
    );
  });
});
