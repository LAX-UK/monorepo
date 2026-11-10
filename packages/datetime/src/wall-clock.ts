import { offsetMinutes } from "./offset.js";

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

/** A typed wall-clock time read in a zone: the instant, or why there is none. */
export type WallClockResult =
  | { ok: true; instant: Date }
  | { ok: false; reason: "invalid" | "gap" };

function parseWall(day: string, time: string): number | null {
  const date = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day.trim());
  const clock = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!date || !clock) return null;
  const [y, m, d] = [Number(date[1]), Number(date[2]), Number(date[3])];
  const [hh, mm] = [Number(clock[1]), Number(clock[2])];
  if (hh > 23 || mm > 59) return null;
  const wall = Date.UTC(y, m - 1, d, hh, mm);
  const check = new Date(wall);
  return check.getUTCMonth() === m - 1 && check.getUTCDate() === d ? wall : null;
}

/**
 * The instant a wall-clock day and time ("2030-11-12", "18:00") means in `zone`. The one place
 * wall time becomes an instant: candidate offsets are those in force a day either side, and one
 * is right when the instant it gives is itself on that offset. In the hour clocks repeat, the
 * earlier instant (the larger offset) wins; in the hour they skip, no offset fits and the result
 * is a gap. Correct for every zone, ahead of UTC or behind it.
 */
export function wallClockToInstant(day: string, time: string, zone: string): WallClockResult {
  const wall = parseWall(day, time);
  if (wall === null) return { ok: false, reason: "invalid" };
  const offsets = new Set(
    [-DAY, 0, DAY].map((shift) => offsetMinutes(new Date(wall + shift), zone)),
  );
  const fitting = [...offsets]
    .filter((offset) => offsetMinutes(new Date(wall - offset * MINUTE), zone) === offset)
    .sort((a, b) => b - a);
  const offset = fitting[0];
  return offset === undefined
    ? { ok: false, reason: "gap" }
    : { ok: true, instant: new Date(wall - offset * MINUTE) };
}

/** The day ("2030-11-12") and time ("18:00") on the clock in `zone` at an instant. */
export function instantToWallClock(instant: Date, zone: string): { day: string; time: string } {
  const wall = new Date(instant.getTime() + offsetMinutes(instant, zone) * MINUTE).toISOString();
  return { day: wall.slice(0, 10), time: wall.slice(11, 16) };
}

/**
 * The instant that reads the same on the clock in `toZone` as `instant` does in `fromZone`: a
 * lot's 18:00 stays 18:00 when its sale moves zone. A time `toZone` skips moves to the first time
 * after the gap. Moving an instant between two zones is how a stored moment follows a re-zoned
 * sale; staggered moments stay staggered on the wall clock.
 */
export function reinterpretInZone(instant: Date, fromZone: string, toZone: string): Date {
  const { day, time } = instantToWallClock(instant, fromZone);
  const exact = wallClockToInstant(day, time, toZone);
  if (exact.ok) return exact.instant;
  const next = firstExistingWallTime(day, time, toZone);
  const shifted = next ? wallClockToInstant(day, next, toZone) : null;
  return shifted?.ok ? shifted.instant : instant;
}

/**
 * The lots as they stand once their sale moves from `fromZone` to `toZone`: every draft lot keeps
 * its wall-clock opening and closing (each moved on its own, so the stagger survives); lots that
 * are no longer drafts keep their instants. One rule for the server's save and for every check the
 * form runs before it, so a zone change is never judged against the old clock.
 */
export function lotsAfterSaleZoneChange<
  T extends { status: string; startTime: Date; endTime: Date },
>(lots: readonly T[], fromZone: string, toZone: string): T[] {
  if (fromZone === toZone) return [...lots];
  return lots.map((lot) =>
    lot.status === "draft"
      ? {
          ...lot,
          startTime: reinterpretInZone(lot.startTime, fromZone, toZone),
          endTime: reinterpretInZone(lot.endTime, fromZone, toZone),
        }
      : lot,
  );
}

/**
 * The earliest time at or after `time` that exists on `day` in `zone`: the same time on an
 * ordinary day, the end of the skipped hour in a gap. Null when none is found within three hours.
 */
export function firstExistingWallTime(day: string, time: string, zone: string): string | null {
  const clock = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!clock) return null;
  const start = Number(clock[1]) * 60 + Number(clock[2]);
  for (let step = 0; step <= 180; step += 1) {
    const total = start + step;
    const hours = String(Math.floor(total / 60) % 24).padStart(2, "0");
    const candidate = `${hours}:${String(total % 60).padStart(2, "0")}`;
    if (wallClockToInstant(day, candidate, zone).ok) return candidate;
  }
  return null;
}
