import { z } from "zod";

export const createSubscriptionSchema = z.object({
  studentId: z.uuid(),
  packageId: z.uuid(),
  countryCode: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/),
  startDate: z.iso.date(),
  applicationId: z
    .union([z.uuid(), z.literal("")])
    .optional()
    .default(""),
});
