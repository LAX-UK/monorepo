import {
  formatLondonDateTime,
  formatLondonDayMonth,
  formatLondonWeekday,
} from "@/lib/datetime/london-time";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Beyond this, a moment is told as a date, not as a countdown. */
export const OPENS_COUNTDOWN_WITHIN_MS = 7 * DAY;

export type OpensLine = {
  /** "Opens in" for a countdown, "Opens" before a date. */
  label: string;
  value: string;
};

function plural(n: number, unit: string): string {
  return `${n} ${unit}${n === 1 ? "" : "s"}`;
}

/**
 * When something opens, by the time rule: beyond a week the date ("Opens 27 Nov 2026, 20:19 GMT");
 * within a week days and hours ("Opens in 2 days 14 hours"); within a day hours and minutes; within
 * an hour minutes. Seconds belong to the final hour of a closing lot, not to an opening.
 */
export function opensLine(target: Date, now: Date, prefix = "Opens"): OpensLine {
  const ms = target.getTime() - now.getTime();
  if (ms <= 0) return { label: prefix, value: "now" };
  if (ms > OPENS_COUNTDOWN_WITHIN_MS) {
    return { label: prefix, value: formatLondonDateTime(target) };
  }
  const days = Math.floor(ms / DAY);
  const hours = Math.floor((ms % DAY) / HOUR);
  const minutes = Math.floor((ms % HOUR) / MINUTE);
  const label = `${prefix} in`;
  if (days > 0) return { label, value: `${plural(days, "day")} ${plural(hours, "hour")}` };
  if (hours > 0) return { label, value: `${plural(hours, "hour")} ${plural(minutes, "minute")}` };
  return { label, value: minutes > 0 ? plural(minutes, "minute") : "less than a minute" };
}

/** "Tue 10 Nov": the weekday and day, for a badge that says when something opens. */
export function opensBadgeLabel(target: Date, now: Date): string {
  return `Opens ${formatLondonWeekday(target)} ${formatLondonDayMonth(target, now)}`;
}
