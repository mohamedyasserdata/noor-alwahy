import { describe, expect, it } from "vitest";

import { summarizeStudentAttendance } from "../../lib/attendance/student-rate";
import type { AttendanceStatus } from "../../lib/validators/attendance";

describe("student attendance rate", () => {
  it("uses the same eligible student outcomes for student and guardian views", () => {
    const statuses: AttendanceStatus[] = [
      "present",
      "late",
      "student_absent",
      "student_excused",
      "teacher_absent",
      "cancelled_teacher",
      "cancelled_admin",
    ];

    const studentRate = summarizeStudentAttendance(statuses).rate;
    const guardianRate = summarizeStudentAttendance(statuses).rate;

    expect(studentRate).toBe(50);
    expect(guardianRate).toBe(studentRate);
  });

  it("excludes teacher and administration outcomes from the denominator", () => {
    expect(
      summarizeStudentAttendance(["teacher_absent", "cancelled_teacher", "cancelled_admin"]),
    ).toEqual({
      total: 0,
      present: 0,
      late: 0,
      absent: 0,
      excused: 0,
      rate: null,
    });
  });

  it("returns the shared counts and rounds the rate to two decimal places", () => {
    expect(summarizeStudentAttendance(["present", "late", "student_absent"])).toEqual({
      total: 3,
      present: 1,
      late: 1,
      absent: 1,
      excused: 0,
      rate: 66.67,
    });
  });
});
