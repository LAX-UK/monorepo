import { calendarYear, dayKey, offsetMinutes, wallClockToInstant } from "@auction/datetime";

/** LAX trades from London, so "this year" is the calendar year on UK time. */
export const BUSINESS_TIME_ZONE = "Europe/London";

export type CalendarYear = {
  year: number;
  /** First instant of the year (inclusive). */
  from: Date;
  /** First instant of the next year (exclusive). */
  to: Date;
};

/** Minutes London is ahead of UTC at `instant` (0 in winter, 60 in summer). */
export function londonOffsetMinutes(instant: Date): number {
  return offsetMinutes(instant, BUSINESS_TIME_ZONE);
}

/** The instant of a wall-clock time on a calendar day in London. Days past month end roll over. */
function londonInstant(year: number, month: number, day: number, time: string): Date {
  const calendarDay = new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10);
  const result = wallClockToInstant(calendarDay, time, BUSINESS_TIME_ZONE);
  if (!result.ok) throw new RangeError(`London has no ${time} on ${calendarDay}`);
  return result.instant;
}

/** Midnight on 1 January of `year` in London, as an instant. */
function londonNewYear(year: number): Date {
  return londonInstant(year, 1, 1, "00:00");
}

/** The London calendar year that `now` falls in, as a half-open range of instants. */
export function londonCalendarYear(now: Date): CalendarYear {
  const year = calendarYear(now, BUSINESS_TIME_ZONE);
  return { year, from: londonNewYear(year), to: londonNewYear(year + 1) };
}

/** The London calendar day `instant` falls on. */
export function londonDateOf(instant: Date): { year: number; month: number; day: number } {
  const [year, month, day] = dayKey(instant, BUSINESS_TIME_ZONE).split("-").map(Number);
  return { year: year ?? 0, month: month ?? 1, day: day ?? 1 };
}

/** Midnight in London at the start of the given day (month 1-12; days past month end roll over). */
export function londonMidnight(year: number, month: number, day: number): Date {
  return londonInstant(year, month, day, "00:00");
}

/** The instant at `hour`:00 London wall-clock time on the given day, correct across clock changes. */
export function londonWallClock(year: number, month: number, day: number, hour: number): Date {
  return londonInstant(year, month, day, `${String(hour).padStart(2, "0")}:00`);
}
