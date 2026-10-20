import { describe, expect, it } from "vitest";

import { reportDraftSchema } from "../../lib/validators/report";

const valid = {
  studentId: "10000000-0000-4000-8000-000000000003",
  periodType: "weekly",
  periodStart: "2026-10-05",
  periodEnd: "2026-10-11",
  summary: "Steady progress",
  strengths: "Commitment",
  improve: "Daily review",
  plan: "Two pages",
  recommendation: "Continue",
};

describe("report draft validation", () => {
  it("accepts a bounded weekly report", () => {
    expect(reportDraftSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects reversed or overlong periods", () => {
    expect(reportDraftSchema.safeParse({ ...valid, periodEnd: "2026-10-04" }).success).toBe(false);
    expect(reportDraftSchema.safeParse({ ...valid, periodEnd: "2026-12-01" }).success).toBe(false);
  });

  it("requires every educational judgement field", () => {
    expect(reportDraftSchema.safeParse({ ...valid, summary: "" }).success).toBe(false);
  });
});
