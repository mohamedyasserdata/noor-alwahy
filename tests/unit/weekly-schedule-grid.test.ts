import { describe, expect, it } from "vitest";

import { buildWeeklyScheduleGrid } from "../../lib/schedules/weekly-grid";

describe("WeeklyScheduleGrid", () => {
  it("groups simultaneous lessons and shows the count to administrators", () => {
    const grid = buildWeeklyScheduleGrid([
      slot("00000000-0000-4000-8000-000000000001", "Student One"),
      slot("00000000-0000-4000-8000-000000000002", "Student Two"),
    ]);

    expect(grid.times).toEqual(["10:00"]);
    expect(grid.slotsByCell.get("1-10:00")).toHaveLength(2);
    expect(grid.slotsByCell.get("1-10:00")?.map((item) => item.student_name)).toEqual([
      "Student One",
      "Student Two",
    ]);
  });
});

function slot(id: string, student: string) {
  return {
    slot_id: id,
    student_name: student,
    teacher_name: "Teacher One",
    track_name_ar: "حفظ",
    track_name_en: "Memorisation",
    weekday: 1,
    local_start_time: "10:00:00",
    duration_min: 45,
    anchor_timezone: "Africa/Cairo",
    viewer: { weekday: 1, time: "10:00:00" },
  };
}
