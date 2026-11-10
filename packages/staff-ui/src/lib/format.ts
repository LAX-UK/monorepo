/**
 * Dates, times and money as staff read them: London time whatever the laptop's zone, absolute
 * dates ("Thu 12 Nov", never "10/11/2026"), a 24-hour clock, and amounts with a currency symbol,
 * two decimals and a true minus sign. One set of formatters for tables, headers and timelines,
 * so the same value never appears two ways.
 */

import {
  LONDON_TIME_ZONE,
  formatDate,
  formatDayMonth,
  formatTime,
  formatWeekday,
  shortMonthFormat,
  shortZoneName,
} from "@auction/datetime";

export const STAFF_TIME_ZONE = LONDON_TIME_ZONE;

/**
 * A date formatter whose short months are always three letters. en-GB spells September "Sept"
 * in current runtimes, which would be the one four-letter month in a column of dates. Use this
 * for any short-month date a staff screen shows, so no page spells it differently.
 */
export function staffShortDateFormat(
  options: Intl.DateTimeFormatOptions,
): Pick<Intl.DateTimeFormat, "format"> {
  return shortMonthFormat(options.timeZone ?? STAFF_TIME_ZONE, options);
}

type DateLike = string | number | Date;

function toDate(value: DateLike): Date | null {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** "BST" in summer and "GMT" in winter, for the London clock at that moment. */
export function londonZoneLabel(value: DateLike = new Date()): "BST" | "GMT" {
  const date = toDate(value) ?? new Date();
  return shortZoneName(STAFF_TIME_ZONE, date) === "BST" ? "BST" : "GMT";
}

/** "14:05", London time, 24-hour clock; with `zoneLabel`, "14:05 BST". */
export function formatStaffTime(value: DateLike, { zoneLabel = false } = {}): string {
  const date = toDate(value);
  if (!date) return String(value);
  const time = formatTime(date, STAFF_TIME_ZONE);
  return zoneLabel ? `${time} ${londonZoneLabel(date)}` : time;
}

/**
 * The date part of the one date style: "Thu 12 Nov". London time, the weekday leads, and the year
 * is shown only when it is not `now`'s ("Thu 12 Nov 2026" when read in another year).
 * Unparseable input is returned unchanged so nothing is silently lost.
 */
export function formatStaffDate(value: DateLike, now: DateLike = new Date()): string {
  const date = toDate(value);
  if (!date) return String(value);
  const reference = toDate(now) ?? new Date();
  return `${formatWeekday(date, STAFF_TIME_ZONE)} ${formatDayMonth(date, STAFF_TIME_ZONE, reference)}`;
}

/**
 * "24 Oct 2026": a London date with the year always present and no weekday. For files staff
 * download (CSV), which are read and sorted outside the app and must not change with the clock.
 * Screens use `formatStaffDate`.
 */
export function formatStaffExportDate(value: DateLike): string {
  const date = toDate(value);
  return date ? formatDate(date, STAFF_TIME_ZONE) : String(value);
}

/**
 * The one date style: "Thu 12 Nov, 04:49 GMT". The date as `formatStaffDate` reads it, then the
 * London 24-hour time and zone ("BST" in summer, "GMT" in winter). The same words as the public
 * products' `formatLondonWhen`. Fixed zone and explicit en-GB parts, so server and browser agree.
 */
export function formatStaffDateTime(value: DateLike, now: DateLike = new Date()): string {
  const date = toDate(value);
  if (!date) return String(value);
  return `${formatStaffDate(date, now)}, ${formatStaffTime(date, { zoneLabel: true })}`;
}

const RELATIVE = new Intl.RelativeTimeFormat("en-GB", { numeric: "auto" });

const RELATIVE_STEPS: ReadonlyArray<[Intl.RelativeTimeFormatUnit, number]> = [
  ["second", 60],
  ["minute", 60],
  ["hour", 24],
  ["day", 7],
  ["week", 4.35],
  ["month", 12],
  ["year", Number.POSITIVE_INFINITY],
];

/** "3 minutes ago", "yesterday", "in 2 days". For activity only, with the absolute time beside. */
export function formatStaffRelative(value: DateLike, now: DateLike = new Date()): string {
  const date = toDate(value);
  const reference = toDate(now);
  if (!date || !reference) return String(value);
  let amount = (date.getTime() - reference.getTime()) / 1000;
  for (const [unit, size] of RELATIVE_STEPS) {
    if (Math.abs(amount) < size) {
      if (unit === "second" && Math.abs(amount) < 45) return "just now";
      return RELATIVE.format(Math.round(amount), unit);
    }
    amount /= size;
  }
  return formatStaffDate(date);
}

/**
 * A number as staff read it in text: en-GB grouping ("1,250"), so a count in a sentence or a
 * pager is written one way everywhere. `options` are the usual `Intl.NumberFormat` ones.
 */
export function formatStaffNumber(value: number, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat("en-GB", options).format(value);
}

const MINUS = "−";
const moneyFormats = new Map<string, Intl.NumberFormat>();

function moneyFormat(currency: string): Intl.NumberFormat {
  const key = currency.toUpperCase();
  let format = moneyFormats.get(key);
  if (!format) {
    format = new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: key,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    moneyFormats.set(key, format);
  }
  return format;
}

/**
 * An amount in minor units (pence, cents) for display: "£1,250.00", "−£20.00" for refunds and
 * other negatives (a true minus sign, so the sign does not rely on colour), and the ISO code
 * after any currency other than pounds, so a mixed column cannot be misread: "€1,250.00 EUR".
 */
export function formatStaffMoney(minor: number, currency = "GBP"): string {
  const code = currency.toUpperCase();
  const text = moneyFormat(code).format(Math.abs(minor) / 100);
  const signed = minor < 0 ? `${MINUS}${text}` : text;
  return code === "GBP" ? signed : `${signed} ${code}`;
}
