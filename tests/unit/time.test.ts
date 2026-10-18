import { describe, expect, it } from "vitest";

import {
  isValidTimeZone,
  utcToWallClock,
  wallClockToUtc,
  type UtcToWallClockResult,
  type WallClockToUtcResult,
} from "../../lib/time";

function expectWallClockSuccess(result: WallClockToUtcResult) {
  expect(result.ok).toBe(true);

  if (!result.ok) {
    throw new Error(result.error.code);
  }

  return result.value;
}

function expectUtcSuccess(result: UtcToWallClockResult) {
  expect(result.ok).toBe(true);

  if (!result.ok) {
    throw new Error(result.error.code);
  }

  return result.value;
}

describe("wallClockToUtc", () => {
  it("rejects unsupported zones and malformed calendar values", () => {
    expect(isValidTimeZone("Africa/Cairo")).toBe(true);
    expect(isValidTimeZone("UTC+02:00")).toBe(false);

    expect(
      wallClockToUtc({
        date: "2026-02-30",
        time: "10:00",
        timeZone: "Africa/Cairo",
      }),
    ).toMatchObject({ ok: false, error: { code: "invalid_wall_clock" } });

    expect(
      wallClockToUtc({
        date: "2026-04-24",
        time: "10:00",
        timeZone: "UTC+02:00",
      }),
    ).toMatchObject({ ok: false, error: { code: "invalid_time_zone" } });
  });

  it("rejects Cairo's nonexistent spring-forward wall-clock instead of shifting it", () => {
    const result = wallClockToUtc({
      date: "2026-04-24",
      time: "00:30",
      timeZone: "Africa/Cairo",
    });

    expect(result).toMatchObject({
      ok: false,
      error: { code: "nonexistent_local_time" },
    });
  });

  it("requires an explicit choice for Cairo's repeated fall-back wall-clock", () => {
    const rejected = wallClockToUtc({
      date: "2026-10-29",
      time: "23:30",
      timeZone: "Africa/Cairo",
    });

    expect(rejected).toEqual({
      ok: false,
      error: {
        code: "ambiguous_local_time",
        date: "2026-10-29",
        time: "23:30",
        timeZone: "Africa/Cairo",
        choices: [
          { utcIso: "2026-10-29T20:30:00.000Z", offsetMinutes: 180 },
          { utcIso: "2026-10-29T21:30:00.000Z", offsetMinutes: 120 },
        ],
      },
    });

    expect(
      expectWallClockSuccess(
        wallClockToUtc({
          date: "2026-10-29",
          time: "23:30",
          timeZone: "Africa/Cairo",
          ambiguousTime: "earlier",
        }),
      ),
    ).toEqual({
      utcIso: "2026-10-29T20:30:00.000Z",
      timeZone: "Africa/Cairo",
      offsetMinutes: 180,
      resolution: "earlier",
    });

    expect(
      expectWallClockSuccess(
        wallClockToUtc({
          date: "2026-10-29",
          time: "23:30",
          timeZone: "Africa/Cairo",
          ambiguousTime: "later",
        }),
      ),
    ).toEqual({
      utcIso: "2026-10-29T21:30:00.000Z",
      timeZone: "Africa/Cairo",
      offsetMinutes: 120,
      resolution: "later",
    });
  });

  it("applies Cairo's 2026 summer offset on either side of the transition", () => {
    const before = expectWallClockSuccess(
      wallClockToUtc({
        date: "2026-04-23",
        time: "23:30",
        timeZone: "Africa/Cairo",
      }),
    );
    const after = expectWallClockSuccess(
      wallClockToUtc({
        date: "2026-04-24",
        time: "01:30",
        timeZone: "Africa/Cairo",
      }),
    );

    expect(before).toMatchObject({
      utcIso: "2026-04-23T21:30:00.000Z",
      offsetMinutes: 120,
      resolution: "exact",
    });
    expect(after).toMatchObject({
      utcIso: "2026-04-23T22:30:00.000Z",
      offsetMinutes: 180,
      resolution: "exact",
    });
  });

  it.each([
    ["Asia/Riyadh", 180, "2026-04-23T20:30:00.000Z", "2026-10-29T20:30:00.000Z"],
    ["Asia/Dubai", 240, "2026-04-23T19:30:00.000Z", "2026-10-29T19:30:00.000Z"],
  ])(
    "keeps %s at a fixed offset around Cairo's DST transition dates",
    (timeZone, offsetMinutes, springUtc, autumnUtc) => {
      const spring = expectWallClockSuccess(
        wallClockToUtc({ date: "2026-04-23", time: "23:30", timeZone }),
      );
      const autumn = expectWallClockSuccess(
        wallClockToUtc({ date: "2026-10-29", time: "23:30", timeZone }),
      );

      expect(spring).toMatchObject({ utcIso: springUtc, offsetMinutes });
      expect(autumn).toMatchObject({ utcIso: autumnUtc, offsetMinutes });
    },
  );
});

describe("utcToWallClock", () => {
  it("converts canonical UTC to the user's local IANA zone", () => {
    expect(
      expectUtcSuccess(
        utcToWallClock({
          utcIso: "2026-04-23T22:30:00.000Z",
          timeZone: "Africa/Cairo",
        }),
      ),
    ).toEqual({
      date: "2026-04-24",
      time: "01:30:00",
      timeZone: "Africa/Cairo",
      offsetMinutes: 180,
      isoLocal: "2026-04-24T01:30:00.000+03:00",
    });
  });

  it("rejects timestamps without an explicit zero offset", () => {
    expect(
      utcToWallClock({
        utcIso: "2026-04-23T22:30:00",
        timeZone: "Africa/Cairo",
      }),
    ).toMatchObject({ ok: false, error: { code: "invalid_utc_timestamp" } });

    expect(
      utcToWallClock({
        utcIso: "2026-04-23T22:30:00+01:00",
        timeZone: "Africa/Cairo",
      }),
    ).toMatchObject({ ok: false, error: { code: "invalid_utc_timestamp" } });
  });
});
