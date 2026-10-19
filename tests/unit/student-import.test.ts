import { describe, expect, it } from "vitest";

import { validateStudentImportRows } from "../../lib/validators/student-import";

const level = {
  id: "d1000000-0000-4000-8000-000000000001",
  nameAr: "المستوى الأول",
  nameEn: "Level one",
  trackCode: "quran",
};

function row(name = "Imported Student") {
  return [
    name,
    "male",
    "2014-01-01",
    "2026-10-19",
    "eg",
    "Africa/Cairo",
    "quran",
    "Level one",
    "",
    "",
    "false",
  ];
}

describe("student import validation", () => {
  it("normalizes a valid workbook row and resolves its active level", () => {
    const result = validateStudentImportRows([row()], [level], []);

    expect(result.errors).toEqual([]);
    expect(result.payload[0]).toMatchObject({
      country_code: "EG",
      level_id: level.id,
      share_with_teacher: false,
    });
  });

  it("rejects duplicates inside the workbook", () => {
    const result = validateStudentImportRows([row(), row(" imported student ")], [level], []);

    expect(result.errors).toContainEqual({
      row: 3,
      column: "full_name",
      code: "duplicate_student",
    });
    expect(result.payload).toHaveLength(1);
  });

  it("rejects a student already stored in the academy", () => {
    const result = validateStudentImportRows(
      [row()],
      [level],
      [{ fullName: "Imported Student", birthDate: "2014-01-01" }],
    );

    expect(result.errors).toContainEqual({
      row: 2,
      column: "full_name",
      code: "duplicate_student",
    });
  });

  it("requires a matching track and active level pair", () => {
    const invalid = row();
    invalid[7] = "Unknown level";
    const result = validateStudentImportRows([invalid], [level], []);

    expect(result.errors).toContainEqual({ row: 2, column: "level_name", code: "unknown_level" });
  });

  it("reports invalid booleans and required fields with spreadsheet row numbers", () => {
    const invalid = row("");
    invalid[10] = "yes";
    const result = validateStudentImportRows([invalid], [level], []);

    expect(
      result.errors.some((error) => error.row === 2 && error.column === "share_with_teacher"),
    ).toBe(true);
    expect(result.errors.some((error) => error.row === 2 && error.column === "fullName")).toBe(
      true,
    );
    expect(result.payload).toEqual([]);
  });
});
