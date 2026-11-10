/**
 * The remaining day-and-time lines the product shows, each in a zone the caller names: a date with
 * its time, the weekday-led event lines, the unpadded door time and the runtime's own zone.
 *
 * Short months follow the house style ("Sep"). `engineSept: true` keeps the runtime's own
 * spelling ("Sept") for a line that has always shown it; it exists so a line can move here
 * without its text changing, and goes when the house spelling is applied everywhere.
 */
import { LOCALE } from "./constants.js";
import { formatDate, formatTime } from "./date-style.js";

type ShortMonthOptions = { engineSept?: boolean };

const formats = new Map<string, Intl.DateTimeFormat>();

function intl(zone: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${zone}|${JSON.stringify(options)}`;
  let format = formats.get(key);
  if (!format) {
    format = new Intl.DateTimeFormat(LOCALE, { timeZone: zone, ...options });
    formats.set(key, format);
  }
  return format;
}

function spelt(text: string, options: ShortMonthOptions): string {
  return options.engineSept ? text : text.replace(/\bSept\b/, "Sep");
}

/** "2 Nov": a day and month without a year. */
export function formatDayMonthOnly(date: Date, zone: string, options: ShortMonthOptions = {}) {
  return spelt(intl(zone, { day: "numeric", month: "short" }).format(date), options);
}

/** "Mon 2 Nov": the weekday, day and month. */
export function formatWeekdayDayMonth(date: Date, zone: string, options: ShortMonthOptions = {}) {
  return spelt(
    intl(zone, { weekday: "short", day: "numeric", month: "short" }).format(date),
    options,
  );
}

/** "3 Nov 2026, 14:05", or "3 November 2026, 14:05" with `month: "long"`. */
export function formatDateTime(
  date: Date,
  zone: string,
  options: ShortMonthOptions & { month?: "short" | "long" } = {},
): string {
  const month = options.month ?? "short";
  return `${formatDate(date, zone, { month, engineSept: options.engineSept })}, ${formatTime(date, zone)}`;
}

/** "Thursday, 12 November 2026", or without the year when `year` is false. */
export function formatWeekdayDate(date: Date, zone: string, options: { year?: boolean } = {}) {
  return intl(zone, {
    weekday: "long",
    day: "numeric",
    month: "long",
    ...(options.year === false ? {} : { year: "numeric" }),
  }).format(date);
}

/** "Thursday, 12 November 2026 at 9:05": the weekday-led date with an unpadded hour. */
export function formatWeekdayDateTime(date: Date, zone: string): string {
  return intl(zone, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

/** "9:05" (the hour is not padded): a door time. */
export function formatTimeUnpadded(date: Date, zone: string): string {
  return intl(zone, { hour: "numeric", minute: "2-digit" }).format(date);
}

/** The zone the runtime itself runs in (a browser's, or a server's `TZ`), unnormalised. */
export function runtimeTimeZone(): string {
  return new Intl.DateTimeFormat().resolvedOptions().timeZone;
}
