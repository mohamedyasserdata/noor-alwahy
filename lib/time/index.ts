import { DateTime, IANAZone } from "luxon";

export type AmbiguousTimeResolution = "reject" | "earlier" | "later";

export type WallClockInput = {
  date: string;
  time: string;
  timeZone: string;
  ambiguousTime?: AmbiguousTimeResolution;
};

export type WallClockToUtcValue = {
  utcIso: string;
  timeZone: string;
  offsetMinutes: number;
  resolution: "exact" | "earlier" | "later";
};

export type UtcToWallClockValue = {
  date: string;
  time: string;
  timeZone: string;
  offsetMinutes: number;
  isoLocal: string;
};

export type TimeConversionError =
  | { code: "invalid_time_zone"; timeZone: string }
  | { code: "invalid_wall_clock"; date: string; time: string }
  | { code: "nonexistent_local_time"; date: string; time: string; timeZone: string }
  | {
      code: "ambiguous_local_time";
      date: string;
      time: string;
      timeZone: string;
      choices: Array<{ utcIso: string; offsetMinutes: number }>;
    }
  | { code: "invalid_utc_timestamp"; utcIso: string };

export type WallClockToUtcResult =
  { ok: true; value: WallClockToUtcValue } | { ok: false; error: TimeConversionError };

export type UtcToWallClockResult =
  { ok: true; value: UtcToWallClockValue } | { ok: false; error: TimeConversionError };

type WallClockParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_PATTERN = /^(\d{2}):(\d{2})(?::(\d{2}))?$/;
const EXPLICIT_OFFSET_PATTERN = /(Z|[+-]\d{2}:\d{2})$/i;

function parseWallClock(date: string, time: string): WallClockParts | null {
  const dateMatch = DATE_PATTERN.exec(date);
  const timeMatch = TIME_PATTERN.exec(time);

  if (!dateMatch || !timeMatch) {
    return null;
  }

  return {
    year: Number(dateMatch[1]),
    month: Number(dateMatch[2]),
    day: Number(dateMatch[3]),
    hour: Number(timeMatch[1]),
    minute: Number(timeMatch[2]),
    second: Number(timeMatch[3] ?? 0),
  };
}

function hasSameWallClock(dateTime: DateTime, parts: WallClockParts) {
  return (
    dateTime.year === parts.year &&
    dateTime.month === parts.month &&
    dateTime.day === parts.day &&
    dateTime.hour === parts.hour &&
    dateTime.minute === parts.minute &&
    dateTime.second === parts.second
  );
}

function asUtcChoice(dateTime: DateTime<true>) {
  return {
    utcIso: dateTime.toUTC().toISO(),
    offsetMinutes: dateTime.offset,
  };
}

export function isValidTimeZone(timeZone: string) {
  return IANAZone.isValidZone(timeZone);
}

/**
 * Converts an explicit local calendar time in an IANA zone to a canonical UTC instant.
 * Missing DST times are always rejected. Repeated DST times are rejected unless the caller
 * deliberately chooses the earlier or later instant.
 */
export function wallClockToUtc(input: WallClockInput): WallClockToUtcResult {
  if (!isValidTimeZone(input.timeZone)) {
    return {
      ok: false,
      error: { code: "invalid_time_zone", timeZone: input.timeZone },
    };
  }

  const parts = parseWallClock(input.date, input.time);

  if (!parts) {
    return {
      ok: false,
      error: { code: "invalid_wall_clock", date: input.date, time: input.time },
    };
  }

  const localDateTime = DateTime.fromObject(parts, { zone: input.timeZone });

  if (!localDateTime.isValid) {
    return {
      ok: false,
      error: { code: "invalid_wall_clock", date: input.date, time: input.time },
    };
  }

  // Luxon advances a missing spring-forward time. Comparing the requested calendar fields
  // catches that normalization so scheduling code never moves a lesson silently.
  if (!hasSameWallClock(localDateTime, parts)) {
    return {
      ok: false,
      error: {
        code: "nonexistent_local_time",
        date: input.date,
        time: input.time,
        timeZone: input.timeZone,
      },
    };
  }

  const possibleInstants = localDateTime
    .getPossibleOffsets()
    .sort((first, second) => first.toMillis() - second.toMillis());

  if (possibleInstants.length > 1 && (input.ambiguousTime ?? "reject") === "reject") {
    return {
      ok: false,
      error: {
        code: "ambiguous_local_time",
        date: input.date,
        time: input.time,
        timeZone: input.timeZone,
        choices: possibleInstants.map(asUtcChoice),
      },
    };
  }

  const resolution = input.ambiguousTime === "later" ? "later" : "earlier";
  const selected = resolution === "later" ? possibleInstants.at(-1) : possibleInstants[0];

  if (!selected) {
    return {
      ok: false,
      error: { code: "invalid_wall_clock", date: input.date, time: input.time },
    };
  }

  const utcChoice = asUtcChoice(selected);

  return {
    ok: true,
    value: {
      ...utcChoice,
      timeZone: input.timeZone,
      resolution: possibleInstants.length > 1 ? resolution : "exact",
    },
  };
}

/** Converts a stored ISO timestamp with an explicit zero offset to a local IANA wall-clock. */
export function utcToWallClock(input: { utcIso: string; timeZone: string }): UtcToWallClockResult {
  if (!isValidTimeZone(input.timeZone)) {
    return {
      ok: false,
      error: { code: "invalid_time_zone", timeZone: input.timeZone },
    };
  }

  if (!EXPLICIT_OFFSET_PATTERN.test(input.utcIso)) {
    return {
      ok: false,
      error: { code: "invalid_utc_timestamp", utcIso: input.utcIso },
    };
  }

  const parsed = DateTime.fromISO(input.utcIso, { setZone: true });

  if (!parsed.isValid || parsed.offset !== 0) {
    return {
      ok: false,
      error: { code: "invalid_utc_timestamp", utcIso: input.utcIso },
    };
  }

  const local = parsed.setZone(input.timeZone);

  if (!local.isValid) {
    return {
      ok: false,
      error: { code: "invalid_time_zone", timeZone: input.timeZone },
    };
  }

  return {
    ok: true,
    value: {
      date: local.toFormat("yyyy-LL-dd"),
      time: local.toFormat("HH:mm:ss"),
      timeZone: input.timeZone,
      offsetMinutes: local.offset,
      isoLocal: local.toISO(),
    },
  };
}
