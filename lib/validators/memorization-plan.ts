import { z } from "zod";

const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)), "invalid_date");

export const memorizationPlanSchema = z
  .object({
    studentId: z.uuid(),
    weeklyTargetPages: z.coerce.number().int().min(1).max(604),
    monthlyTargetPages: z.coerce.number().int().min(1).max(604),
    startsOn: dateSchema,
    endsOn: z.union([dateSchema, z.literal("")]),
  })
  .superRefine((value, context) => {
    if (value.monthlyTargetPages < value.weeklyTargetPages) {
      context.addIssue({
        code: "custom",
        path: ["monthlyTargetPages"],
        message: "monthly_target_below_weekly",
      });
    }
    if (value.endsOn && value.endsOn < value.startsOn) {
      context.addIssue({
        code: "custom",
        path: ["endsOn"],
        message: "end_before_start",
      });
    }
  });

export type MemorizationPlanInput = z.infer<typeof memorizationPlanSchema>;
