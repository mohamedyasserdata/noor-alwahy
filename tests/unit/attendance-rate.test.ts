import { describe, expect, it } from "vitest";

import { calculateStudentAttendance } from "../../lib/attendance/rate";

describe("calculateStudentAttendance", () => {
  it("counts only outcomes the student is responsible for", () => {
    expect(
      calculateStudentAttendance([
        { status: "present" },
        { status: "late" },
        { status: "student_absent" },
        { status: "student_excused" },
        { status: "teacher_absent" },
        { status: "cancelled_teacher" },
        { status: "cancelled_admin" },
        { status: "scheduled" },
      ]),
    ).toEqual({
      absent: 1,
      excused: 1,
      late: 1,
      present: 1,
      rate: 50,
      total: 4,
    });
  });

  it("returns no rate when there are no eligible sessions", () => {
    expect(
      calculateStudentAttendance([{ status: "teacher_absent" }, { status: "cancelled_teacher" }]),
    ).toMatchObject({ rate: null, total: 0 });
  });
});
