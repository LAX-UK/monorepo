/**
 * Data the collection journeys (apps/web/e2e/org-roles-collection.spec.ts and
 * admin-collections-desk.spec.ts) run against, and what staff see on the test site: a place that
 * collects (hours Monday to Friday, a closure and an extra opening), paid and released lots bought
 * for Northbank Gallery, and a visit in each state (booked, collected, partly collected, not
 * collected, cancelled), plus a lot nothing is booked for.
 *
 * Visits are placed by working days from the day the seed runs, because a buyer can only change a
 * visit that is still ahead and staff can only mark one not collected once it has started.
 */
import type { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../../schema/index.js";
import {
  addDays,
  COLLECTION_JOURNEY_IDS as ids,
  COLLECTION_JOURNEY_NAMES as names,
  COLLECTION_JOURNEY_REFERENCES as references,
  workday,
} from "./collection-journey-ids.js";
import { collectionJourneyVisits, londonDay } from "./collection-journey-visits.js";

type Db = ReturnType<typeof drizzle<typeof schema>>;

export type CollectionJourneyActors = {
  adminId: string;
  /** Won the lots; no check stands in the way of collecting them. */
  winnerId: string;
  /** Northbank Gallery: approved; its owner books and collects. */
  northbankId: string;
  /** The seller of the lots. */
  sellerAccountId: string;
  /** The account that owns the place and the sale. */
  laxStockId: string;
};

const DAY = 86_400_000;
const IMAGE = "https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=1200&q=80";

type LotState = "released" | "unreleased" | "delivered";

export async function seedCollectionJourneys(db: Db, actors: CollectionJourneyActors) {
  const now = new Date();
  const today = londonDay(now);
  const visits = collectionJourneyVisits(now);
  const paidAt = new Date(now.getTime() - 9 * DAY);

  await db.insert(schema.venue).values({
    id: ids.venue,
    legalEntityId: actors.laxStockId,
    name: names.venue,
    slug: "collections-journeys-gallery",
    addressLine1: "156 New Cavendish Street",
    city: "London",
    postcode: "W1W 6YW",
    country: "United Kingdom",
    photos: [],
    status: "active",
  });
  await db.insert(schema.sale).values({
    id: ids.sale,
    title: "Collections journeys sale",
    description: "A closed sale whose buyers collect from the gallery.",
    coverImages: [IMAGE],
    deliveryMode: "online",
    status: "ended",
    startTime: new Date(now.getTime() - 30 * DAY),
    endTime: new Date(now.getTime() - 10 * DAY),
    buyerPremiumRate: "0.25",
    terms: "Collection from the gallery, Monday to Friday.",
    venueId: ids.venue,
    createdByLegalEntityId: actors.laxStockId,
  });

  // The place: online booking on, the gallery's usual rules, 30 days' free storage.
  await db.insert(schema.collectionPlace).values({
    venueId: ids.venue,
    onlineBookingEnabled: true,
    freeStorageDays: 30,
    // Five visits are already booked for Northbank; the journeys book and move more.
    maxActiveVisits: 10,
    updatedByUserId: actors.adminId,
  });
  await db.insert(schema.collectionWeeklyHours).values(
    [1, 2, 3, 4, 5].map((weekday) => ({
      venueId: ids.venue,
      weekday,
      opensLocal: "10:00",
      closesLocal: "19:00",
    })),
  );
  // A day the gallery is shut, and a Saturday it opens, both inside the booking window.
  await db.insert(schema.collectionException).values([
    {
      venueId: ids.venue,
      kind: "closure",
      startsOn: workday(today, 8),
      endsOn: workday(today, 8),
      source: "staff",
      reasonInternal: "Hanging a new exhibition",
      createdByUserId: actors.adminId,
    },
    {
      venueId: ids.venue,
      kind: "extra_opening",
      startsOn: nextSaturday(today),
      endsOn: nextSaturday(today),
      opensLocal: "11:00",
      closesLocal: "15:00",
      source: "staff",
      reasonInternal: "Open for collections before the sale",
      createdByUserId: actors.adminId,
    },
  ]);

  const lotBase = {
    sellerLegalEntityId: actors.sellerAccountId,
    saleId: ids.sale,
    images: [IMAGE],
    auctionType: "english" as const,
    buyerPremiumRate: "0.25",
    dutchDecrementIntervalMs: 60_000,
    // Small amounts: enough lots at a higher price would trip the source-of-funds threshold, which
    // holds collection, and push the buyer's card limit for the other journeys.
    startingPrice: "50.00",
    currentPrice: "100.00",
    minBidIncrement: "10.00",
    startTime: new Date(now.getTime() - 30 * DAY),
    endTime: new Date(now.getTime() - 10 * DAY),
    status: "ended" as const,
    winnerId: actors.winnerId,
    buyerLegalEntityId: actors.northbankId,
  };
  const lotSpecs: { id: string; title: string; state: LotState; booked?: boolean }[] = [
    { id: ids.lotToBook, title: names.lots.toBook, state: "released" },
    { id: ids.lotToChange, title: names.lots.toChange, state: "released", booked: true },
    { id: ids.lotToCancel, title: names.lots.toCancel, state: "released", booked: true },
    { id: ids.lotToHandOver, title: names.lots.toHandOver, state: "released", booked: true },
    { id: ids.lotUnreleased, title: names.lots.unreleased, state: "unreleased", booked: true },
    { id: ids.lotNoShow, title: names.lots.noShow, state: "released", booked: true },
    { id: ids.lotMissed, title: names.lots.missed, state: "released" },
    { id: ids.lotCollected, title: names.lots.collected, state: "delivered" },
    { id: ids.lotPartlyTaken, title: names.lots.partlyTaken, state: "delivered" },
    { id: ids.lotPartlyLeft, title: names.lots.partlyLeft, state: "released" },
    { id: ids.lotCancelled, title: names.lots.cancelled, state: "released" },
  ];
  await db.insert(schema.lot).values(
    lotSpecs.map((spec, index) => ({
      ...lotBase,
      id: spec.id,
      lotNumber: index + 1,
      title: spec.title,
      description: "A paid lot waiting at the gallery for its buyer to collect.",
    })),
  );
  await db.insert(schema.bid).values(
    lotSpecs.map((spec) => ({
      lotId: spec.id,
      bidderId: actors.winnerId,
      subjectId: actors.winnerId,
      buyerLegalEntityId: actors.northbankId,
      amount: "100.00",
      isWinning: true,
      isAutoBid: false,
      maxAutoBidAmount: null,
      createdAt: new Date(now.getTime() - 12 * DAY),
    })),
  );
  const payments = await db
    .insert(schema.payment)
    .values(
      lotSpecs.map((spec) => ({
        lotId: spec.id,
        buyerId: actors.winnerId,
        buyerLegalEntityId: actors.northbankId,
        sellerLegalEntityId: actors.sellerAccountId,
        amount: "125.00",
        platformFee: "25.00",
        status: "captured" as const,
        createdAt: paidAt,
      })),
    )
    .returning({ id: schema.payment.id, lotId: schema.payment.lotId });
  const paymentOf = new Map(payments.map((row) => [row.lotId, row.id]));

  await db.insert(schema.lotFulfilment).values(
    lotSpecs.map((spec) => {
      const base = {
        lotId: spec.id,
        paymentId: paymentOf.get(spec.id) as string,
        paymentClearedAt: paidAt,
        createdAt: paidAt,
        updatedAt: paidAt,
      };
      if (spec.state === "unreleased") return { ...base, status: "awaiting_release" as const };
      const released = {
        ...base,
        status: "released" as const,
        releaseApprovedByUserId: actors.adminId,
        releaseApprovedAt: new Date(paidAt.getTime() + 2 * 60 * 60_000),
        ...(spec.booked ? { fulfilmentMethod: "collection" as const } : {}),
      };
      if (spec.state === "released") return released;
      return {
        ...released,
        status: "delivered" as const,
        fulfilmentMethod: "collection" as const,
        collectedBy: names.collector,
        collectedByUserId: actors.adminId,
        collectedAt: visits.collected.start,
      };
    }),
  );

  type Booking = typeof schema.collectionBooking.$inferInsert;
  const booking = (
    reference: string,
    when: { start: Date; end: Date },
    over: Partial<Booking> = {},
  ): Booking => ({
    reference,
    legalEntityId: actors.northbankId,
    venueId: ids.venue,
    slotStart: when.start,
    slotEnd: when.end,
    seat: 1,
    status: "booked",
    bookedByUserId: actors.winnerId,
    bookedVia: "client",
    collectorKind: "self",
    collectorName: names.collector,
    idempotencyKey: `journey-${reference}`,
    requestFingerprint: `journey-${reference}`,
    createdAt: new Date(now.getTime() - 5 * DAY),
    updatedAt: new Date(now.getTime() - 5 * DAY),
    ...over,
  });
  const handedOverAt = (when: { start: Date }) => new Date(when.start.getTime() + 12 * 60_000);
  const bookings: {
    row: Booking;
    lots: { lotId: string; active?: boolean; outcome?: string }[];
  }[] = [
    { row: booking(references.toChange, visits.toChange), lots: [{ lotId: ids.lotToChange }] },
    { row: booking(references.toCancel, visits.toCancel), lots: [{ lotId: ids.lotToCancel }] },
    {
      row: booking(references.toHandOver, visits.toHandOver),
      lots: [{ lotId: ids.lotToHandOver }],
    },
    {
      row: booking(references.unreleased, visits.unreleased),
      lots: [{ lotId: ids.lotUnreleased }],
    },
    { row: booking(references.noShow, visits.noShow), lots: [{ lotId: ids.lotNoShow }] },
    {
      row: booking(references.missed, visits.missed, {
        status: "not_collected",
        outcomeByUserId: actors.adminId,
        outcomeAt: new Date(visits.missed.start.getTime() + 30 * 60_000),
      }),
      // Marked not collected: its lot is free again, so staff can rebook it.
      lots: [{ lotId: ids.lotMissed, active: false }],
    },
    {
      row: booking(references.collected, visits.collected, {
        status: "collected",
        idCheckType: "passport",
        outcomeByUserId: actors.adminId,
        outcomeAt: handedOverAt(visits.collected),
      }),
      lots: [{ lotId: ids.lotCollected, active: false, outcome: "collected" }],
    },
    {
      row: booking(references.partlyCollected, visits.partlyCollected, {
        status: "partly_collected",
        idCheckType: "driving_licence",
        outcomeByUserId: actors.adminId,
        outcomeAt: handedOverAt(visits.partlyCollected),
      }),
      lots: [
        { lotId: ids.lotPartlyTaken, active: false, outcome: "collected" },
        { lotId: ids.lotPartlyLeft, active: false, outcome: "left" },
      ],
    },
    {
      row: booking(references.cancelled, visits.cancelled, {
        status: "cancelled",
        cancelledByUserId: actors.winnerId,
        cancelledAt: new Date(now.getTime() - 1 * DAY),
      }),
      lots: [{ lotId: ids.lotCancelled, active: false }],
    },
  ];
  const created = await db
    .insert(schema.collectionBooking)
    .values(bookings.map(({ row }) => row))
    .returning({ id: schema.collectionBooking.id, reference: schema.collectionBooking.reference });
  const idOf = new Map(created.map((row) => [row.reference, row.id]));
  await db.insert(schema.collectionBookingLot).values(
    bookings.flatMap(({ row, lots }) =>
      lots.map((entry) => ({
        bookingId: idOf.get(row.reference as string) as string,
        lotId: entry.lotId,
        active: entry.active ?? true,
        outcome: entry.outcome ?? null,
        ...(entry.outcome === "collected" ? { previousFulfilmentStatus: "released" } : {}),
      })),
    ),
  );
}

/** The next Saturday after `day`, a London day. */
function nextSaturday(day: string): string {
  let current = addDays(day, 1);
  while (new Date(`${current}T12:00:00Z`).getUTCDay() !== 6) current = addDays(current, 1);
  return current;
}
