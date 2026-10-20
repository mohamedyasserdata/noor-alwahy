import { describe, expect, it } from "vitest";

import { calculateEvaluationScorePreview } from "../../lib/evaluation/score-preview";

const baseInput = {
  weights: { memorization: 1, commitment: 1 },
  errorsMajor: 0,
  errorsMinor: 0,
  promptsCount: 0,
  forgotCount: 0,
  deductions: { major: 2, minor: 0.5, prompt: 0.5, forgot: 1 },
  thresholds: [0, 30, 50, 70, 90] as const,
};

describe("BR-09 evaluation score preview", () => {
  it.each([
    [5, 100, 5],
    [4, 80, 4],
    [3, 60, 3],
    [2, 40, 2],
    [1, 20, 1],
  ] as const)("maps all %s scores to %s and rating %s", (score, totalScore, rating) => {
    expect(
      calculateEvaluationScorePreview({
        ...baseInput,
        scores: { memorization: score, commitment: score },
      }),
    ).toEqual({ totalScore, rating });
  });

  it("applies all deductions and uses the exact rating boundary", () => {
    expect(
      calculateEvaluationScorePreview({
        ...baseInput,
        scores: { memorization: 4, commitment: 4 },
        errorsMajor: 3,
        errorsMinor: 4,
        promptsCount: 2,
        forgotCount: 1,
      }),
    ).toEqual({ totalScore: 70, rating: 4 });
  });

  it("clamps a deduction larger than the base score at zero", () => {
    expect(
      calculateEvaluationScorePreview({
        ...baseInput,
        scores: { memorization: 1, commitment: 1 },
        errorsMajor: 20,
      }),
    ).toEqual({ totalScore: 0, rating: 1 });
  });

  it("weights only supplied applicable criteria", () => {
    expect(
      calculateEvaluationScorePreview({
        ...baseInput,
        scores: { commitment: 5 },
      }),
    ).toEqual({ totalScore: 100, rating: 5 });
  });

  it("rejects unknown criteria, out-of-range scores, and zero total weight", () => {
    expect(() => calculateEvaluationScorePreview({ ...baseInput, scores: { unknown: 5 } })).toThrow(
      "invalid_evaluation_score_input",
    );
    expect(() =>
      calculateEvaluationScorePreview({ ...baseInput, scores: { commitment: 6 } }),
    ).toThrow("invalid_evaluation_score_input");
    expect(() =>
      calculateEvaluationScorePreview({
        ...baseInput,
        scores: { commitment: 5 },
        weights: { commitment: 0 },
      }),
    ).toThrow("invalid_evaluation_total_weight");
  });
});
