import { z } from "zod";

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const narrative = z.string().trim().min(2).max(2000);

export const reportDraftSchema = z
  .object({
    reportId: z.uuid().optional(),
    studentId: z.uuid(),
    periodType: z.enum(["weekly", "monthly"]),
    periodStart: z.string().regex(datePattern),
    periodEnd: z.string().regex(datePattern),
    summary: narrative,
    strengths: narrative,
    improve: narrative,
    plan: narrative,
    recommendation: narrative,
  })
  .superRefine((value, context) => {
    const start = Date.parse(`${value.periodStart}T00:00:00Z`);
    const end = Date.parse(`${value.periodEnd}T00:00:00Z`);
    const days = (end - start) / 86_400_000;
    if (!Number.isFinite(days) || days < 0 || days > 31) {
      context.addIssue({ code: "custom", path: ["periodEnd"], message: "invalid_period" });
    }
  });

export const reportApprovalSchema = z.object({ reportId: z.uuid() });

export type ReportDraftInput = z.infer<typeof reportDraftSchema>;
