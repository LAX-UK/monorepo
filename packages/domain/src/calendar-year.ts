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
export function londonOffsetMinutes(instant: Date): number {
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

const dayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: BUSINESS_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** The London calendar day `instant` falls on. */
export function londonDateOf(instant: Date): { year: number; month: number; day: number } {
  const [year, month, day] = dayFormatter.format(instant).split("-").map(Number);
  return { year: year ?? 0, month: month ?? 1, day: day ?? 1 };
}

/** Midnight in London at the start of the given day (month 1-12; days past month end roll over). */
export function londonMidnight(year: number, month: number, day: number): Date {
  const utcMidnight = new Date(Date.UTC(year, month - 1, day));
  return new Date(utcMidnight.getTime() - londonOffsetMinutes(utcMidnight) * 60_000);
}
