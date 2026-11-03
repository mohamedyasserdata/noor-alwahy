import { z } from "zod";

import { DateTime } from "luxon";

export const attendanceStatuses = [
  "present",
  "late",
  "student_absent",
  "student_excused",
  "teacher_absent",
  "cancelled_teacher",
  "cancelled_admin",
] as const;

export const recordAttendanceSchema = z.object({
  sessionId: z.string().uuid(),
  studentId: z.preprocess(
    (value) => (value === "" || value === null ? undefined : value),
    z.string().uuid().optional(),
  ),
  status: z.enum(attendanceStatuses),
  correctionReason: z.preprocess(
    (value) =>
      value === null || (typeof value === "string" && value.trim() === "") ? undefined : value,
    z.string().trim().min(2).max(1000).optional(),
  ),
});

export type AttendanceStatus = (typeof attendanceStatuses)[number];

export const teacherAttendanceStatuses = ["present", "late", "absent", "excused"] as const;

export const recordTeacherAttendanceSchema = z.object({
  sessionId: z.string().uuid(),
  status: z.enum(teacherAttendanceStatuses),
  minutes: z.preprocess(
    (value) => (value === "" || value === null ? undefined : value),
    z.coerce.number().int().min(0).max(240).optional(),
  ),
  note: z.preprocess(
    (value) =>
      value === null || (typeof value === "string" && value.trim() === "") ? undefined : value,
    z.string().trim().min(2).max(1000).optional(),
  ),
});

export type TeacherAttendanceStatus = (typeof teacherAttendanceStatuses)[number];

export const attendanceReportPeriods = ["daily", "weekly", "monthly"] as const;

export const attendanceReportFilterSchema = z.object({
  period: z.enum(attendanceReportPeriods).catch("monthly"),
  anchor: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine((value) => DateTime.fromISO(value, { zone: "Africa/Cairo" }).isValid)
    .catch(() => DateTime.now().setZone("Africa/Cairo").toISODate() ?? "1970-01-01"),
});

export type AttendanceReportFilters = z.infer<typeof attendanceReportFilterSchema>;

export function parseAttendanceReportFilters(
  params: Record<string, string | string[] | undefined>,
): AttendanceReportFilters {
  return attendanceReportFilterSchema.parse({
    period: first(params.period),
    anchor: first(params.anchor),
  });
}

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
