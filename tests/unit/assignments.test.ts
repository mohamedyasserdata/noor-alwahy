import { describe, expect, it } from "vitest";

import {
  assignmentActionSchema,
  assignmentSelectionSchema,
} from "../../lib/validators/assignments";

const ids = {
  studentId: "f7300000-0000-4000-8000-000000000001",
  teacherId: "f7200000-0000-4000-8000-000000000001",
  trackId: "f7100000-0000-4000-8000-000000000001",
};

describe("assignment validation", () => {
  it("accepts a valid candidate selection", () => {
    expect(assignmentSelectionSchema.safeParse(ids).success).toBe(true);
  });

  it("requires an explicit assignment reason", () => {
    expect(
      assignmentActionSchema.safeParse({ ...ids, action: "assign", reason: " " }).success,
    ).toBe(false);
  });

  it("allows only defined workflow actions", () => {
    expect(
      assignmentActionSchema.safeParse({ ...ids, action: "replace", reason: "Approved" }).success,
    ).toBe(false);
  });
});
