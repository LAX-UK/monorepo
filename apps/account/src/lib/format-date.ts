/**
 * The one date style for LAX Account, in London time whatever the viewer's zone, so server and
 * browser always agree:
 *  - date and time: "Thu 12 Nov, 04:49 GMT" (the year follows when it is not the current year);
 *  - date only: "Tue 29 Sep 2026";
 *  - relative ("6 days ago"): for device activity only, see `formatRelativeAge`.
 *
 * Month names come from a fixed table because the short month differs by engine ("Sept" in
 * some, "Sep" in others).
 */

export type DateLike = string | number | Date;

const ZONE = "Europe/London";
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const PARTS = new Intl.DateTimeFormat("en-GB", {
  timeZone: ZONE,
  weekday: "short",
  day: "numeric",
  month: "numeric",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZoneName: "short",
});

type LondonParts = {
  weekday: string;
  day: string;
  month: string;
  year: string;
  time: string;
  zone: string;
};

function londonParts(date: Date): LondonParts {
  const found: Record<string, string> = {};
  for (const part of PARTS.formatToParts(date)) found[part.type] = part.value;
  return {
    weekday: found.weekday ?? "",
    day: String(Number(found.day)),
    month: MONTHS[Number(found.month) - 1] ?? "",
    year: found.year ?? "",
    time: `${found.hour}:${found.minute}`,
    zone: found.timeZoneName ?? "",
  };
}

function toDate(value: DateLike): Date | null {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** "Tue 29 Sep 2026": the weekday leads and the year is always present. */
export function formatDate(value: DateLike): string {
  const date = toDate(value);
  if (!date) return String(value);
  const p = londonParts(date);
  return `${p.weekday} ${p.day} ${p.month} ${p.year}`;
}

/** "04:49 GMT" or "04:49 BST": the London 24-hour clock with the zone in force at that moment. */
export function formatTime(value: DateLike): string {
  const date = toDate(value);
  if (!date) return String(value);
  const p = londonParts(date);
  return `${p.time} ${p.zone}`;
}

/** "Thu 12 Nov, 04:49 GMT"; "Thu 4 Feb 2027, 08:00 GMT" when the year is not `now`'s year. */
export function formatDateTime(value: DateLike, now: DateLike = new Date()): string {
  const date = toDate(value);
  if (!date) return String(value);
  const p = londonParts(date);
  const reference = toDate(now);
  const sameYear = reference ? londonParts(reference).year === p.year : true;
  const day = `${p.weekday} ${p.day} ${p.month}${sameYear ? "" : ` ${p.year}`}`;
  return `${day}, ${p.time} ${p.zone}`;
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
