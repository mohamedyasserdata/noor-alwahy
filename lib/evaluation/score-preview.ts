import Decimal from "decimal.js";

export type EvaluationScorePreviewInput = {
  scores: Record<string, number>;
  weights: Record<string, number>;
  errorsMajor: number;
  errorsMinor: number;
  promptsCount: number;
  forgotCount: number;
  deductions: {
    major: number;
    minor: number;
    prompt: number;
    forgot: number;
  };
  thresholds: readonly [number, number, number, number, number];
};

export type EvaluationScorePreview = {
  totalScore: number;
  rating: 1 | 2 | 3 | 4 | 5;
};

/**
 * Mirrors BR-09 for immediate form feedback only. The database trigger remains
 * authoritative and overwrites every client-supplied total and rating.
 */
export function calculateEvaluationScorePreview(
  input: EvaluationScorePreviewInput,
): EvaluationScorePreview {
  let weightedSum = new Decimal(0);
  let totalWeight = new Decimal(0);

  for (const [criterion, score] of Object.entries(input.scores)) {
    const weight = input.weights[criterion];
    if (weight === undefined || !Number.isInteger(score) || score < 1 || score > 5 || weight < 0) {
      throw new Error("invalid_evaluation_score_input");
    }
    weightedSum = weightedSum.plus(new Decimal(score).times(weight));
    totalWeight = totalWeight.plus(weight);
  }

  if (totalWeight.lte(0)) throw new Error("invalid_evaluation_total_weight");

  const deduction = new Decimal(input.errorsMajor)
    .times(input.deductions.major)
    .plus(new Decimal(input.errorsMinor).times(input.deductions.minor))
    .plus(new Decimal(input.promptsCount).times(input.deductions.prompt))
    .plus(new Decimal(input.forgotCount).times(input.deductions.forgot));
  const total = Decimal.max(
    0,
    Decimal.min(100, weightedSum.div(totalWeight).times(20).minus(deduction)),
  );
  const [ratingOne, ratingTwo, ratingThree, ratingFour, ratingFive] = input.thresholds;

  if (!(
    ratingOne < ratingTwo &&
    ratingTwo < ratingThree &&
    ratingThree < ratingFour &&
    ratingFour < ratingFive
  )) {
    throw new Error("invalid_evaluation_thresholds");
  }

  const rating = total.gte(ratingFive)
    ? 5
    : total.gte(ratingFour)
      ? 4
      : total.gte(ratingThree)
        ? 3
        : total.gte(ratingTwo)
          ? 2
          : 1;

  return { totalScore: total.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber(), rating };
}
