import { z } from "zod";

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

export const teacherFormSchema = z.object({
  teacherId: z
    .uuid()
    .nullish()
    .transform((value) => value || null),
  profileId: z.uuid(),
  gender: z.enum(["male", "female"]),
  specialization: z
    .string()
    .trim()
    .max(200)
    .optional()
    .transform((value) => value || null),
  ijazahRiwaya: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((value) => value || null),
  ijazahSanad: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((value) => value || null),
  maxStudents: z.coerce.number().int().min(1).max(200),
  status: z.enum(["pending", "active", "on_leave", "inactive"]),
  identityVerified: z.boolean(),
  trackIds: z.array(z.uuid()).max(50),
});

export const availabilitySchema = z
  .object({
    weekday: z.coerce.number().int().min(0).max(6),
    startTime: time,
    endTime: time,
  })
  .refine(({ startTime, endTime }) => endTime > startTime, { path: ["endTime"] });

export const availabilityMutationSchema = z.object({ availabilityId: z.uuid() });
export const availabilityReviewSchema = availabilityMutationSchema.extend({
  status: z.enum(["approved", "rejected"]),
});
