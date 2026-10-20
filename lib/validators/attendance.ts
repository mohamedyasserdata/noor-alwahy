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
  status: z.enum(attendanceStatuses),
});

export type AttendanceStatus = (typeof attendanceStatuses)[number];

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
