import { z } from "zod";

const managedRoleSchema = z.enum(["admin", "teacher", "student", "parent"]);
const commonAccountFields = {
  displayName: z.string().trim().max(80).optional(),
  email: z.email().trim().max(254),
  fullName: z.string().trim().min(2).max(160),
  gender: z.enum(["male", "female"]).default("male"),
  role: managedRoleSchema,
  packageId: z
    .union([z.uuid(), z.literal("")])
    .optional()
    .default(""),
  countryCode: z
    .union([
      z
        .string()
        .trim()
        .toUpperCase()
        .regex(/^[A-Z]{2}$/),
      z.literal(""),
    ])
    .optional()
    .default(""),
  startDate: z
    .union([z.iso.date(), z.literal("")])
    .optional()
    .default(""),
  weekdays: z.array(z.coerce.number().int().min(0).max(6)).max(7).optional().default([]),
  localStartTime: z
    .union([z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), z.literal("")])
    .optional()
    .default(""),
  durationMin: z.coerce.number().int().min(10).max(120).optional().default(45),
  teacherWeekdays: z.array(z.coerce.number().int().min(0).max(6)).max(7).optional().default([]),
  teacherStartTime: z
    .union([z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), z.literal("")])
    .optional()
    .default(""),
  teacherEndTime: z
    .union([z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), z.literal("")])
    .optional()
    .default(""),
  parentStudentId: z
    .union([z.uuid(), z.literal("")])
    .optional()
    .default(""),
  parentRelation: z.enum(["father", "mother", "guardian"]).optional().default("guardian"),
};

export const createManagedAccountSchema = z
  .discriminatedUnion("mode", [
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
  ])
  .superRefine((value, context) => {
    if (value.role === "admin" && value.mode !== "invite") {
      context.addIssue({ code: "custom", message: "admin_invite_required", path: ["mode"] });
    }
    if (value.role === "student") {
      const subscriptionFields = [value.packageId, value.countryCode, value.startDate];
      const hasSomeSubscription = subscriptionFields.some(Boolean);
      if (hasSomeSubscription && !subscriptionFields.every(Boolean)) {
        context.addIssue({
          code: "custom",
          message: "subscription_fields_incomplete",
          path: ["packageId"],
        });
      }
      const hasSomeSchedule = value.weekdays.length > 0 || Boolean(value.localStartTime);
      if (hasSomeSchedule && (!value.weekdays.length || !value.localStartTime)) {
        context.addIssue({
          code: "custom",
          message: "schedule_fields_incomplete",
          path: ["weekdays"],
        });
      }
    }
    if (value.role === "teacher") {
      const hasAvailability =
        value.teacherWeekdays.length > 0 || value.teacherStartTime || value.teacherEndTime;
      if (
        hasAvailability &&
        (!value.teacherWeekdays.length ||
          !value.teacherStartTime ||
          !value.teacherEndTime ||
          value.teacherStartTime >= value.teacherEndTime)
      ) {
        context.addIssue({
          code: "custom",
          message: "teacher_availability_incomplete",
          path: ["teacherWeekdays"],
        });
      }
    }
    if (value.role === "parent" && !value.parentStudentId) {
      context.addIssue({
        code: "custom",
        message: "parent_student_required",
        path: ["parentStudentId"],
      });
    }
  });

export const setAccountActiveSchema = z.object({
  profileId: z.uuid(),
  isActive: z.enum(["true", "false"]).transform((value) => value === "true"),
});

export type ManagedRole = z.infer<typeof managedRoleSchema>;
