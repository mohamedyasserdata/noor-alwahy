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

export const assignmentWithScheduleSchema = assignmentActionSchema
  .extend({
    weekdays: z.array(z.coerce.number().int().min(0).max(6)).min(1).max(7),
    localStartTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    durationMin: z.coerce.number().int().min(10).max(120),
    createSchedule: z.enum(["true", "false"]).transform((value) => value === "true"),
  })
  .refine((value) => ["assign", "change"].includes(value.action), { path: ["action"] });
