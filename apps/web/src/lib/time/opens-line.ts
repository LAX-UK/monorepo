import {
  formatLondonDateTime,
  formatLondonDayMonth,
  formatLondonWeekday,
} from "@/lib/datetime/london-time";
import { COUNTDOWN_DATE_BEYOND_MS, formatCountdownForDisplay } from "@/lib/format-countdown";

/** Beyond this, a moment is told as a date, not as a countdown. */
export const OPENS_COUNTDOWN_WITHIN_MS = COUNTDOWN_DATE_BEYOND_MS;

export type OpensLine = {
  /** "Opens in" for a countdown, "Opens" before a date. */
  label: string;
  value: string;
};

/**
 * When something opens, by the time rule: beyond a week the date ("Opens 27 Nov 2026, 20:19 GMT");
 * within a week days and hours ("Opens in 2 days 14 hours"); within a day hours and minutes; seconds
 * only in the final hour. Also serves "Closes" through `prefix`.
 */
export function opensLine(target: Date, now: Date, prefix = "Opens"): OpensLine {
  const ms = target.getTime() - now.getTime();
  if (ms <= 0) return { label: prefix, value: "now" };
  if (ms > OPENS_COUNTDOWN_WITHIN_MS) {
    return { label: prefix, value: formatLondonDateTime(target) };
  }
  return { label: `${prefix} in`, value: formatCountdownForDisplay(ms) };
}

/** "Tue 10 Nov": the weekday and day, the short date for a chip or badge. */
export function shortMoment(target: Date, now: Date): string {
  return `${formatLondonWeekday(target)} ${formatLondonDayMonth(target, now)}`;
}

/** "Opens Tue 10 Nov": for a badge that says when something opens. */
export function opensBadgeLabel(target: Date, now: Date): string {
  return `Opens ${shortMoment(target, now)}`;
}
