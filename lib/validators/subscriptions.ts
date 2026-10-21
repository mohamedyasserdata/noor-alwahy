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

export const pauseSubscriptionSchema = z.object({
  subscriptionId: z.uuid(),
  pausedUntil: z.iso.date(),
  reason: z.string().trim().min(2).max(500),
});

export const subscriptionChangeSchema = z.object({
  subscriptionId: z.uuid(),
  targetPackageId: z.uuid(),
});

export const renewalRunSchema = z.object({ asOf: z.iso.date() });
