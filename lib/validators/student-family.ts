import { z } from "zod";

const relation = z
  .string()
  .trim()
  .max(80)
  .optional()
  .transform((value) => value || null);

export const guardianLinkSchema = z.object({
  studentId: z.uuid(),
  parentProfileId: z.uuid(),
  relation,
  isPrimary: z.enum(["true", "false"]).transform((value) => value === "true"),
  isPayer: z.enum(["true", "false"]).transform((value) => value === "true"),
});

export const removeGuardianLinkSchema = z.object({
  studentId: z.uuid(),
  guardianId: z.uuid(),
});

export const familyAccountSchema = z.object({
  studentId: z.uuid(),
  role: z.enum(["student", "parent"]),
  fullName: z.string().trim().min(2).max(160),
  email: z.email().trim().max(254),
  temporaryPassword: z.string().min(12).max(128),
  relation,
  isPrimary: z.enum(["true", "false"]).transform((value) => value === "true"),
  isPayer: z.enum(["true", "false"]).transform((value) => value === "true"),
});
