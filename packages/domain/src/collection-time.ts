import { BUSINESS_TIME_ZONE } from "./calendar-year.js";
import { localDateKey, localDateOf } from "./working-hours.js";

/**
 * London time for collections. Hours are kept as London wall-clock times ("10:00") and visits as
 * instants; a London calendar day is named by its date key ("2026-11-12"). Everything a person
 * reads is in London time, labelled GMT or BST, in the one date style: "Thu 12 Nov, 14:00 GMT".
 */

/** A London calendar day, "2026-11-12". */
export type DateKey = string;

const DAY_MS = 24 * 60 * 60_000;
const DATE_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;
const LOCAL_TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** Whether the key names a real calendar day ("2026-02-30" does not). */
export function isDateKey(value: string): boolean {
  const match = DATE_KEY.exec(value);
  if (!match) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

function utcOf(key: DateKey): number {
  const match = DATE_KEY.exec(key);
  if (!match) throw new RangeError(`Not a date key: ${key}`);
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

/** The year, month and day of a day key, for building instants. */
export function dateKeyParts(key: DateKey): { year: number; month: number; day: number } {
  const date = new Date(utcOf(key));
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}

/** The day `days` after `key` (negative for before). */
export function addDaysToKey(key: DateKey, days: number): DateKey {
  const date = new Date(utcOf(key) + days * DAY_MS);
  return localDateKey({
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  });
}

/** ISO weekday of a day: 1 is Monday, 7 is Sunday. */
export function isoWeekday(key: DateKey): number {
  return ((new Date(utcOf(key)).getUTCDay() + 6) % 7) + 1;
}

/** Whole days from `from` to `to`. */
export function daysBetweenKeys(from: DateKey, to: DateKey): number {
  return Math.round((utcOf(to) - utcOf(from)) / DAY_MS);
}

/** The London day an instant falls on. */
export function londonDateKey(instant: Date): DateKey {
  return localDateKey(localDateOf(instant, BUSINESS_TIME_ZONE));
}

/** Minutes after midnight for a London wall-clock time ("16:00" is 960); `null` if malformed. */
export function parseLocalTime(value: string): number | null {
  const match = LOCAL_TIME.exec(value);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

function formatter(options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat("en-GB", { timeZone: BUSINESS_TIME_ZONE, ...options });
}

const WEEKDAY = formatter({ weekday: "short" });
const DAY = formatter({ day: "numeric" });
const MONTH = formatter({ month: "short" });
const YEAR = formatter({ year: "numeric" });
const TIME = formatter({ hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const ZONE = formatter({ timeZoneName: "short" });

/** "GMT" or "BST", whichever London is on at that instant. */
export function londonZoneLabel(instant: Date): "GMT" | "BST" {
  const part = ZONE.formatToParts(instant).find((p) => p.type === "timeZoneName");
  return part?.value === "BST" ? "BST" : "GMT";
}

function dayAndMonth(instant: Date, now: Date): string {
  const month = MONTH.format(instant).replace(/^Sept$/, "Sep");
  const year = YEAR.format(instant) === YEAR.format(now) ? "" : ` ${YEAR.format(instant)}`;
  return `${DAY.format(instant)} ${month}${year}`;
}

/** "Thu 12 Nov": a day alone. The year is added only when it is not `now`'s. */
export function formatCollectionDay(instant: Date, now: Date = new Date()): string {
  return `${WEEKDAY.format(instant)} ${dayAndMonth(instant, now)}`;
}

/** "Thu 12 Nov, 14:00 GMT": a moment. */
export function formatCollectionWhen(instant: Date, now: Date = new Date()): string {
  return `${formatCollectionDay(instant, now)}, ${TIME.format(instant)} ${londonZoneLabel(instant)}`;
}

/** "Thu 12 Nov, 14:00–14:30 GMT": a visit. */
export function formatCollectionVisit(start: Date, end: Date, now: Date = new Date()): string {
  return `${formatCollectionDay(start, now)}, ${TIME.format(start)}–${TIME.format(end)} ${londonZoneLabel(end)}`;
}
