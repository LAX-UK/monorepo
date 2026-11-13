/**
 * Zone-aware day arithmetic, through date-fns and `@date-fns/tz`. Kept apart from `day.ts`, which
 * the public date formatters import, so date-fns only ships with the code that calls these.
 */
import { TZDate } from "@date-fns/tz";
import {
  addDays as addZonedDays,
  endOfDay as endOfZonedDay,
  startOfDay as startOfZonedDay,
} from "date-fns";

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
