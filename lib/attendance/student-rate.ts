import type { AttendanceStatus } from "@/lib/validators/attendance";

export const studentAttendanceRateStatuses = [
  "present",
  "late",
  "student_absent",
  "student_excused",
] as const satisfies readonly AttendanceStatus[];

const eligibleStatuses = new Set<AttendanceStatus>(studentAttendanceRateStatuses);

export function summarizeStudentAttendance(statuses: readonly AttendanceStatus[]) {
  let present = 0;
  let late = 0;
  let absent = 0;
  let excused = 0;

  for (const status of statuses) {
    if (!eligibleStatuses.has(status)) continue;
    if (status === "present") present += 1;
    if (status === "late") late += 1;
    if (status === "student_absent") absent += 1;
    if (status === "student_excused") excused += 1;
  }

  const total = present + late + absent + excused;

  return {
    total,
    present,
    late,
    absent,
    excused,
    rate: total ? Math.round(((present + late) * 10_000) / total) / 100 : null,
  };
}
