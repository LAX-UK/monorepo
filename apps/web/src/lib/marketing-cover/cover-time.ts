import {
  formatLondonDayMonth,
  formatLondonTimeWithZone,
  formatLondonWeekday,
  londonDayKey,
} from "@/lib/datetime/london-time";

import { type CoverTimeTick, formatCoverClock } from "@auction/marketing-ui";

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
  return formatCoverClock(ms);
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
export type CoverTimeText = { time: string; timeTick?: CoverTimeTick };

/** In the final hour the line counts every second: the clock goes where `{time}` stands. */
function counting(moment: string, target: Date, now: Date, wording: "left" | "in"): CoverTimeText {
  const ms = target.getTime() - now.getTime();
  const left = coverTimeLeft(ms);
  const line = (clock: string) => (wording === "left" ? `${clock} left` : `in ${clock}`);
  if (!left) return { time: moment };
  const time = `${moment} · ${line(left)}`;
  if (ms >= HOUR) return { time };
  return {
    time,
    timeTick: { endsAt: target.toISOString(), template: `${moment} · ${line("{time}")}` },
  };
}

export function coverTimeLine(input: {
  status: CoverSaleStatus;
  start: Date | null;
  end: Date | null;
  now: Date;
}): CoverTimeText | null {
  const { status, start, end, now } = input;
  if (status === "active" && end) {
    return counting(`Lots close from ${coverMoment(end, now)}`, end, now, "left");
  }
  if (status === "scheduled" && start) {
    return counting(`Opens ${coverMoment(start, now)}`, start, now, "in");
  }
  if (status === "ended" && end) {
    return {
      time:
        londonDayKey(end) === londonDayKey(now)
          ? `Ended today, ${formatLondonTimeWithZone(end)}`
          : `Ended ${coverDay(end, now)}`,
    };
  }
  return null;
}
