import { z } from "zod";

export const applicationWorkflowSchema = z.object({
  applicationId: z.uuid(),
  status: z.enum(["new", "contacted", "trial_booked", "accepted", "rejected", "postponed"]),
  internalNotes: z.string().trim().max(5000).optional().default(""),
});
export const placementSchema = z.object({
  applicationId: z.uuid(),
  recitationScore: z.coerce.number().int().min(0).max(100),
  tajweedScore: z.coerce.number().int().min(0).max(100),
  memorizationScore: z.coerce.number().int().min(0).max(100),
  recommendedTrackId: z.union([z.uuid(), z.literal("")]),
  recommendedPackageId: z.union([z.uuid(), z.literal("")]),
  notes: z.string().trim().max(3000).optional().default(""),
});
export const applicationIdSchema = z.uuid();
