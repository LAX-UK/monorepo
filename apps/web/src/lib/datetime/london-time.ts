/**
 * Every date and time Bid shows, in one place. Sales run on London time, so a date is formatted
 * in Europe/London wherever the page is drawn (server in UTC, visitor abroad), day before month,
 * on the 24-hour clock, and a time that a bidder acts on carries its zone: "21:00 GMT" in winter,
 * "21:00 BST" in summer.
 *
 * The formatting lives in `@auction/datetime`; this file binds it to London so the existing
 * callers keep their names until they move onto the module directly.
 */
import {
  LONDON_TIME_ZONE,
  dayKey,
  dayOffset,
  formatDate,
  formatDateRange,
  formatDayMonth,
  formatFullMoment,
  formatMoment,
  formatMonthYear,
  formatTime,
  formatTimeWithZone,
  formatWeekday,
  formatWhen,
  shortZoneName,
} from "@auction/datetime";

export { LONDON_TIME_ZONE, toDate, type DateInput } from "@auction/datetime";

const ZONE = LONDON_TIME_ZONE;

/** "2026-11-03": the London calendar day, for grouping and comparing days. */
export const londonDayKey = (date: Date): string => dayKey(date, ZONE);

/** "GMT" or "BST", whichever London is on at that instant. */
export const londonZoneName = (date: Date): string => shortZoneName(ZONE, date);

/** "21:00". */
export const formatLondonTime = (date: Date): string => formatTime(date, ZONE);

/** "21:00 GMT": a time a bidder plans around. */
export const formatLondonTimeWithZone = (date: Date): string => formatTimeWithZone(date, ZONE);

export type LondonDateOptions = {
  /** `short` (default): "3 Nov 2026"; `long`: "3 November 2026". */
  month?: "short" | "long";
};

/** "3 Nov 2026". */
export const formatLondonDate = (date: Date, options: LondonDateOptions = {}): string =>
  formatDate(date, ZONE, options);

/**
 * "Thu 12 Nov, 04:31 GMT": the one full moment line shown to people (closing, opening, collection
 * times, countdowns beyond a week). The year appears only when it is not `now`'s.
 */
export const formatLondonWhen = (date: Date, now: Date = new Date()): string =>
  formatWhen(date, ZONE, now);

/** "Saturday 31 October 2026, 14:02": the full date and time, for a tooltip. */
export const formatLondonFullMoment = (date: Date): string => formatFullMoment(date, ZONE);

/** "November 2026" (calendar headings), or "Nov 2026" with `short`. */
export const formatLondonMonthYear = (date: Date, options: { short?: boolean } = {}): string =>
  formatMonthYear(date, ZONE, options);

/** "Tue". */
export const formatLondonWeekday = (date: Date): string => formatWeekday(date, ZONE);

/** "3 Nov", or "3 Nov 2026" when the year differs from `now`'s. */
export const formatLondonDayMonth = (date: Date, now: Date): string =>
  formatDayMonth(date, ZONE, now);

/** A sale's dates, as short as they read clearly: "3 Nov 2026", "3–9 Nov 2026", "29 Oct – 3 Nov 2026". */
export const formatLondonDateRange = (start: Date, end: Date): string =>
  formatDateRange(start, end, ZONE);

/** Whole London calendar days from `now`'s day to `date`'s: 0 today, -1 yesterday, 1 tomorrow. */
export const londonDayOffset = (date: Date, now: Date): number => dayOffset(date, now, ZONE);

/** A moment in a list: "Today 18:12", "Tomorrow 14:00", "19 Nov 14:00", or "19 Nov" without the time. */
export const formatLondonMoment = (
  date: Date,
  now: Date,
  options: { time?: boolean; inSentence?: boolean } = {},
): string => formatMoment(date, ZONE, now, options);
