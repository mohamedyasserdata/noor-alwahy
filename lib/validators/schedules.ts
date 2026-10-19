import { z } from "zod";

import { isValidTimeZone } from "../time";

export const scheduleSlotSchema = z.object({
  assignmentId: z.uuid(),
  weekday: z.coerce.number().int().min(0).max(6),
  localStartTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  durationMin: z.coerce.number().int().min(10).max(120),
  anchorTimezone: z.string().trim().min(1).max(100).refine(isValidTimeZone),
});
