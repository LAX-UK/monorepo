/*
 * London days and the date presets for list filters. A plain module (no "use client"), so server code can call it: a value exported from
 * a client module is only a client reference on the server.
 */

export type DayRange = { from: string; to: string };

const LONDON_DAY = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/London",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Today's date in London as `YYYY-MM-DD`; staff work in UK time whatever their laptop says. */
export function londonToday(now: Date = new Date()): string {
  return LONDON_DAY.format(now);
}

/** The day `count` days before `day` (`YYYY-MM-DD`). */
export function daysBefore(day: string, count: number): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - count);
  return date.toISOString().slice(0, 10);
}

export type DateRangePreset = { id: string; label: string; range: (today: string) => DayRange };

export const DEFAULT_DATE_PRESETS: readonly DateRangePreset[] = [
  { id: "today", label: "Today", range: (today) => ({ from: today, to: today }) },
  { id: "7d", label: "Last 7 days", range: (today) => ({ from: daysBefore(today, 6), to: today }) },
  {
    id: "30d",
    label: "Last 30 days",
    range: (today) => ({ from: daysBefore(today, 29), to: today }),
  },
];
