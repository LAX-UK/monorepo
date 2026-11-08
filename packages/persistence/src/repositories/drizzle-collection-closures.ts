import type { Database } from "@auction/db";
import { collectionException, sale } from "@auction/db/schema";
import {
  type DateKey,
  type SaleDayClosure,
  bankHolidayClosures,
  bankHolidayYears,
  saleDayClosures,
} from "@auction/domain";
import { and, eq, gte, lte, ne } from "drizzle-orm";

/**
 * The closures Bid works out for a place, shared by the booking calendar and the staff screen so
 * they can never disagree.
 *
 * - Bank holidays (England and Wales) are stored per place as closures so staff can remove one.
 *   A holiday staff removed is remembered (the row is only marked deleted) and is not added back.
 * - Sale days are not stored: they are read from the place's sales each time, so a sale that is
 *   moved or cancelled needs no clean-up. Staff open such a day with an extra opening.
 */

/** Adds the bank holidays of this year and the next two that the place does not have yet. */
export async function ensureBankHolidays(
  db: Database,
  venueId: string,
  now: Date,
): Promise<number> {
  const years = bankHolidayYears(now);
  const wanted = bankHolidayClosures(years);
  const known = await db
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
  const have = new Set(known.map((row) => row.startsOn));
  const missing = wanted.filter((closure) => !have.has(closure.startsOn));
  if (missing.length === 0) return 0;
  const inserted = await db
    .insert(collectionException)
    .values(
      missing.map((closure) => ({
        venueId,
        kind: closure.kind,
        startsOn: closure.startsOn,
        endsOn: closure.endsOn,
        source: closure.source,
      })),
    )
    .onConflictDoNothing()
    .returning({ id: collectionException.id });
  return inserted.length;
}

/** The sale days at the place that touch the range, as closures (not stored). */
export async function saleDaysAt(
  db: Database,
  venueId: string,
  range: { from: DateKey; to: DateKey },
): Promise<SaleDayClosure[]> {
  // Widen by a day each side, so a sale near midnight London time is never missed, then let the
  // domain keep only the days that touch the range.
  const from = new Date(`${range.from}T00:00:00Z`);
  from.setUTCDate(from.getUTCDate() - 1);
  const to = new Date(`${range.to}T23:59:59Z`);
  to.setUTCDate(to.getUTCDate() + 1);
  const rows = await db
    .select({
      id: sale.id,
      title: sale.title,
      startTime: sale.startTime,
      endTime: sale.endTime,
      deliveryMode: sale.deliveryMode,
      status: sale.status,
    })
    .from(sale)
    .where(
      and(
        eq(sale.venueId, venueId),
        ne(sale.status, "draft"),
        ne(sale.status, "cancelled"),
        lte(sale.startTime, to),
        gte(sale.endTime, from),
      ),
    );
  return saleDayClosures(rows).filter(
    (closure) => closure.startsOn <= range.to && closure.endsOn >= range.from,
  );
}
