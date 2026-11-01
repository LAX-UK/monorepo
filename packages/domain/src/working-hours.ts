import { BUSINESS_TIME_ZONE } from "./calendar-year.js";

/**
 * Working hours for clocks that should only run while the office is open: Monday to Friday,
 * 09:00 to 18:00 in London, with the bank holidays of England and Wales off. A message sent on
 * Friday evening has waited no working time by nine on Monday.
 */
export type WorkingCalendar = {
  timeZone: string;
  /** Minute of the local day the office opens (540 is 09:00). */
  opensAt: number;
  /** Minute of the local day it closes (1080 is 18:00). */
  closesAt: number;
  /** Whether a local date ("2026-12-25") is a day off besides the weekend. */
  isHoliday: (date: string) => boolean;
};

const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;
/** A clock never looks further than this for working time, so a bad input cannot loop. */
const MAX_DAYS = 3660;

type LocalDate = { year: number; month: number; day: number };

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export function localDateKey(date: LocalDate): string {
  return `${date.year}-${pad(date.month)}-${pad(date.day)}`;
}

/** Day of the week of a calendar date: 0 is Sunday. */
function weekday(date: LocalDate): number {
  return new Date(Date.UTC(date.year, date.month - 1, date.day)).getUTCDay();
}

function addDays(date: LocalDate, days: number): LocalDate {
  const next = new Date(Date.UTC(date.year, date.month - 1, date.day) + days * DAY_MS);
  return { year: next.getUTCFullYear(), month: next.getUTCMonth() + 1, day: next.getUTCDate() };
}

const partsFormatters = new Map<string, Intl.DateTimeFormat>();

function partsIn(instant: Date, timeZone: string) {
  let formatter = partsFormatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-GB", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
    partsFormatters.set(timeZone, formatter);
  }
  const parts = formatter.formatToParts(instant);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);
  return {
    year: part("year"),
    month: part("month"),
    day: part("day"),
    minute: part("hour") * 60 + part("minute"),
  };
}

/** The calendar date in the zone at an instant. */
export function localDateOf(instant: Date, timeZone: string): LocalDate {
  const { year, month, day } = partsIn(instant, timeZone);
  return { year, month, day };
}

/** Minutes the zone is ahead of UTC at an instant. */
function offsetMinutes(instant: Date, timeZone: string): number {
  const p = partsIn(instant, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, 0, p.minute);
  return Math.round((asUtc - Math.floor(instant.getTime() / MINUTE_MS) * MINUTE_MS) / MINUTE_MS);
}

/** The instant a local date and minute of the day names in the zone. */
export function zonedInstant(date: LocalDate, minuteOfDay: number, timeZone: string): Date {
  const naive = Date.UTC(date.year, date.month - 1, date.day, 0, minuteOfDay);
  const first = naive - offsetMinutes(new Date(naive), timeZone) * MINUTE_MS;
  // Read the offset again at the first guess, which settles the days the clocks change.
  return new Date(naive - offsetMinutes(new Date(first), timeZone) * MINUTE_MS);
}

/** Easter Sunday (Gregorian), by the anonymous algorithm. */
function easterSunday(year: number): LocalDate {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return { year, month, day };
}

function firstMonday(year: number, month: number): LocalDate {
  const first = { year, month, day: 1 };
  return addDays(first, (8 - weekday(first)) % 7);
}

function lastMonday(year: number, month: number): LocalDate {
  const next =
    month === 12 ? { year: year + 1, month: 1, day: 1 } : { year, month: month + 1, day: 1 };
  const lastDay = addDays(next, -1);
  return addDays(lastDay, -((weekday(lastDay) + 6) % 7));
}

/**
 * The regular bank holidays of England and Wales in a year, with the substitute weekdays when
 * one falls at a weekend. One-off holidays (a coronation, a jubilee) are added through
 * `extraHolidays` on the calendar.
 */
export function englandAndWalesBankHolidays(year: number): string[] {
  const days: LocalDate[] = [];
  const newYear = { year, month: 1, day: 1 };
  const newYearDay = weekday(newYear);
  days.push(
    newYearDay === 6 ? addDays(newYear, 2) : newYearDay === 0 ? addDays(newYear, 1) : newYear,
  );
  const easter = easterSunday(year);
  days.push(addDays(easter, -2), addDays(easter, 1));
  days.push(firstMonday(year, 5), lastMonday(year, 5), lastMonday(year, 8));
  const christmas = { year, month: 12, day: 25 };
  const christmasDay = weekday(christmas);
  if (christmasDay === 6) days.push({ year, month: 12, day: 27 }, { year, month: 12, day: 28 });
  else if (christmasDay === 0)
    days.push({ year, month: 12, day: 26 }, { year, month: 12, day: 27 });
  else if (christmasDay === 5) days.push(christmas, { year, month: 12, day: 28 });
  else days.push(christmas, { year, month: 12, day: 26 });
  return days.map(localDateKey).sort();
}

/** The London office calendar, with any one-off holidays ("2027-06-04") added. */
export function londonWorkingCalendar(extraHolidays: readonly string[] = []): WorkingCalendar {
  const byYear = new Map<number, Set<string>>();
  const extra = new Set(extraHolidays);
  return {
    timeZone: BUSINESS_TIME_ZONE,
    opensAt: 9 * 60,
    closesAt: 18 * 60,
    isHoliday: (date) => {
      if (extra.has(date)) return true;
      const year = Number(date.slice(0, 4));
      let holidays = byYear.get(year);
      if (!holidays) {
        holidays = new Set(englandAndWalesBankHolidays(year));
        byYear.set(year, holidays);
      }
      return holidays.has(date);
    },
  };
}

export const LONDON_WORKING_CALENDAR: WorkingCalendar = londonWorkingCalendar();

function isWorkingDay(calendar: WorkingCalendar, date: LocalDate): boolean {
  const day = weekday(date);
  return day !== 0 && day !== 6 && !calendar.isHoliday(localDateKey(date));
}

function openWindow(calendar: WorkingCalendar, date: LocalDate): { start: number; end: number } {
  return {
    start: zonedInstant(date, calendar.opensAt, calendar.timeZone).getTime(),
    end: zonedInstant(date, calendar.closesAt, calendar.timeZone).getTime(),
  };
}

/** Whole working minutes between two instants; 0 when `to` is not after `from`. */
export function workingMinutesBetween(calendar: WorkingCalendar, from: Date, to: Date): number {
  if (to.getTime() <= from.getTime()) return 0;
  let date = localDateOf(from, calendar.timeZone);
  const last = localDateKey(localDateOf(to, calendar.timeZone));
  let total = 0;
  for (let i = 0; i < MAX_DAYS; i++) {
    if (isWorkingDay(calendar, date)) {
      const window = openWindow(calendar, date);
      const start = Math.max(window.start, from.getTime());
      const end = Math.min(window.end, to.getTime());
      if (end > start) total += end - start;
    }
    if (localDateKey(date) >= last) break;
    date = addDays(date, 1);
  }
  return Math.floor(total / MINUTE_MS);
}

/** The instant `minutes` of working time after `from`. */
export function addWorkingMinutes(calendar: WorkingCalendar, from: Date, minutes: number): Date {
  let remaining = Math.max(0, minutes) * MINUTE_MS;
  let date = localDateOf(from, calendar.timeZone);
  for (let i = 0; i < MAX_DAYS; i++) {
    if (isWorkingDay(calendar, date)) {
      const window = openWindow(calendar, date);
      const start = Math.max(window.start, from.getTime());
      if (start < window.end) {
        const available = window.end - start;
        if (remaining <= available) return new Date(start + remaining);
        remaining -= available;
      }
    }
    date = addDays(date, 1);
  }
  throw new Error("working calendar has no open time in range");
}
