import { DateTime } from "luxon";

import { utcToWallClock, wallClockToUtc } from "../time";

export function convertNextOccurrence(input: {
  weekday: number;
  time: string;
  anchorTimezone: string;
  viewerTimezone: string;
}) {
  const today = DateTime.now().setZone(input.anchorTimezone).startOf("day");
  const luxonWeekday = input.weekday === 0 ? 7 : input.weekday;
  const delta = (luxonWeekday - today.weekday + 7) % 7;
  for (const extraDays of [delta, delta + 7]) {
    const date = today.plus({ days: extraDays }).toFormat("yyyy-LL-dd");
    const utc = wallClockToUtc({ date, time: input.time, timeZone: input.anchorTimezone });
    if (!utc.ok) continue;
    const local = utcToWallClock({ utcIso: utc.value.utcIso, timeZone: input.viewerTimezone });
    if (local.ok)
      return {
        ...local.value,
        weekday: DateTime.fromISO(local.value.isoLocal, { setZone: true }).weekday % 7,
      };
  }
  return null;
}
