import { z } from "zod";

const money = z.coerce.number().positive().max(99_999_999.99);

export const teacherRateSchema = z.object({
  teacherId: z.uuid(),
  trackId: z.union([z.uuid(), z.literal("")]).default(""),
  durationMin: z.union([z.coerce.number().int().min(10).max(120), z.literal("")]).default(""),
  amount: money,
  currency: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}$/),
  validFrom: z.iso.date(),
});

export const generatePayoutsSchema = z.object({
  periodStart: z.iso.date(),
  periodEnd: z.iso.date(),
});
export const payoutAdjustmentSchema = z.object({
  payoutId: z.uuid(),
  kind: z.enum(["bonus", "deduction"]),
  amount: money,
  reason: z.string().trim().min(2).max(500),
});
export const payoutTransitionSchema = z
  .object({
    payoutId: z.uuid(),
    action: z.enum(["approve", "pay"]),
    reference: z.string().trim().max(200).default(""),
  })
  .superRefine((value, context) => {
    if (value.action === "pay" && value.reference.length < 2)
      context.addIssue({ code: "custom", path: ["reference"], message: "reference_required" });
  });
