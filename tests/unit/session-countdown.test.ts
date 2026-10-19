import { describe, expect, it } from "vitest";

import { formatCountdown, getJoinWindowState } from "../../lib/sessions/countdown";

const minute = 60_000;
const start = 1_000_000;
const end = start + 30 * minute;

describe("getJoinWindowState", () => {
  it("keeps the join action closed eleven minutes before start", () => {
    expect(getJoinWindowState(start - 11 * minute, start, end)).toEqual({
      phase: "before",
      remainingSeconds: 60,
      canJoin: false,
    });
  });

  it("opens at ten minutes before start and remains open through fifteen minutes after end", () => {
    expect(getJoinWindowState(start - 10 * minute, start, end).canJoin).toBe(true);
    expect(getJoinWindowState(end + 15 * minute, start, end).canJoin).toBe(true);
  });

  it("closes after the approved window", () => {
    expect(getJoinWindowState(end + 15 * minute + 1, start, end)).toEqual({
      phase: "closed",
      remainingSeconds: 0,
      canJoin: false,
    });
  });
});

describe("formatCountdown", () => {
  it("formats a stable hour-minute-second countdown", () => {
    expect(formatCountdown(3661)).toBe("01:01:01");
  });
});
