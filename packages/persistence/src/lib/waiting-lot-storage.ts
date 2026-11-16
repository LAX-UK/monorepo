import type { Database } from "@auction/db";
import { collectionPlace, deliveryQuote } from "@auction/db/schema";
import {
  type DateKey,
  type StorageCalendar,
  type StorageQuoteHold,
  addDaysToKey,
  daysBetweenKeys,
  londonDateKey,
  storageQuotePauses,
  storageTermsForLot,
} from "@auction/domain";
import { desc, inArray, sql } from "drizzle-orm";
import { collectByCalendarRange, readCollectByCalendars } from "./collect-by-calendars.js";
import { type LotStoragePricing, readLotStoragePricing } from "./purchase-storage-pricing.js";

/** A lot waiting at a place whose storage is to be priced. */
export type WaitingLotRef = {
  lotId: string;
  venueId: string;
  /** The account that bought it: only its own courier quotes hold the clock. */
  buyerLegalEntityId: string;
  clearedAt: Date;
  /** The terms recorded when its sale closed; `null` for a lot won before the first terms. */
  storageTermsId: string | null;
  large: boolean;
};

/** Everything the storage rules need about one waiting lot, beyond when its payment cleared. */
export type WaitingLotStorage = {
  pricing: LotStoragePricing;
  /** The place raises storage invoices ("Raise storage invoices" is on). */
  chargingOn: boolean;
  /** The buyer's live courier quote on the lot, newest first, withdrawn ones last; `null` for none. */
  quote: StorageQuoteHold | null;
  /** The place's opening calendar; `undefined` when the place has none to read. */
  calendar: StorageCalendar | undefined;
};

/**
 * The last day a lot's collect-by day can need the calendar for: working days and extensions
 * reach further than calendar days, so twice the free period and the extension after it. The
 * buyer purchases read and this reader use the same reach.
 */
export function storageCalendarReach(
  clearedOn: DateKey,
  pricing: LotStoragePricing,
  /** Days the clock is paused for a shipping quote: they push the collect-by day later too. */
  pausedDays = 0,
): DateKey {
  const reach = storageTermsForLot(pricing.terms).freeDays * 2 + pricing.extensionDays + pausedDays;
  return addDaysToKey(clearedOn, reach);
}

/**
 * The terms, extensions, waiver, courier quote, charging switch and opening calendar of each
 * waiting lot, read in a fixed number of queries per call (and per place for the calendars), so the
 * reminder sweep and the staff Not collected tab price lots exactly as the buyer's page does.
 */
export async function readWaitingLotStorage(
  db: Database,
  lots: readonly WaitingLotRef[],
): Promise<Map<string, WaitingLotStorage>> {
  if (lots.length === 0) return new Map();
  const lotIds = lots.map((l) => l.lotId);
  const venueIds = [...new Set(lots.map((l) => l.venueId))];
  const [pricing, places, quotes] = await Promise.all([
    readLotStoragePricing(db, lots),
    db
      .select({
        venueId: collectionPlace.venueId,
        raiseStorageInvoices: collectionPlace.raiseStorageInvoices,
      })
      .from(collectionPlace)
      .where(inArray(collectionPlace.venueId, venueIds)),
    db
      .select({
        lotId: deliveryQuote.lotId,
        buyerLegalEntityId: deliveryQuote.buyerLegalEntityId,
        status: deliveryQuote.status,
        requestedAt: deliveryQuote.requestedAt,
        quotedAt: deliveryQuote.quotedAt,
      })
      .from(deliveryQuote)
      .where(inArray(deliveryQuote.lotId, lotIds))
      .orderBy(
        sql`CASE WHEN ${deliveryQuote.status} = 'withdrawn' THEN 1 ELSE 0 END`,
        desc(deliveryQuote.requestedAt),
      ),
  ]);
  const chargingOn = new Map(places.map((p) => [p.venueId, p.raiseStorageInvoices]));
  const buyerOf = new Map(lots.map((l) => [l.lotId, l.buyerLegalEntityId]));
  const quoteOf = new Map<string, StorageQuoteHold>();
  for (const q of quotes) {
    if (quoteOf.has(q.lotId) || buyerOf.get(q.lotId) !== q.buyerLegalEntityId) continue;
    quoteOf.set(q.lotId, { status: q.status, requestedAt: q.requestedAt, quotedAt: q.quotedAt });
  }
  const none: LotStoragePricing = { terms: null, large: false, extensionDays: 0, waived: false };
  const today = londonDateKey(new Date());
  const counted = new Map<string, DateKey[]>();
  for (const l of lots) {
    const clearedOn = londonDateKey(l.clearedAt);
    const pausedDays = storageQuotePauses(quoteOf.get(l.lotId), today).reduce(
      (total, { from, to }) => total + daysBetweenKeys(from, to) + 1,
      0,
    );
    const reach = storageCalendarReach(clearedOn, pricing.get(l.lotId) ?? none, pausedDays);
    counted.set(l.venueId, [...(counted.get(l.venueId) ?? []), clearedOn, reach]);
  }
  const ranges = new Map(
    [...counted].flatMap(([venueId, days]) => {
      const range = collectByCalendarRange(days);
      return range ? [[venueId, range] as const] : [];
    }),
  );
  const calendars = await readCollectByCalendars(db, ranges);
  return new Map(
    lots.map((l) => [
      l.lotId,
      {
        pricing: pricing.get(l.lotId) ?? { ...none, large: l.large },
        chargingOn: chargingOn.get(l.venueId) ?? false,
        quote: quoteOf.get(l.lotId) ?? null,
        calendar: calendars.get(l.venueId),
      },
    ]),
  );
}
