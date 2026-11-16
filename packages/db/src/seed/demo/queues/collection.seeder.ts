import { inArray } from "drizzle-orm";
import * as schema from "../../../schema/index.js";
import { DEMO_IDS } from "../demo-topup-ids.js";
import { loadPaidPurchase } from "./paid-purchase.js";
import type { QueueContext, QueueSeeder } from "./queue-context.js";
import { DEMO_FREE_STORAGE_DAYS, DEMO_VENUE, QUEUE_ANCHORS, QUEUE_IDS } from "./queue-ids.js";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const STORAGE_TERMS_START = "2026-01-01";

/** Starts of the visit: ten in the morning, UTC, a few days out. */
export function bookingSlot(now: number, daysAhead: number): { start: Date; end: Date } {
  const day = new Date(now + daysAhead * DAY);
  const start = Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), 10, 0);
  return { start: new Date(start), end: new Date(start + 30 * 60_000) };
}

/**
 * Fulfilment inbox: a collection point with a booked visit, and a paid lot nobody has collected
 * after its free storage days ran out (so the storage screen has an overdue lot to show).
 */
export const collectionSeeder: QueueSeeder = {
  queue: "Collection bookings and storage",
  async seed({ db, now, people, staff, laxStockId }: QueueContext) {
    const venueId = QUEUE_IDS.venue(1);
    await db
      .insert(schema.venue)
      .values({
        id: venueId,
        legalEntityId: laxStockId,
        name: DEMO_VENUE.name,
        slug: "demo-collection-point",
        addressLine1: DEMO_VENUE.addressLine1,
        city: DEMO_VENUE.city,
        postcode: DEMO_VENUE.postcode,
        country: DEMO_VENUE.country,
        contactEmail: DEMO_VENUE.contactEmail,
      })
      .onConflictDoNothing();
    await db
      .insert(schema.collectionPlace)
      .values({
        venueId,
        onlineBookingEnabled: true,
        freeStorageDays: DEMO_FREE_STORAGE_DAYS,
        updatedByUserId: staff.adminUserId,
      })
      .onConflictDoNothing();
    await db
      .insert(schema.collectionStorageTerms)
      .values({
        id: QUEUE_IDS.storageTerms(1),
        venueId,
        freeDays: DEMO_FREE_STORAGE_DAYS,
        standardDailyPence: 500,
        handlingFeePence: 0,
        effectiveFrom: STORAGE_TERMS_START,
        reason: "Demo terms for the example collection point.",
        createdByUserId: staff.adminUserId,
      })
      .onConflictDoNothing();
    await db
      .update(schema.sale)
      .set({ venueId })
      .where(
        inArray(
          schema.sale.id,
          QUEUE_ANCHORS.collectionSales.map((n) => DEMO_IDS.sale(n)),
        ),
      );

    await seedStoredLot(db, now, people.fulfilment);
    await seedBooking(db, now, venueId, people.fulfilment);
  },
};

/** Paid 40 days ago, still at the venue, 26 days past its 14 free days. */
async function seedStoredLot(db: QueueContext["db"], now: number, actor: string) {
  const purchase = await loadPaidPurchase(db, QUEUE_ANCHORS.paidLotForCollection);
  const clearedAt = new Date(now - 40 * DAY);
  const values = {
    lotId: purchase.lotId,
    paymentId: purchase.paymentId,
    status: "ready_for_collection" as const,
    fulfilmentMethod: "collection" as const,
    releaseApprovedByUserId: actor,
    releaseApprovedAt: clearedAt,
    paymentClearedAt: clearedAt,
    storageTermsId: QUEUE_IDS.storageTerms(1),
    notes: "Demo lot waiting past its free storage days.",
  };
  await db
    .insert(schema.lotFulfilment)
    .values(values)
    .onConflictDoUpdate({
      target: schema.lotFulfilment.lotId,
      set: { ...values, updatedAt: new Date(now) },
    });
}

/** A visit booked a few days ahead, for a different paid lot. */
async function seedBooking(db: QueueContext["db"], now: number, venueId: string, actor: string) {
  const purchase = await loadPaidPurchase(db, QUEUE_ANCHORS.paidLotForBooking);
  const slot = bookingSlot(now, 3);
  const bookingId = QUEUE_IDS.booking(1);
  await db
    .insert(schema.collectionBooking)
    .values({
      id: bookingId,
      legalEntityId: purchase.buyerEntityId,
      venueId,
      slotStart: slot.start,
      slotEnd: slot.end,
      seat: 1,
      status: "booked",
      bookedByUserId: actor,
      bookedVia: "staff",
      collectorKind: "self",
      collectorName: "Alex Example",
      collectorEmail: "alex.example@example.com",
      idempotencyKey: "demo-queues-booking-0001",
      requestFingerprint: "demo-queues-booking-0001",
    })
    .onConflictDoUpdate({
      target: schema.collectionBooking.id,
      set: { slotStart: slot.start, slotEnd: slot.end, status: "booked", updatedAt: new Date(now) },
    });
  await db
    .insert(schema.collectionBookingLot)
    .values({ bookingId, lotId: purchase.lotId })
    .onConflictDoNothing();
}
