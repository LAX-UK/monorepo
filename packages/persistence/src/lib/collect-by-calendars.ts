import type { Database } from "@auction/db";
import { collectionException, collectionPlace, collectionWeeklyHours } from "@auction/db/schema";
import {
  type CollectionException,
  type CollectionExceptionSource,
  type DateKey,
  MAX_OPEN_DAY_LOOKAHEAD_DAYS,
  type StorageCalendar,
  addDaysToKey,
  bankHolidayClosures,
  createCollectionCalendar,
} from "@auction/domain";
import { and, asc, eq, gte, lte } from "drizzle-orm";
import { saleDaysAt } from "../repositories/drizzle-collection-closures.js";

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

function yearsIn(range: CollectByDayRange): number[] {
  const first = Number(range.from.slice(0, 4));
  const last = Number(range.to.slice(0, 4));
  return Array.from({ length: last - first + 1 }, (_, i) => first + i);
}

/**
 * The opening calendar of each place over its range, for moving a "please collect by" day that
 * falls on a closed day to the next open one. It is the same calendar the booking page uses: the
 * weekly hours, bank holidays, staff closures and sale days.
 *
 * It only reads, so it runs as a role with SELECT alone (the worker's): a venue with no
 * collection place is skipped, and a year whose bank holidays the booking page has not stored yet
 * gets them from the domain. A holiday staff removed stays removed, because its row is kept.
 */
export async function readCollectByCalendars(
  db: Database,
  places: ReadonlyMap<string, CollectByDayRange>,
): Promise<Map<string, StorageCalendar>> {
  const calendars = new Map<string, StorageCalendar>();
  for (const [venueId, range] of places) {
    const [place] = await db
      .select({ closeOnSaleDays: collectionPlace.closeOnSaleDays })
      .from(collectionPlace)
      .where(eq(collectionPlace.venueId, venueId))
      .limit(1);
    if (!place) continue;
    const hours = await db
      .select({
        weekday: collectionWeeklyHours.weekday,
        opensLocal: collectionWeeklyHours.opensLocal,
        closesLocal: collectionWeeklyHours.closesLocal,
      })
      .from(collectionWeeklyHours)
      .where(eq(collectionWeeklyHours.venueId, venueId))
      .orderBy(asc(collectionWeeklyHours.weekday), asc(collectionWeeklyHours.opensLocal));
    const years = yearsIn(range);
    const rows = await db
      .select()
      .from(collectionException)
      .where(
        and(
          eq(collectionException.venueId, venueId),
          lte(collectionException.startsOn, range.to),
          gte(collectionException.endsOn, range.from),
        ),
      )
      .orderBy(asc(collectionException.startsOn), asc(collectionException.id));
    // Years that already have stored bank holidays (a removed one counts, so it is not re-added).
    const stored = await db
      .select({ startsOn: collectionException.startsOn })
      .from(collectionException)
      .where(
        and(
          eq(collectionException.venueId, venueId),
          eq(collectionException.source, "bank_holiday"),
          gte(collectionException.startsOn, `${years[0]}-01-01`),
          lte(collectionException.startsOn, `${years[years.length - 1]}-12-31`),
        ),
      );
    const storedYears = new Set(stored.map((row) => Number(row.startsOn.slice(0, 4))));
    const unstored = years.filter((year) => !storedYears.has(year));
    const exceptions: CollectionException[] = [
      ...rows
        .filter((row) => row.deletedAt === null)
        .map((row) => ({
          kind: row.kind === "extra_opening" ? ("extra_opening" as const) : ("closure" as const),
          startsOn: row.startsOn,
          endsOn: row.endsOn,
          opensLocal: row.opensLocal,
          closesLocal: row.closesLocal,
          source: row.source as CollectionExceptionSource,
        })),
      ...bankHolidayClosures(unstored).filter(
        (closure) => closure.startsOn <= range.to && closure.endsOn >= range.from,
      ),
      ...(await saleDaysAt(db, venueId, range)),
    ];
    calendars.set(venueId, createCollectionCalendar({ hours, exceptions, rules: place }));
  }
  return calendars;
}
