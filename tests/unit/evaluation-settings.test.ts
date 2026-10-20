import { describe, expect, it } from "vitest";

import { evaluationSettingsUpdateSchema } from "../../lib/validators/evaluation-settings";

const validInput = {
  sessionType: "recitation",
  dMajor: "2",
  dMinor: "0.5",
  dPrompt: "0.5",
  dForgot: "1",
  thresholds: ["0", "30", "50", "70", "90"],
  weights: {
    tajweed_applied: "1",
    makharij: "1",
    waqf_ibtida: "1",
    fluency: "1",
    commitment: "1",
  },
};

describe("evaluation settings validation", () => {
  it("coerces a complete valid settings form", () => {
    const result = evaluationSettingsUpdateSchema.parse(validInput);

    expect(result.dMajor).toBe(2);
    expect(result.thresholds).toEqual([0, 30, 50, 70, 90]);
    expect(result.weights.fluency).toBe(1);
  });

  it("rejects thresholds that are not strictly increasing", () => {
    const result = evaluationSettingsUpdateSchema.safeParse({
      ...validInput,
      thresholds: ["0", "30", "30", "70", "90"],
    });

    expect(result.success).toBe(false);
  });

  it("rejects negative deductions and weights", () => {
    const deductionResult = evaluationSettingsUpdateSchema.safeParse({
      ...validInput,
      dMajor: "-1",
    });
    const weightResult = evaluationSettingsUpdateSchema.safeParse({
      ...validInput,
      weights: { ...validInput.weights, fluency: "-0.5" },
    });

    expect(deductionResult.success).toBe(false);
    expect(weightResult.success).toBe(false);
  });

  it("rejects an empty or all-zero weight set", () => {
    const emptyResult = evaluationSettingsUpdateSchema.safeParse({
      ...validInput,
      weights: {},
    });
    const zeroResult = evaluationSettingsUpdateSchema.safeParse({
      ...validInput,
      weights: Object.fromEntries(Object.keys(validInput.weights).map((key) => [key, "0"])),
    });

    expect(emptyResult.success).toBe(false);
    expect(zeroResult.success).toBe(false);
  });

  it("rejects unknown session types and unsafe criterion codes", () => {
    const sessionResult = evaluationSettingsUpdateSchema.safeParse({
      ...validInput,
      sessionType: "unknown",
    });
    const codeResult = evaluationSettingsUpdateSchema.safeParse({
      ...validInput,
      weights: { ...validInput.weights, "bad.code": "1" },
    });

    expect(sessionResult.success).toBe(false);
    expect(codeResult.success).toBe(false);
  });
});
