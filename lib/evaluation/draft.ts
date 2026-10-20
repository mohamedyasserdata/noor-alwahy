import { z } from "zod";

import { evaluationSessionTypeSchema } from "../validators/evaluation-settings";

export const evaluationDraftVersion = 1 as const;

const evaluationDraftSchema = z.object({
  version: z.literal(evaluationDraftVersion),
  sessionType: evaluationSessionTypeSchema,
  fromSurah: z.number().int().min(1).max(114),
  fromAyah: z.number().int().min(1).max(286),
  toSurah: z.number().int().min(1).max(114),
  toAyah: z.number().int().min(1).max(286),
  scores: z.record(z.string(), z.number().int().min(1).max(5)),
  errorsMajor: z.number().int().min(0).max(999),
  errorsMinor: z.number().int().min(0).max(999),
  promptsCount: z.number().int().min(0).max(999),
  forgotCount: z.number().int().min(0).max(999),
  weakTags: z.string().max(800),
  decision: z.enum(["passed", "repeat", "next"]),
  homework: z.string().max(1200),
  familyNote: z.string().max(1200),
});

export type EvaluationDraft = z.infer<typeof evaluationDraftSchema>;

export function evaluationDraftStorageKey(sessionId: string) {
  return `noor:evaluation-draft:v${evaluationDraftVersion}:${sessionId}`;
}

export function parseEvaluationDraft(value: string | null): EvaluationDraft | null {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    const result = evaluationDraftSchema.safeParse(parsed);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}
