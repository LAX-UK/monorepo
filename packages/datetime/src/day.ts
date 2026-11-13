/**
 * Calendar days in a zone, read with `Intl` only. The date formatters on public pages use these,
 * so this file must not import date-fns: the zone arithmetic that needs it is in `day-zoned.ts`.
 */
import { zoneFormats } from "./zone-formats.js";

export { addCalendarKeyDays } from "./day-key.js";

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
