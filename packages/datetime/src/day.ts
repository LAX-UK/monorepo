import { TZDate } from "@date-fns/tz";
import {
  addDays as addZonedDays,
  endOfDay as endOfZonedDay,
  startOfDay as startOfZonedDay,
} from "date-fns";
import { zoneFormats } from "./zone-formats.js";

/** "2026-11-03": the calendar day in `zone`, for grouping and comparing days. */
export function dayKey(instant: Date, zone: string): string {
  return zoneFormats(zone).dayKey.format(instant);
}

/** Whole days from one "YYYY-MM-DD" key to another, regardless of zone or clock changes. */
export function calendarDaysBetween(fromKey: string, toKey: string): number {
  return Math.round((Date.parse(toKey) - Date.parse(fromKey)) / 86_400_000);
}

/** Whole calendar days in `zone` from `now`'s day to `instant`'s: 0 today, -1 yesterday, 1 tomorrow. */
export function dayOffset(instant: Date, now: Date, zone: string): number {
  return calendarDaysBetween(dayKey(now, zone), dayKey(instant, zone));
}

/** The first instant of the calendar day `instant` falls on in `zone`. */
export function startOfDay(instant: Date, zone: string): Date {
  return new Date(startOfZonedDay(new TZDate(instant, zone)).getTime());
}

/** The last millisecond of the calendar day `instant` falls on in `zone` (a due date's "23:59"). */
export function endOfDay(instant: Date, zone: string): Date {
  return new Date(endOfZonedDay(new TZDate(instant, zone)).getTime());
}

/**
 * The instant `days` calendar days from `instant`, at the same wall-clock time in `zone` (a day
 * across a clock change is 23 or 25 hours long, so adding 24 hours would drift). A negative
 * `days` goes back. A wall-clock time that does not exist on the target day (the hour skipped
 * when clocks go forward) moves forward by the skipped hour.
 */
export function addCalendarDays(instant: Date, days: number, zone: string): Date {
  return new Date(addZonedDays(new TZDate(instant, zone), days).getTime());
}
