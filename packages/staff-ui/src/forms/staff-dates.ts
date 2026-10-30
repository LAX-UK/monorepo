import { STAFF_TIME_ZONE, formatStaffDate } from "../lib/format.js";

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

/** "24 Oct 2026" for a `YYYY-MM-DD` day, read as a calendar day (no zone shift). */
export function formatStaffDay(day: string): string {
  return formatStaffDate(`${day}T12:00:00Z`);
}

/** Minutes London is ahead of UTC at that instant: 60 in summer, 0 in winter. */
function londonOffsetMinutes(instant: number): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: STAFF_TIME_ZONE,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(new Date(instant));
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  const wall = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"));
  return Math.round((wall - Math.floor(instant / 60_000) * 60_000) / 60_000);
}

/**
 * The UTC instant for a London wall-clock day and time, or null when that time does not exist
 * (the hour skipped when clocks go forward).
 */
export function londonWallTimeToIso(day: string, time: string): string | null {
  const [y, m, d] = day.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  if (!y || !m || !d || hh === undefined || mm === undefined) return null;
  const wall = Date.UTC(y, m - 1, d, hh, mm);
  for (const offset of [londonOffsetMinutes(wall - 60 * 60_000), londonOffsetMinutes(wall)]) {
    const instant = wall - offset * 60_000;
    if (londonOffsetMinutes(instant) === offset) return new Date(instant).toISOString();
  }
  return null;
}

/** The London day (`YYYY-MM-DD`) and time (`HH:MM`) of an instant. */
export function isoToLondonWallTime(iso: string): { day: string; time: string } | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: STAFF_TIME_ZONE,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return {
    day: `${get("year")}-${get("month")}-${get("day")}`,
    time: `${get("hour")}:${get("minute")}`,
  };
}

/** "forward" or "back" when London's clocks change on that day, else null. */
export function londonClockChange(day: string): "forward" | "back" | null {
  const [y, m, d] = day.split("-").map(Number);
  if (!y || !m || !d) return null;
  const start = londonOffsetMinutes(Date.UTC(y, m - 1, d, 0, 30));
  const end = londonOffsetMinutes(Date.UTC(y, m - 1, d, 23, 30));
  if (start === end) return null;
  return end > start ? "forward" : "back";
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
