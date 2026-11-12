import { addCalendarKeyDays } from "./day-key.js";
import { offsetMinutes } from "./offset.js";
import { instantToWallClock, wallClockToInstant } from "./wall-clock.js";

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

/**
 * The instant a wall-clock day and time mean in `zone`. A time the clocks skip is read on the
 * clock as it stood before the change, so it lands the length of the gap later (01:30 in the
 * hour London skips is 02:30 BST); a form always gets an instant. `null` only when the day or
 * time is not one at all.
 */
export function resolveWallClock(day: string, time: string, zone: string): Date | null {
  const exact = wallClockToInstant(day, time, zone);
  if (exact.ok) return exact.instant;
  if (exact.reason === "invalid") return null;
  const wall = Date.parse(`${day}T${time.padStart(5, "0")}:00Z`);
  return new Date(wall - offsetMinutes(new Date(wall - DAY_MS), zone) * 60_000);
}

/** "2026-11-12T18:00": the wall clock in `zone` at an instant, the wire format of date-time form fields. */
export function toDatetimeFormString(instant: Date, zone: string): string {
  const { day, time } = instantToWallClock(instant, zone);
  return `${day}T${time}`;
}

/**
 * The instant a form's "2026-11-12T18:00" means in `zone` (the time defaults to midnight). Days
 * and hours past their end roll over, as a date picker's arithmetic does; an empty or unreadable
 * value is an invalid Date.
 */
export function instantFromDatetimeFormString(raw: string, zone: string): Date {
  const trimmed = raw.trim();
  if (!trimmed) return new Date(Number.NaN);
  const [datePart = "", timePart = "00:00"] = trimmed.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour = 0, minute = 0] = timePart.split(":").map(Number);
  const wall = Date.UTC(year ?? Number.NaN, (month ?? 1) - 1, day ?? 1, hour, minute);
  if (Number.isNaN(wall)) return new Date(Number.NaN);
  const rolled = new Date(wall).toISOString();
  return resolveWallClock(rolled.slice(0, 10), rolled.slice(11, 16), zone) ?? new Date(Number.NaN);
}

/** The opening and closing a new sale or lot form starts with: the top of the next hour in `zone`, and `days` later at the same time. */
export function defaultScheduleInstants(
  now: Date,
  zone: string,
  days = 7,
): { start: Date; end: Date } {
  const { day, time } = instantToWallClock(new Date(now.getTime() + HOUR_MS), zone);
  const clock = `${time.slice(0, 2)}:00`;
  const start = resolveWallClock(day, clock, zone);
  const end = resolveWallClock(addCalendarKeyDays(day, days), clock, zone);
  if (!start || !end) throw new RangeError(`No default schedule for ${day} ${clock} in ${zone}`);
  return { start, end };
}
