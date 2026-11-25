import { z } from "zod";

export const publicApplicationSchema = z
  .object({
    locale: z.enum(["ar", "en"]),
    student_name: z.string().trim().min(2).max(160),
    student_gender: z.enum(["male", "female"]),
    student_age: z.number().int().min(3).max(100),
    guardian_name: z.string().trim().max(160).optional().default(""),
    contact_email: z
      .union([z.email().max(254), z.literal("")])
      .optional()
      .default(""),
    contact_phone: z
      .union([
        z
          .string()
          .trim()
          .regex(/^\+?[0-9 ()-]{7,30}$/),
        z.literal(""),
      ])
      .optional()
      .default(""),
    country_code: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{2}$/),
    package_id: z.union([z.uuid(), z.literal("")]),
    self_level: z.enum(["beginner", "intermediate", "advanced", "memorizing"]),
    preferred_times: z.array(z.string().trim().min(2).max(120)).min(1).max(7),
    notes: z.string().trim().max(2000).optional().default(""),
    captcha_token: z.string().trim().min(10).max(4096),
    source: z.string().trim().min(1).max(80).optional().default("website"),
  })
  .superRefine((value, context) => {
    if (!value.contact_email && !value.contact_phone)
      context.addIssue({ code: "custom", message: "contact_required", path: ["contact_email"] });
  });

export const applicationStatusLookupSchema = z.object({
  order_no: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^NW-A-[A-F0-9]{20}$/),
  identifier: z.string().trim().min(4).max(254),
  locale: z.enum(["ar", "en"]),
});
