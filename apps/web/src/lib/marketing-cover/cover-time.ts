import {
  formatLondonDayMonth,
  formatLondonTimeWithZone,
  formatLondonWeekday,
  londonDayKey,
} from "@/lib/datetime/london-time";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** A date alone is clear beyond this; closer than this the time left is spelled out. */
export const COVER_COUNTDOWN_WITHIN_MS = 7 * DAY;

function plural(count: number, unit: string): string {
  return `${count} ${unit}${count === 1 ? "" : "s"}`;
}

/**
 * The time left as the cover words it: nothing beyond 7 days (the date is enough), days and
 * hours within a week, hours and minutes within a day, minutes and seconds in the final hour.
 */
export function coverTimeLeft(ms: number): string | null {
  if (ms <= 0 || ms >= COVER_COUNTDOWN_WITHIN_MS) return null;
  if (ms >= DAY) {
    const days = Math.floor(ms / DAY);
    const hours = Math.floor((ms % DAY) / HOUR);
    return hours === 0 ? plural(days, "day") : `${plural(days, "day")} ${plural(hours, "hour")}`;
  }
  if (ms >= HOUR) {
    const hours = Math.floor(ms / HOUR);
    const minutes = Math.floor((ms % HOUR) / MINUTE);
    return minutes === 0
      ? plural(hours, "hour")
      : `${plural(hours, "hour")} ${plural(minutes, "minute")}`;
  }
  const minutes = Math.floor(ms / MINUTE);
  const seconds = Math.floor((ms % MINUTE) / 1000);
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

/** "Tue 3 Nov, 21:00 GMT". */
export function coverMoment(date: Date, now: Date): string {
  return `${formatLondonWeekday(date)} ${formatLondonDayMonth(date, now)}, ${formatLondonTimeWithZone(date)}`;
}

/** "Tue 3 Nov" without the time. */
export function coverDay(date: Date, now: Date): string {
  return `${formatLondonWeekday(date)} ${formatLondonDayMonth(date, now)}`;
}

export type CoverSaleStatus = "scheduled" | "active" | "ended";

/** The words after the status badge: the moment, then the time left when it is near. */
export function coverTimeLine(input: {
  status: CoverSaleStatus;
  start: Date | null;
  end: Date | null;
  now: Date;
}): string | null {
  const { status, start, end, now } = input;
  if (status === "active" && end) {
    const left = coverTimeLeft(end.getTime() - now.getTime());
    const moment = `Lots close from ${coverMoment(end, now)}`;
    return left ? `${moment} · ${left} left` : moment;
  }
  if (status === "scheduled" && start) {
    const left = coverTimeLeft(start.getTime() - now.getTime());
    const moment = `Opens ${coverMoment(start, now)}`;
    return left ? `${moment} · in ${left}` : moment;
  }
  if (status === "ended" && end) {
    return londonDayKey(end) === londonDayKey(now)
      ? `Ended today, ${formatLondonTimeWithZone(end)}`
      : `Ended ${coverDay(end, now)}`;
  }
  return null;
}
