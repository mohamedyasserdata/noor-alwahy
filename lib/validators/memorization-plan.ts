import { z } from "zod";

const pageTarget = z.coerce.number().int().min(1).max(604);
const optionalDate = z
  .string()
  .trim()
  .transform((value) => (value === "" ? undefined : value))
  .pipe(z.iso.date().optional());

export const memorizationPlanSchema = z
  .object({
    studentId: z.uuid(),
    weeklyTargetPages: pageTarget,
    monthlyTargetPages: pageTarget,
    startsOn: z.iso.date(),
    endsOn: optionalDate,
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
