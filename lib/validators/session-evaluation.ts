import { z } from "zod";

import { evaluationSessionTypeSchema } from "./evaluation-settings";

const nonnegativeInteger = z.coerce.number().int().min(0).max(999);

export const sessionEvaluationSchema = z.object({
  sessionId: z.uuid(),
  sessionType: evaluationSessionTypeSchema,
  fromSurah: z.coerce.number().int().min(1).max(114),
  fromAyah: z.coerce.number().int().min(1).max(286),
  toSurah: z.coerce.number().int().min(1).max(114),
  toAyah: z.coerce.number().int().min(1).max(286),
  scores: z.record(z.string().regex(/^[a-z][a-z0-9_]*$/), z.coerce.number().int().min(1).max(5)),
  errorsMajor: nonnegativeInteger,
  errorsMinor: nonnegativeInteger,
  promptsCount: nonnegativeInteger,
  forgotCount: nonnegativeInteger,
  weakTags: z.array(z.string().trim().min(1).max(50)).max(12),
  decision: z.enum(["passed", "repeat", "next"]),
  homework: z.string().trim().max(1200),
  familyNote: z.string().trim().max(1200),
});

export function scoresFromFormData(formData: FormData) {
  return Object.fromEntries(
    [...formData.entries()]
      .filter(([key]) => key.startsWith("score:"))
      .map(([key, value]) => [key.slice("score:".length), value]),
  );
}
