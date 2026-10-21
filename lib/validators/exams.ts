import { z } from "zod";

import { evaluationSessionTypeSchema } from "./evaluation-settings";

export const examSchema = z.object({
  titleAr: z.string().trim().min(2).max(200),
  titleEn: z.string().trim().max(200).default(""),
  kind: z.enum(["monthly", "term", "final", "juz"]),
  sessionType: evaluationSessionTypeSchema,
  trackId: z.union([z.uuid(), z.literal("")]).default(""),
  maxScore: z.coerce.number().positive().max(10000),
  weight: z.coerce.number().positive().max(100),
  heldOn: z.iso.date(),
});
export const examStatusSchema = z.object({ examId: z.uuid(), status: z.enum(["open", "closed"]) });
export const examResultSchema = z.object({
  examId: z.uuid(),
  studentId: z.uuid(),
  scores: z.record(z.string().regex(/^[a-z][a-z0-9_]*$/), z.coerce.number().int().min(1).max(5)),
  major: z.coerce.number().int().min(0).max(999),
  minor: z.coerce.number().int().min(0).max(999),
  prompts: z.coerce.number().int().min(0).max(999),
  forgot: z.coerce.number().int().min(0).max(999),
});
export const lockExamResultSchema = z.object({ resultId: z.uuid() });
