/**
 * The one date style every client-facing line uses, in any zone: day before month, three-letter
 * months, the 24-hour clock, and a zone name on any time a bidder acts on ("21:00 GMT" in winter,
 * "21:00 BST" in summer).
 */
import { dayKey, dayOffset } from "./day.js";
import { shortZoneName, zoneFormats } from "./zone-formats.js";

function yearOf(date: Date, zone: string): string {
  return dayKey(date, zone).slice(0, 4);
}

function monthKeyOf(date: Date, zone: string): string {
  return dayKey(date, zone).slice(0, 7);
}

/** "21:00". */
export function formatTime(date: Date, zone: string): string {
  return zoneFormats(zone).time.format(date);
}

/** "21:00 GMT": a time a bidder plans around. */
export function formatTimeWithZone(date: Date, zone: string): string {
  return `${formatTime(date, zone)} ${shortZoneName(zone, date)}`;
}

/** "3 Nov 2026", or "3 November 2026" with `month: "long"`. */
export function formatDate(date: Date, zone: string, options: { month?: "short" | "long" } = {}) {
  const formats = zoneFormats(zone);
  return (options.month === "long" ? formats.dayLongMonthYear : formats.dayMonthYear).format(date);
}

/** "November": the month's full name, for a heading that names months without years. */
export function formatMonthName(date: Date, zone: string): string {
  return zoneFormats(zone).month.format(date);
}

/** 2026: the calendar year the instant falls in, in `zone`. */
export function calendarYear(date: Date, zone: string): number {
  return Number(yearOf(date, zone));
}

/** "Tue". */
export function formatWeekday(date: Date, zone: string): string {
  return zoneFormats(zone).weekday.format(date);
}

/** "3 Nov", or "3 Nov 2026" when the year differs from `now`'s. */
export function formatDayMonth(date: Date, zone: string, now: Date): string {
  const formats = zoneFormats(zone);
  return (
    yearOf(date, zone) === yearOf(now, zone) ? formats.dayMonth : formats.dayMonthYear
  ).format(date);
}

/**
 * "Thu 12 Nov, 04:31 GMT": the one full moment line shown to people (closing, opening, collection
 * times, countdowns beyond a week). The weekday leads and the year appears only when it is not
 * `now`'s. Its short form is the weekday plus the day and month ("Thu 12 Nov").
 */
export function formatWhen(date: Date, zone: string, now: Date): string {
  return `${formatWeekday(date, zone)} ${formatDayMonth(date, zone, now)}, ${formatTimeWithZone(date, zone)}`;
}

/** "Saturday 31 October 2026, 14:02": the full date and time, for a tooltip. */
export function formatFullMoment(date: Date, zone: string): string {
  const formats = zoneFormats(zone);
  return `${formats.weekdayLong.format(date)} ${formatDate(date, zone, { month: "long" })}, ${formatTime(date, zone)}`;
}

/** "3 November 2026 at 21:00": a long moment for a card or a share image, with no zone name. */
export function formatLongMoment(date: Date, zone: string): string {
  return `${formatDate(date, zone, { month: "long" })} at ${formatTime(date, zone)}`;
}

/** "November 2026" (calendar headings), or "Nov 2026" with `short`. */
export function formatMonthYear(date: Date, zone: string, options: { short?: boolean } = {}) {
  const formats = zoneFormats(zone);
  return (options.short ? formats.shortMonthYear : formats.monthYear).format(date);
}

/**
 * A sale's dates, as short as they read clearly: "3 Nov 2026" (one day), "3–9 Nov 2026" (one
 * month), "29 Oct – 3 Nov 2026" (one year), "29 Dec 2026 – 3 Jan 2027".
 */
export function formatDateRange(start: Date, end: Date, zone: string): string {
  const formats = zoneFormats(zone);
  if (dayKey(start, zone) === dayKey(end, zone)) return formatDate(end, zone);
  if (monthKeyOf(start, zone) === monthKeyOf(end, zone)) {
    return `${formats.day.format(start)}–${formatDate(end, zone)}`;
  }
  if (yearOf(start, zone) === yearOf(end, zone)) {
    return `${formats.dayMonth.format(start)} – ${formatDate(end, zone)}`;
  }
  return `${formatDate(start, zone)} – ${formatDate(end, zone)}`;
}

/**
 * A moment in a list, as short as it can be read: "Today 18:12", "Tomorrow 14:00",
 * "Yesterday 09:30", "19 Nov 14:00", or "19 Nov" without the time; `inSentence` lower-cases the
 * day word after a verb ("Closes tomorrow 14:00"); the year only when it is not this year's.
 */
export function formatMoment(
  date: Date,
  zone: string,
  now: Date,
  options: { time?: boolean; inSentence?: boolean } = {},
): string {
  const time = (options.time ?? true) ? ` ${formatTime(date, zone)}` : "";
  const offset = dayOffset(date, now, zone);
  const word = (w: string) => (options.inSentence ? w.toLowerCase() : w);
  if (offset === 0) return `${word("Today")}${time}`;
  if (offset === 1) return `${word("Tomorrow")}${time}`;
  if (offset === -1) return `${word("Yesterday")}${time}`;
  return `${formatDayMonth(date, zone, now)}${time}`;
}
