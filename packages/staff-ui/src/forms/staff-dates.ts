import { offsetMinutes } from "@auction/datetime";
import { STAFF_TIME_ZONE, formatStaffDate, staffShortDateFormat } from "../lib/format.js";

/*
 * Dates are typed first ("24 Oct 2026", "24/10/2026", "2026-10-24"); the calendar is a shortcut,
 * never the only way in. Days are whole London calendar days as `YYYY-MM-DD`. Moments (a sale
 * opening, a lot closing) are typed as a London date and a 24-hour time and stored as ISO UTC,
 * with the zone always shown beside the field.
 */

const MONTHS = [
  "jan",
  "feb",
  "mar",
  "apr",
  "may",
  "jun",
  "jul",
  "aug",
  "sep",
  "oct",
  "nov",
  "dec",
] as const;

export type ParsedDay = { ok: true; day: string } | { ok: false; reason: "empty" | "invalid" };

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function validDay(year: number, month: number, day: number): string | null {
  if (year < 1000 || year > 9999 || month < 1 || month > 12 || day < 1) return null;
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (day > last) return null;
  return `${year}-${pad(month)}-${pad(day)}`;
}

/**
 * Reads a typed date, day before month as written in the UK: "24 Oct 2026", "24 October 2026",
 * "24/10/2026", "24-10-2026", "24.10.2026", "24 10 2026" or "2026-10-24".
 */
export function parseStaffDay(input: string): ParsedDay {
  const text = input.trim().toLowerCase().replace(/,/g, " ");
  if (text === "") return { ok: false, reason: "empty" };
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(text);
  if (iso) {
    const day = validDay(Number(iso[1]), Number(iso[2]), Number(iso[3]));
    return day ? { ok: true, day } : { ok: false, reason: "invalid" };
  }
  const parts = text.split(/[\s/.-]+/).filter(Boolean);
  if (parts.length !== 3) return { ok: false, reason: "invalid" };
  const [dayText = "", monthText = "", yearText = ""] = parts;
  const monthIndex = /^\d+$/.test(monthText)
    ? Number(monthText)
    : MONTHS.indexOf(monthText.slice(0, 3) as (typeof MONTHS)[number]) + 1;
  if (!/^\d{1,2}$/.test(dayText) || !/^\d{4}$/.test(yearText) || monthIndex < 1) {
    return { ok: false, reason: "invalid" };
  }
  const day = validDay(Number(yearText), monthIndex, Number(dayText));
  return day ? { ok: true, day } : { ok: false, reason: "invalid" };
}

export function dayToDate(day: string): Date | undefined {
  const [y, m, d] = day.split("-").map(Number);
  if (!y || !m || !d) return undefined;
  return new Date(y, m - 1, d);
}

export function dateToDay(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

const FIELD_DAY = staffShortDateFormat({ day: "numeric", month: "short", year: "numeric" });

/**
 * "24 Oct 2026" for a `YYYY-MM-DD` day, read as a calendar day (no zone shift). The year is always
 * there and there is no weekday: this is the text a date field shows and parses back, and how a
 * date of birth reads.
 */
export function formatStaffDay(day: string): string {
  const date = new Date(`${day}T12:00:00Z`);
  return Number.isNaN(date.getTime()) ? day : FIELD_DAY.format(date);
}

/** "Sat 24 Oct" (year when not this one) for a `YYYY-MM-DD` calendar day: the display style. */
export function formatStaffCalendarDay(day: string, now: Date = new Date()): string {
  return formatStaffDate(`${day.slice(0, 10)}T12:00:00Z`, now);
}

/**
 * The UTC instant for a wall-clock day and time in `zone`, or null when that time does not exist
 * (the hour skipped when that zone's clocks go forward).
 */
export function wallTimeToIso(day: string, time: string, zone: string): string | null {
  const [y, m, d] = day.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  if (!y || !m || !d || hh === undefined || mm === undefined) return null;
  const wall = Date.UTC(y, m - 1, d, hh, mm);
  const offsetAt = (instant: number) => offsetMinutes(new Date(instant), zone);
  for (const offset of [offsetAt(wall - 60 * 60_000), offsetAt(wall)]) {
    const instant = wall - offset * 60_000;
    if (offsetAt(instant) === offset) return new Date(instant).toISOString();
  }
  return null;
}

/** The day (`YYYY-MM-DD`) and time (`HH:MM`) of an instant on the clock in `zone`. */
export function isoToWallTime(iso: string, zone: string): { day: string; time: string } | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const wall = new Date(date.getTime() + offsetMinutes(date, zone) * 60_000).toISOString();
  return { day: wall.slice(0, 10), time: wall.slice(11, 16) };
}

/** "forward" or "back" when the clocks in `zone` change on that day, else null. */
export function clockChange(day: string, zone: string): "forward" | "back" | null {
  const [y, m, d] = day.split("-").map(Number);
  if (!y || !m || !d) return null;
  const start = offsetMinutes(new Date(Date.UTC(y, m - 1, d, 0, 30)), zone);
  const end = offsetMinutes(new Date(Date.UTC(y, m - 1, d, 23, 30)), zone);
  if (start === end) return null;
  return end > start ? "forward" : "back";
}

/** `wallTimeToIso` on the London clock, for everything that is not a sale's own time. */
export function londonWallTimeToIso(day: string, time: string): string | null {
  return wallTimeToIso(day, time, STAFF_TIME_ZONE);
}

/** The London day (`YYYY-MM-DD`) and time (`HH:MM`) of an instant. */
export function isoToLondonWallTime(iso: string): { day: string; time: string } | null {
  return isoToWallTime(iso, STAFF_TIME_ZONE);
}

/** "forward" or "back" when London's clocks change on that day, else null. */
export function londonClockChange(day: string): "forward" | "back" | null {
  return clockChange(day, STAFF_TIME_ZONE);
}

/**
 * The earliest time at or after `time` that exists on `day` in `zone`: the same time on an
 * ordinary day, and the end of the skipped hour when the clocks go forward. Null when none is
 * found within three hours.
 */
export function nextExistingWallTime(day: string, time: string, zone: string): string | null {
  const [hh, mm] = time.split(":").map(Number);
  if (hh === undefined || mm === undefined) return null;
  for (let step = 0; step <= 180; step += 1) {
    const total = hh * 60 + mm + step;
    const candidate = `${pad(Math.floor(total / 60) % 24)}:${pad(total % 60)}`;
    if (wallTimeToIso(day, candidate, zone)) return candidate;
  }
  return null;
}

/** Reads "14:05", "1405" or "9:30" on a 24-hour clock. */
export function parseStaffTime(input: string): string | null {
  const match = /^(\d{1,2}):?(\d{2})$/.exec(input.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return `${pad(hours)}:${pad(minutes)}`;
}
