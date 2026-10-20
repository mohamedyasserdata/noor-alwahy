import { z } from "zod";

export const evaluationSessionTypes = [
  "new_memo",
  "near_review",
  "far_review",
  "recitation",
  "noorani",
  "matn_theory",
] as const;

const boundedDecimal = z.coerce.number().finite().min(0).max(999.99);
const ratingThreshold = z.coerce.number().finite().min(0).max(100);

export const ratingThresholdsSchema = z
  .tuple([ratingThreshold, ratingThreshold, ratingThreshold, ratingThreshold, ratingThreshold])
  .refine(
    (thresholds) =>
      thresholds.every((threshold, index) => index === 0 || threshold > thresholds[index - 1]!),
    "rating_thresholds_not_increasing",
  );

export const evaluationSettingsFormSchema = z
  .strictObject({
    sessionType: z.enum(evaluationSessionTypes),
    dMajor: boundedDecimal,
    dMinor: boundedDecimal,
    dPrompt: boundedDecimal,
    dForgot: boundedDecimal,
    ratingThresholds: ratingThresholdsSchema,
    weights: z.record(z.string().regex(/^[a-z][a-z0-9_]*$/), boundedDecimal),
  })
  .refine((value) => Object.keys(value.weights).length > 0, {
    path: ["weights"],
    message: "evaluation_weights_empty",
  })
  .refine((value) => Object.values(value.weights).some((weight) => weight > 0), {
    path: ["weights"],
    message: "evaluation_weights_zero_total",
  });

export type EvaluationSettingsForm = z.infer<typeof evaluationSettingsFormSchema>;
