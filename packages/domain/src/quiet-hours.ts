/**
 * Quiet hours: a nightly window, in the person's own time zone, when app alerts on their devices
 * wait. Times are local "HH:MM" and kept with an IANA zone, so 22:00 stays 22:00 through each
 * clock change. A window may cross midnight (22:00 to 07:00).
 */
import { instantToWallClock, isValidZone } from "@auction/datetime";

export const DEFAULT_QUIET_HOURS_TIME_ZONE = "Europe/London";

const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;

export type QuietHours = { start: string | null; end: string | null; timeZone: string };

/** Whether `timeZone` is an IANA zone this runtime knows. */
export function isValidTimeZone(timeZone: string): boolean {
  return isValidZone(timeZone);
}

function minutes(hhmm: string): number | null {
  const match = HHMM.exec(hhmm);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

/** The wall-clock minute of the day at `at` in `timeZone`. */
export function localMinuteOfDay(at: Date, timeZone: string): number {
  const { time } = instantToWallClock(at, timeZone);
  return Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
}

/**
 * Whether `at` falls inside the quiet hours, read in their own zone. Unset, malformed or empty
 * windows are never quiet; an unknown zone falls back to London rather than to UTC.
 */
export function isWithinQuietHours(quiet: QuietHours, at: Date): boolean {
  if (!quiet.start || !quiet.end) return false;
  const start = minutes(quiet.start);
  const end = minutes(quiet.end);
  if (start === null || end === null || start === end) return false;
  const zone = isValidTimeZone(quiet.timeZone) ? quiet.timeZone : DEFAULT_QUIET_HOURS_TIME_ZONE;
  const now = localMinuteOfDay(at, zone);
  return start < end ? now >= start && now < end : now >= start || now < end;
}
