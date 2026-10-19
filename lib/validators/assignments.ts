import { z } from "zod";

export const assignmentSelectionSchema = z.object({
  studentId: z.uuid(),
  trackId: z.uuid(),
});

export const assignmentActionSchema = assignmentSelectionSchema.extend({
  teacherId: z.uuid(),
  action: z.enum(["assign", "change", "pause", "resume", "end"]),
  reason: z.string().trim().min(2).max(500),
});
