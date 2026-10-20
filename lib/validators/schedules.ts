import { z } from "zod";

import { isValidTimeZone } from "../time";

export const scheduleSlotSchema = z.object({
  assignmentId: z.uuid(),
  weekday: z.coerce.number().int().min(0).max(6),
  localStartTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  durationMin: z.coerce.number().int().min(10).max(120),
  anchorTimezone: z.string().trim().min(1).max(100).refine(isValidTimeZone),
});

const sessionId = z.uuid();
const localDateTime = z.string().regex(/^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d$/);

export const substituteSessionSchema = z.object({
  sessionId,
  substituteTeacherId: z.uuid(),
  scope: z.enum(["session", "week"]),
});

export const makeupSessionSchema = z.object({
  entitlementId: z.uuid(),
  teacherId: z.union([z.uuid(), z.literal("")]).transform((value) => value || undefined),
  scheduledLocal: localDateTime,
});

export const rescheduleSessionSchema = z.object({
  sessionId,
  scheduledLocal: localDateTime,
});
