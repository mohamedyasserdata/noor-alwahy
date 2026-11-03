export const studentAttendanceStatuses = [
  "present",
  "late",
  "student_absent",
  "student_excused",
] as const;

export type StudentAttendanceStatus = (typeof studentAttendanceStatuses)[number];

type AttendanceRecord = {
  status: string;
};

export type StudentAttendanceSummary = {
  absent: number;
  excused: number;
  late: number;
  present: number;
  rate: number | null;
  total: number;
};

const eligibleStatuses = new Set<string>(studentAttendanceStatuses);

export function calculateStudentAttendance(
  records: readonly AttendanceRecord[],
): StudentAttendanceSummary {
  let present = 0;
  let late = 0;
  let absent = 0;
  let excused = 0;

  for (const record of records) {
    if (!eligibleStatuses.has(record.status)) continue;
    if (record.status === "present") present += 1;
    else if (record.status === "late") late += 1;
    else if (record.status === "student_absent") absent += 1;
    else if (record.status === "student_excused") excused += 1;
  }

  const total = present + late + absent + excused;
  return {
    absent,
    excused,
    late,
    present,
    rate: total ? Math.round(((present + late) * 10000) / total) / 100 : null,
    total,
  };
}
