/**
 * Where each seeded collection visit falls, in London time, for the seed. The days and the working
 * day arithmetic are plain and live in collection-journey-ids.ts, which browser tests also load;
 * the zone work needs @auction/datetime, so it is here.
 */
import { LONDON_TIME_ZONE, dayKey, offsetMinutes } from "@auction/datetime";
import { dayParts, workday } from "./collection-journey-ids.js";

/** The London calendar day of an instant, as "2026-11-10". */
export function londonDay(instant: Date): string {
  return dayKey(instant, LONDON_TIME_ZONE);
}

/** The instant a London wall clock reads `hhmm` on `day`, across the clock changes. */
export function londonInstant(day: string, hhmm: string): Date {
  const { year, month, date } = dayParts(day);
  const [hours, minutes] = hhmm.split(":").map(Number) as [number, number];
  const wall = Date.UTC(year, month - 1, date, hours, minutes);
  // London's offset from UTC at the guess; twice, because the guess may sit across a change.
  let guess = wall;
  for (let round = 0; round < 2; round += 1) {
    guess = wall - offsetMinutes(new Date(guess), LONDON_TIME_ZONE) * 60_000;
  }
  return new Date(guess);
}

export type JourneyVisit = {
  /** The London day of the visit. */
  day: string;
  start: Date;
  end: Date;
};

const visit = (day: string, hhmm: string): JourneyVisit => {
  const start = londonInstant(day, hhmm);
  return { day, start, end: new Date(start.getTime() + 30 * 60_000) };
};

/**
 * When each seeded visit is, counted in working days from the day the seed runs (or the journey,
 * which must run the same day). Visits to come are at least two working days away, so the buyer
 * can still change or cancel them; the others are in the past.
 */
export function collectionJourneyVisits(now: Date) {
  const today = londonDay(now);
  return {
    toChange: visit(workday(today, 4), "14:00"),
    toCancel: visit(workday(today, 5), "14:00"),
    toHandOver: visit(workday(today, 2), "11:00"),
    unreleased: visit(workday(today, 2), "11:30"),
    noShow: visit(workday(today, -1), "14:00"),
    missed: visit(workday(today, -2), "15:00"),
    collected: visit(workday(today, -1), "11:00"),
    partlyCollected: visit(workday(today, -3), "12:00"),
    cancelled: visit(workday(today, 6), "16:00"),
  } as const;
}
