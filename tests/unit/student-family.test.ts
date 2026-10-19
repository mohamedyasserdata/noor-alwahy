import { describe, expect, it } from "vitest";

import {
  familyAccountSchema,
  guardianLinkSchema,
  removeGuardianLinkSchema,
} from "../../lib/validators/student-family";

const studentId = "b4000000-0000-4000-8000-000000000001";
const parentProfileId = "b1000000-0000-4000-8000-000000000001";

describe("student family boundaries", () => {
  it("normalizes guardian flags and an optional relationship", () => {
    expect(
      guardianLinkSchema.parse({
        studentId,
        parentProfileId,
        relation: "  Father  ",
        isPrimary: "true",
        isPayer: "false",
      }),
    ).toMatchObject({ relation: "Father", isPrimary: true, isPayer: false });
  });

  it("accepts only parent and student account roles", () => {
    const account = {
      studentId,
      fullName: "Family Account",
      email: "family@example.test",
      temporaryPassword: "FamilyTest12!",
      relation: "Parent",
      isPrimary: "false",
      isPayer: "true",
    };
    expect(familyAccountSchema.safeParse({ ...account, role: "parent" }).success).toBe(true);
    expect(familyAccountSchema.safeParse({ ...account, role: "teacher" }).success).toBe(false);
  });

  it("rejects weak passwords and malformed relationship identifiers", () => {
    expect(
      familyAccountSchema.safeParse({
        studentId,
        role: "student",
        fullName: "Student Account",
        email: "student@example.test",
        temporaryPassword: "short",
        isPrimary: "false",
        isPayer: "false",
      }).success,
    ).toBe(false);
    expect(removeGuardianLinkSchema.safeParse({ studentId, guardianId: "bad" }).success).toBe(
      false,
    );
  });
});
