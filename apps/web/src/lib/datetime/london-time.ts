/**
 * Every date and time Bid shows, in one place. Sales run on London time, so a date is formatted
 * in Europe/London wherever the page is drawn (server in UTC, visitor abroad), day before month,
 * on the 24-hour clock, and a time that a bidder acts on carries its zone: "21:00 GMT" in winter,
 * "21:00 BST" in summer.
 *
 * Formatters are built once and reused; `Intl.DateTimeFormat` construction is the expensive part.
 */

export const LONDON_TIME_ZONE = "Europe/London";

const LOCALE = "en-GB";

function formatter(options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat(LOCALE, { timeZone: LONDON_TIME_ZONE, ...options });
}

const DAY_KEY = new Intl.DateTimeFormat("en-CA", {
  timeZone: LONDON_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const TIME = formatter({ hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const ZONE_NAME = formatter({ timeZoneName: "short" });
const DAY = formatter({ day: "numeric" });
const DAY_MONTH = formatter({ day: "numeric", month: "short" });
const DAY_MONTH_YEAR = formatter({ day: "numeric", month: "short", year: "numeric" });
const DAY_LONG_MONTH_YEAR = formatter({ day: "numeric", month: "long", year: "numeric" });
const MONTH_YEAR = formatter({ month: "long", year: "numeric" });
const SHORT_MONTH_YEAR = formatter({ month: "short", year: "numeric" });
const WEEKDAY = formatter({ weekday: "short" });

/** A date, a timestamp, or an ISO string, as the API and view models hand them over. */
export type DateInput = Date | string | number;

/** Parses the input; `null` when it is not a real instant, so callers can hide the line. */
export function toDate(input: DateInput | null | undefined): Date | null {
  if (input == null || input === "") return null;
  const date = input instanceof Date ? input : new Date(input);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** "2026-11-03": the London calendar day, for grouping and comparing days. */
export function londonDayKey(date: Date): string {
  return DAY_KEY.format(date);
}

function londonYear(date: Date): string {
  return londonDayKey(date).slice(0, 4);
}

function londonMonthKey(date: Date): string {
  return londonDayKey(date).slice(0, 7);
}

/** "GMT" or "BST", whichever London is on at that instant. */
export function londonZoneName(date: Date): string {
  const part = ZONE_NAME.formatToParts(date).find((p) => p.type === "timeZoneName");
  return part?.value === "BST" ? "BST" : "GMT";
}

/** "21:00". */
export function formatLondonTime(date: Date): string {
  return TIME.format(date);
}

/** "21:00 GMT": a time a bidder plans around. */
export function formatLondonTimeWithZone(date: Date): string {
  return `${formatLondonTime(date)} ${londonZoneName(date)}`;
}

export type LondonDateOptions = {
  /** `short` (default): "3 Nov 2026"; `long`: "3 November 2026". */
  month?: "short" | "long";
};

/** "3 Nov 2026". */
export function formatLondonDate(date: Date, options: LondonDateOptions = {}): string {
  return (options.month === "long" ? DAY_LONG_MONTH_YEAR : DAY_MONTH_YEAR).format(date);
}

/** "3 Nov 2026, 21:00 GMT": a closing or opening moment. */
export function formatLondonDateTime(date: Date): string {
  return `${formatLondonDate(date)}, ${formatLondonTimeWithZone(date)}`;
}

/** "November 2026" (calendar headings), or "Nov 2026" with `short`. */
export function formatLondonMonthYear(date: Date, options: { short?: boolean } = {}): string {
  return (options.short ? SHORT_MONTH_YEAR : MONTH_YEAR).format(date);
}

/** "Tue". */
export function formatLondonWeekday(date: Date): string {
  return WEEKDAY.format(date);
}

/** "3 Nov", or "3 Nov 2026" when the year differs from `now`'s. */
export function formatLondonDayMonth(date: Date, now: Date): string {
  return (londonYear(date) === londonYear(now) ? DAY_MONTH : DAY_MONTH_YEAR).format(date);
}

/**
 * A sale's dates, as short as they read clearly: "3 Nov 2026" (one day), "3–9 Nov 2026" (one
 * month), "29 Oct – 3 Nov 2026" (one year), "29 Dec 2026 – 3 Jan 2027".
 */
export function formatLondonDateRange(start: Date, end: Date): string {
  if (londonDayKey(start) === londonDayKey(end)) return formatLondonDate(end);
  if (londonMonthKey(start) === londonMonthKey(end)) {
    return `${DAY.format(start)}–${formatLondonDate(end)}`;
  }
  if (londonYear(start) === londonYear(end)) {
    return `${DAY_MONTH.format(start)} – ${formatLondonDate(end)}`;
  }
  return `${formatLondonDate(start)} – ${formatLondonDate(end)}`;
}

function dayOffset(date: Date, now: Date): number {
  const a = Date.parse(londonDayKey(date));
  const b = Date.parse(londonDayKey(now));
  return Math.round((a - b) / 86_400_000);
}

/**
 * A moment in a list, as short as it can be read: "Today 18:12", "Tomorrow 14:00",
 * "Yesterday 09:30", "19 Nov 14:00", or "19 Nov" without the time; the year only when it is not
 * this year's.
 */
export function formatLondonMoment(
  date: Date,
  now: Date,
  options: { time?: boolean } = {},
): string {
  const withTime = options.time ?? true;
  const time = withTime ? ` ${formatLondonTime(date)}` : "";
  const offset = dayOffset(date, now);
  if (offset === 0) return `Today${time}`;
  if (offset === 1) return `Tomorrow${time}`;
  if (offset === -1) return `Yesterday${time}`;
  return `${formatLondonDayMonth(date, now)}${time}`;
}
