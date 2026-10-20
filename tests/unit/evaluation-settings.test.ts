import { describe, expect, it } from "vitest";

import { evaluationSettingsFormSchema } from "../../lib/validators/evaluation-settings";

const validSettings = {
  sessionType: "new_memo",
  dMajor: "2",
  dMinor: "0.5",
  dPrompt: "0.5",
  dForgot: "1",
  ratingThresholds: ["0", "30", "50", "70", "90"],
  weights: { memorization: "1", fluency: "1" },
};

describe("evaluation settings validation", () => {
  it("coerces valid form decimals", () => {
    const result = evaluationSettingsFormSchema.parse(validSettings);
    expect(result.dMinor).toBe(0.5);
    expect(result.ratingThresholds).toEqual([0, 30, 50, 70, 90]);
  });

  it("rejects unknown session types and negative deductions", () => {
    expect(
      evaluationSettingsFormSchema.safeParse({ ...validSettings, sessionType: "unknown" }).success,
    ).toBe(false);
    expect(evaluationSettingsFormSchema.safeParse({ ...validSettings, dMajor: "-1" }).success).toBe(
      false,
    );
  });

  it("requires five strictly increasing thresholds", () => {
    expect(
      evaluationSettingsFormSchema.safeParse({
        ...validSettings,
        ratingThresholds: ["0", "30", "30", "70", "90"],
      }).success,
    ).toBe(false);
    expect(
      evaluationSettingsFormSchema.safeParse({
        ...validSettings,
        ratingThresholds: ["0", "30", "50", "70"],
      }).success,
    ).toBe(false);
  });

  it("requires a positive total weight", () => {
    expect(evaluationSettingsFormSchema.safeParse({ ...validSettings, weights: {} }).success).toBe(
      false,
    );
    expect(
      evaluationSettingsFormSchema.safeParse({ ...validSettings, weights: { memorization: "0" } })
        .success,
    ).toBe(false);
  });
});
