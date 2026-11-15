import type { Database } from "@auction/db";
import {
  type CollectByCalendar,
  type DateKey,
  MAX_OPEN_DAY_LOOKAHEAD_DAYS,
  addDaysToKey,
  createCollectionCalendar,
} from "@auction/domain";
import { DrizzleCollectionPlaceRepository } from "./drizzle-collection-place.repository.js";

/** The days a place's "please collect by" counts land on, and the ones after to look through. */
export type CollectByDayRange = { from: DateKey; to: DateKey };

/** Widens a range of counted days by the look-ahead the next-open-day search can reach. */
export function collectByCalendarRange(days: readonly DateKey[]): CollectByDayRange | null {
  if (days.length === 0) return null;
  const sorted = [...days].sort();
  return {
    from: sorted[0] as DateKey,
    to: addDaysToKey(sorted[sorted.length - 1] as DateKey, MAX_OPEN_DAY_LOOKAHEAD_DAYS),
  };
}

/**
 * The opening calendar of each place over its range, for moving a "please collect by" day that
 * falls on a closed day to the next open one. It is the same calendar the booking page uses:
 * the weekly hours, bank holidays, staff closures and sale days.
 */
export async function readCollectByCalendars(
  db: Database,
  places: ReadonlyMap<string, CollectByDayRange>,
  now: Date = new Date(),
): Promise<Map<string, CollectByCalendar>> {
  const repository = new DrizzleCollectionPlaceRepository(db);
  const calendars = new Map<string, CollectByCalendar>();
  for (const [venueId, range] of places) {
    const facts = await repository.readCalendarFacts(venueId, range, now);
    calendars.set(
      venueId,
      createCollectionCalendar({
        hours: facts.hours,
        exceptions: facts.exceptions,
        rules: facts.settings,
      }),
    );
  }
  return calendars;
}
