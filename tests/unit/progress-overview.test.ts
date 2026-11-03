import { describe, expect, it } from "vitest";

import { calculateProgressSummary } from "../../lib/progress/overview-calculations";

const pages = [
  { page: 1, juz: 1, firstSurahId: 1, lastSurahId: 1 },
  { page: 2, juz: 1, firstSurahId: 2, lastSurahId: 2 },
  { page: 3, juz: 2, firstSurahId: 2, lastSurahId: 2 },
  { page: 4, juz: 2, firstSurahId: 2, lastSurahId: 3 },
];

describe("student progress overview calculations", () => {
  it("uses the most recently updated active page to identify the current juz", () => {
    const summary = calculateProgressSummary(pages, [
      { page: 1, status: "mastered", updated_at: "2026-01-01T00:00:00Z" },
      { page: 3, status: "in_progress", updated_at: "2026-02-01T00:00:00Z" },
      { page: 4, status: "mastered", updated_at: "2026-01-15T00:00:00Z" },
    ]);

    expect(summary.currentJuz).toEqual({
      number: 2,
      masteredPages: 1,
      totalPages: 2,
      surahCount: 2,
      percent: 50,
    });
    expect(summary.overall.masteredPages).toBe(2);
  });

  it("returns a stable empty summary without inventing progress", () => {
    const summary = calculateProgressSummary(pages, []);
    expect(summary.currentJuz.number).toBe(1);
    expect(summary.currentJuz.percent).toBe(0);
    expect(summary.overall).toEqual({ masteredPages: 0, percent: 0 });
  });
});
