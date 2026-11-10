import { offsetMinutes } from "./offset.js";
import { shortZoneName } from "./zone-formats.js";

const MINUTE = 60_000;
const SCAN_STEP = 15 * MINUTE;

type Transition = { instant: number; before: number; after: number };

function offsetAt(instant: number, zone: string): number {
  return offsetMinutes(new Date(instant), zone);
}

/** The first minute at or after `lo`'s successor where the offset differs from `lo`'s. */
function exactMinute(lo: number, hi: number, zone: string): number {
  const before = offsetAt(lo, zone);
  let low = lo;
  let high = hi;
  while (high - low > MINUTE) {
    const mid = Math.floor((low + high) / 2 / MINUTE) * MINUTE;
    if (mid <= low) break;
    if (offsetAt(mid, zone) === before) low = mid;
    else high = mid;
  }
  return high;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function wallClock(instant: number, offset: number): string {
  const wall = new Date(instant + offset * MINUTE);
  return `${pad(wall.getUTCHours())}:${pad(wall.getUTCMinutes())}`;
}

function wallDay(instant: number, offset: number): string {
  return new Date(instant + offset * MINUTE).toISOString().slice(0, 10);
}

/** The moment the clocks in `zone` change during the calendar day `day`, or null. */
function transitionOn(day: string, zone: string): Transition | null {
  const [y, m, d] = day.split("-").map(Number);
  if (!y || !m || !d) return null;
  // Start 15 hours early so the whole local day is covered at any offset up to +14:00.
  let previous = Date.UTC(y, m - 1, d) - 15 * 60 * MINUTE;
  const end = previous + 48 * 60 * MINUTE;
  for (let t = previous + SCAN_STEP; t <= end; t += SCAN_STEP) {
    if (offsetAt(previous, zone) !== offsetAt(t, zone)) {
      const instant = exactMinute(previous, t, zone);
      const before = offsetAt(instant - MINUTE, zone);
      const after = offsetAt(instant, zone);
      if (wallDay(instant, after) === day) return { instant, before, after };
    }
    previous = t;
  }
  return null;
}

/** "forward" or "back" when the clocks in `zone` change during that calendar day, else null. */
export function clockChange(day: string, zone: string): "forward" | "back" | null {
  const transition = transitionOn(day, zone);
  if (!transition) return null;
  return transition.after > transition.before ? "forward" : "back";
}

function lengthWords(minutes: number): string {
  if (minutes === 60) return "an hour";
  if (minutes === 30) return "half an hour";
  return `${minutes} minutes`;
}

/**
 * The line shown under a sale time on a day the clocks change in `zone`, naming the skipped or
 * repeated times, or null on any other day. "Clocks go forward an hour on this day (GMT to BST):
 * there is no 01:00 to 01:59."
 */
export function clockChangeNotice(day: string, zone: string): string | null {
  const transition = transitionOn(day, zone);
  if (!transition) return null;
  const { instant, before, after } = transition;
  const names = `${shortZoneName(zone, new Date(instant - MINUTE))} to ${shortZoneName(zone, new Date(instant))}`;
  const shift = Math.abs(after - before);
  if (after > before) {
    const last = wallClock(instant + (after - before) * MINUTE - MINUTE, before);
    return `Clocks go forward ${lengthWords(shift)} on this day (${names}): there is no ${wallClock(instant, before)} to ${last}.`;
  }
  const last = wallClock(instant + shift * MINUTE - MINUTE, after);
  return `Clocks go back ${lengthWords(shift)} on this day (${names}): ${wallClock(instant, after)} to ${last} happens twice; the first is used.`;
}
