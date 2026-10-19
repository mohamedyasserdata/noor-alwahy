import { DateTime } from "luxon";
import { z } from "zod";

export const editableStudentStatuses = ["active", "dropped", "graduated", "suspended"] as const;
const studentStatuses = [...editableStudentStatuses, "archived"] as const;

const optionalDate = z
  .string()
  .trim()
  .optional()
  .transform((value) => value || null)
  .refine((value) => value === null || /^\d{4}-\d{2}-\d{2}$/.test(value), "invalid_date");

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => value || null);

export const studentFormSchema = z
  .object({
    studentId: z.uuid().optional().nullable(),
    fullName: z.string().trim().min(2).max(160),
    gender: z.enum(["male", "female"]),
    birthDate: optionalDate,
    status: z.enum(studentStatuses),
    levelId: z
      .string()
      .trim()
      .nullish()
      .transform((value) => value || null)
      .pipe(z.uuid().nullable()),
    joinedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    countryCode: z
      .string()
      .trim()
      .toUpperCase()
      .optional()
      .transform((value) => value || null)
      .pipe(
        z
          .string()
          .regex(/^[A-Z]{2}$/)
          .nullable(),
      ),
    timezone: z
      .string()
      .trim()
      .min(1)
      .max(100)
      .refine((value) => DateTime.now().setZone(value).isValid, "invalid_timezone"),
    healthNotes: optionalText(2000),
    specialNotes: optionalText(2000),
    shareWithTeacher: z.enum(["true", "false"]).transform((value) => value === "true"),
  })
  .refine(
    ({ birthDate }) => birthDate === null || birthDate <= DateTime.now().toFormat("yyyy-LL-dd"),
    { path: ["birthDate"], message: "future_birth_date" },
  );

export const archiveStudentSchema = z.object({ studentId: z.uuid() });

export const studentFiltersSchema = z.object({
  q: z.string().trim().max(80).optional().default(""),
  status: z
    .enum(["all", ...studentStatuses])
    .optional()
    .default("all"),
  level: z
    .union([z.literal("all"), z.uuid()])
    .optional()
    .default("all"),
  country: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/)
    .optional()
    .or(z.literal(""))
    .default(""),
  page: z.coerce.number().int().min(1).max(10_000).optional().default(1),
});

export type StudentFilters = z.infer<typeof studentFiltersSchema>;
