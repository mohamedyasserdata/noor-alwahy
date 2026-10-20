import { z } from "zod";

export const evaluationSessionTypes = [
  "new_memo",
  "near_review",
  "far_review",
  "recitation",
  "noorani",
  "matn_theory",
] as const;

export const evaluationSessionTypeSchema = z.enum(evaluationSessionTypes);

const boundedNumberSchema = z.coerce.number().finite().min(0).max(100);
const criterionCodeSchema = z.string().regex(/^[a-z][a-z0-9_]*$/);

export const evaluationSettingsUpdateSchema = z
  .object({
    sessionType: evaluationSessionTypeSchema,
    dMajor: boundedNumberSchema,
    dMinor: boundedNumberSchema,
    dPrompt: boundedNumberSchema,
    dForgot: boundedNumberSchema,
    thresholds: z
      .array(boundedNumberSchema)
      .length(5)
      .superRefine((thresholds, context) => {
        for (let index = 1; index < thresholds.length; index += 1) {
          if ((thresholds[index - 1] ?? 0) >= (thresholds[index] ?? 0)) {
            context.addIssue({ code: "custom", message: "thresholds_not_increasing" });
            return;
          }
        }
      }),
    weights: z
      .record(criterionCodeSchema, boundedNumberSchema)
      .refine((weights) => Object.keys(weights).length > 0, "weights_required")
      .refine(
        (weights) => Object.values(weights).reduce((total, weight) => total + weight, 0) > 0,
        "positive_weight_total_required",
      ),
  })
  .strict();

export type EvaluationSessionType = z.infer<typeof evaluationSessionTypeSchema>;
export type EvaluationSettingsUpdate = z.infer<typeof evaluationSettingsUpdateSchema>;
