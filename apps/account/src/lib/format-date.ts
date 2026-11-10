/**
 * The one date style for LAX Account, in London time whatever the viewer's zone, so server and
 * browser always agree:
 *  - date and time: "Thu 12 Nov, 04:49 GMT" (the year follows when it is not the current year);
 *  - date only: "Tue 29 Sep 2026";
 *  - relative ("6 days ago"): for device activity only, see `formatRelativeAge`.
 *
 * The words come from `@auction/datetime`, which spells every short month the same way.
 */
import {
  formatTimeWithZone,
  formatWeekday,
  formatWhen,
  formatDate as formatZonedDate,
} from "@auction/datetime";

export type DateLike = string | number | Date;

const ZONE = "Europe/London";

function toDate(value: DateLike): Date | null {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** "Tue 29 Sep 2026": the weekday leads and the year is always present. */
export function formatDate(value: DateLike): string {
  const date = toDate(value);
  if (!date) return String(value);
  return `${formatWeekday(date, ZONE)} ${formatZonedDate(date, ZONE)}`;
}

/** "04:49 GMT" or "04:49 BST": the London 24-hour clock with the zone in force at that moment. */
export function formatTime(value: DateLike): string {
  const date = toDate(value);
  if (!date) return String(value);
  return formatTimeWithZone(date, ZONE);
}

/** "Thu 12 Nov, 04:49 GMT"; "Thu 4 Feb 2027, 08:00 GMT" when the year is not `now`'s year. */
export function formatDateTime(value: DateLike, now: DateLike = new Date()): string {
  const date = toDate(value);
  if (!date) return String(value);
  return formatWhen(date, ZONE, toDate(now) ?? date);
}

/** True when both moments fall on the same London calendar day. */
export function isSameLondonDay(a: DateLike, b: DateLike): boolean {
  const first = toDate(a);
  const second = toDate(b);
  if (!first || !second) return false;
  return formatDate(first) === formatDate(second);
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

function plural(count: number, unit: string): string {
  return `${count} ${unit}${count === 1 ? "" : "s"}`;
}

/**
 * "just now", "5 minutes ago", "2 days ago", then "on Tue 29 Sep 2026" once it stops being
 * recent. The only place a relative time is allowed: when a device was last active.
 */
export function formatRelativeAge(then: Date, now: Date): string {
  const elapsed = Math.max(0, now.getTime() - then.getTime());
  if (elapsed < MINUTE) return "just now";
  if (elapsed < HOUR) return `${plural(Math.floor(elapsed / MINUTE), "minute")} ago`;
  if (elapsed < DAY) return `${plural(Math.floor(elapsed / HOUR), "hour")} ago`;
  if (elapsed < 30 * DAY) return `${plural(Math.floor(elapsed / DAY), "day")} ago`;
  return `on ${formatDate(then)}`;
}
