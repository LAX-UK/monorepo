/** LAX trades from London, so "this year" is the calendar year on UK time. */
export const BUSINESS_TIME_ZONE = "Europe/London";

export type CalendarYear = {
  year: number;
  /** First instant of the year (inclusive). */
  from: Date;
  /** First instant of the next year (exclusive). */
  to: Date;
};

const yearFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: BUSINESS_TIME_ZONE,
  year: "numeric",
});

/** Minutes London is ahead of UTC at `instant` (0 in winter, 60 in summer). */
function londonOffsetMinutes(instant: Date): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: BUSINESS_TIME_ZONE,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(instant);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);
  const asUtc = Date.UTC(
    part("year"),
    part("month") - 1,
    part("day"),
    part("hour"),
    part("minute"),
  );
  return Math.round((asUtc - instant.getTime()) / 60_000);
}

/** Midnight on 1 January of `year` in London, as an instant. */
function londonNewYear(year: number): Date {
  const utcMidnight = new Date(Date.UTC(year, 0, 1));
  return new Date(utcMidnight.getTime() - londonOffsetMinutes(utcMidnight) * 60_000);
}

/** The London calendar year that `now` falls in, as a half-open range of instants. */
export function londonCalendarYear(now: Date): CalendarYear {
  const year = Number(yearFormatter.format(now));
  return { year, from: londonNewYear(year), to: londonNewYear(year + 1) };
}
