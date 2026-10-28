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
    timezone: z.string().trim().min(1).max(100).refine(isIanaTimezone, "timezone_invalid"),
    track_id: z.union([z.uuid(), z.literal("")]),
    package_id: z.union([z.uuid(), z.literal("")]),
    self_level: z.enum(["beginner", "intermediate", "advanced", "memorizing"]),
    preferred_times: z.array(z.string().trim().min(2).max(120)).min(1).max(7),
    preferred_teacher_gender: z.enum(["male", "female", ""]),
    notes: z.string().trim().max(2000).optional().default(""),
    consent: z.literal(true),
    captcha_token: z.string().trim().min(10).max(4096),
    source: z.string().trim().min(1).max(80).optional().default("website"),
  })
  .superRefine((value, context) => {
    if (!value.contact_email && !value.contact_phone)
      context.addIssue({ code: "custom", message: "contact_required", path: ["contact_email"] });
    if (value.student_age < 18 && value.guardian_name.length < 2)
      context.addIssue({ code: "custom", message: "guardian_required", path: ["guardian_name"] });
    if (value.preferred_teacher_gender && value.preferred_teacher_gender !== value.student_gender)
      context.addIssue({
        code: "custom",
        message: "teacher_gender_mismatch",
        path: ["preferred_teacher_gender"],
      });
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

function isIanaTimezone(value: string) {
  try {
    new Intl.DateTimeFormat("en", { timeZone: value }).format();
    return value === "UTC" || Intl.supportedValuesOf("timeZone").includes(value);
  } catch {
    return false;
  }
}
