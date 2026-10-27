import { z } from "zod";

export const teacherApplicationSchema = z.object({
  locale: z.enum(["ar", "en"]),
  full_name: z.string().trim().min(2).max(160),
  email: z.email().trim().toLowerCase().max(254),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9 ()-]{7,30}$/),
  gender: z.enum(["male", "female"]),
  specialization: z.string().trim().min(2).max(200),
  qualifications: z.string().trim().min(10).max(3000),
  experience_years: z.coerce.number().int().min(0).max(80),
  teaching_languages: z
    .array(z.enum(["ar", "en", "fr", "other"]))
    .min(1)
    .max(4)
    .refine((values) => new Set(values).size === values.length),
  availability: z.string().trim().min(5).max(2000),
  consent: z.literal("on"),
  captcha_token: z.string().trim().min(10).max(4096),
});

export const teacherApplicationReviewSchema = z.object({
  applicationId: z.uuid(),
  status: z.enum(["new", "reviewing", "accepted", "rejected"]),
  internalNotes: z.string().trim().max(5000).optional().default(""),
});

export const teacherApplicationInviteSchema = z.object({ applicationId: z.uuid() });

export const teacherApplicationQuerySchema = z.object({
  q: z.string().trim().max(100).optional().default(""),
  status: z
    .enum(["all", "new", "reviewing", "accepted", "rejected", "invited"])
    .optional()
    .default("all"),
});
