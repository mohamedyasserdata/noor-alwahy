import { z } from "zod";

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
