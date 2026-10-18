import { z } from "zod";

const localizedNameSchema = z.string().trim().min(2).max(120);
const localizedDescriptionSchema = z.string().trim().min(2).max(500);

export function isSafeLogoPath(value: string) {
  return (
    /^\/[A-Za-z0-9_./-]+$/.test(value) &&
    !value.startsWith("//") &&
    !value.split("/").some((segment) => segment === "..")
  );
}

const safeLogoPathSchema = z
  .string()
  .min(1)
  .max(2048)
  .refine((value) => value === value.trim(), "same_origin_path")
  .refine(isSafeLogoPath, "same_origin_path");

export const academyProfileSchema = z
  .object({
    nameAr: localizedNameSchema,
    nameEn: localizedNameSchema,
    descriptionAr: localizedDescriptionSchema,
    descriptionEn: localizedDescriptionSchema,
    logoPath: safeLogoPathSchema.nullable(),
  })
  .strict();

export const supportHoursSchema = z
  .object({
    ar: localizedDescriptionSchema,
    en: localizedDescriptionSchema,
  })
  .strict();

export const publicAppSettingsSchema = z
  .object({
    academyProfile: academyProfileSchema,
    supportHours: supportHoursSchema,
  })
  .strict();

export type AcademyProfile = z.infer<typeof academyProfileSchema>;
export type SupportHours = z.infer<typeof supportHoursSchema>;
export type PublicAppSettings = z.infer<typeof publicAppSettingsSchema>;
