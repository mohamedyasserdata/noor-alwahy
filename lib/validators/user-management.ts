import { z } from "zod";

const managedRoleSchema = z.enum(["teacher", "student", "parent"]);
const commonAccountFields = {
  displayName: z.string().trim().max(80).optional(),
  email: z.email().trim().max(254),
  fullName: z.string().trim().min(2).max(160),
  gender: z.enum(["male", "female"]).default("male"),
  role: managedRoleSchema,
};

export const createManagedAccountSchema = z.discriminatedUnion("mode", [
  z.object({
    ...commonAccountFields,
    mode: z.literal("invite"),
    temporaryPassword: z.string().optional(),
  }),
  z.object({
    ...commonAccountFields,
    mode: z.literal("password"),
    temporaryPassword: z.string().min(12).max(128),
  }),
]);

export const setAccountActiveSchema = z.object({
  profileId: z.uuid(),
  isActive: z.enum(["true", "false"]).transform((value) => value === "true"),
});

export type ManagedRole = z.infer<typeof managedRoleSchema>;
