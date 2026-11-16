import { createHash } from "node:crypto";
import {
  COLLECTION_BOOKING_EVENT_AGGREGATE,
  type CollectionSlot,
  DEFAULT_COLLECTION_RULES,
  DEFAULT_COLLECTION_WEEKLY_HOURS,
  collectionBookingCreated,
  collectionRequestCanonical,
  collectionSlots,
} from "@auction/domain";
import * as schema from "../../../schema/index.js";
import { DEMO_PEOPLE } from "../demo-topup-ids.js";
import { ensureCollectionSale } from "./collection-sale.js";
import type { QueueContext, QueueSeeder } from "./queue-context.js";
import { QUEUE_IDS } from "./queue-ids.js";
import { writeSeedEvents } from "./seed-events.js";

const DAY = 86_400_000;
const IDEMPOTENCY_KEY = "demo-queues-booking-0001";

/**
 * The first time the demo collection point offers, at least `daysAhead` days out, by the same
 * calendar the desk checks a staff booking against (the place's hours and rules, no closures).
 */
export function firstOfferedSlot(now: number, daysAhead: number): CollectionSlot {
  const days = collectionSlots({
    hours: DEFAULT_COLLECTION_WEEKLY_HOURS,
    exceptions: [],
    rules: DEFAULT_COLLECTION_RULES,
    now: new Date(now),
  });
  const earliest = now + daysAhead * DAY;
  for (const day of days) {
    const slot = day.slots.find((s) => s.state === "open" && s.start.getTime() >= earliest);
    if (slot) return slot;
  }
  throw new Error("[demo-queues] the demo collection point offers no visit in its window");
}

/** The digest a booking request is stored with, as the booking repository makes it. */
export function bookingFingerprint(request: Parameters<typeof collectionRequestCanonical>[0]) {
  return createHash("sha256").update(collectionRequestCanonical(request)).digest("hex");
}

/**
 * Collection desk (`/admin/collections`, the demo collection point, Upcoming tab) and the lot
 * fulfilment list: a visit staff booked for the client, a few days ahead, to collect a lot that
 * was paid and released. Written once, in a slot the place offers; a cancelled, moved or
 * completed visit is left as staff left it.
 */
export const collectionSeeder: QueueSeeder = {
  queue: "Collection desk and lot fulfilment",
  async seed(context: QueueContext) {
    const { db, now, people } = context;
    const sale = await ensureCollectionSale(context);
    const slot = firstOfferedSlot(now, 3);
    const collector = {
      kind: "self" as const,
      name: `${DEMO_PEOPLE.collector.firstName} ${DEMO_PEOPLE.collector.lastName}`,
      email: null,
      company: null,
      userId: null,
      authorisedByUserId: null,
    };
    const request = {
      legalEntityId: sale.bookingLot.buyerEntityId,
      venueId: sale.venueId,
      slotStart: slot.start,
      lotIds: [sale.bookingLot.lotId],
      collector,
      bookedVia: "staff" as const,
      bookedByUserId: people.fulfilment,
      overCapacityReason: null,
    };
    const [created] = await db
      .insert(schema.collectionBooking)
      .values({
        id: QUEUE_IDS.booking(1),
        legalEntityId: request.legalEntityId,
        venueId: request.venueId,
        slotStart: slot.start,
        slotEnd: slot.end,
        seat: 1,
        status: "booked",
        bookedByUserId: request.bookedByUserId,
        bookedVia: "staff",
        collectorKind: collector.kind,
        collectorName: collector.name,
        idempotencyKey: IDEMPOTENCY_KEY,
        requestFingerprint: bookingFingerprint(request),
        createdAt: new Date(now),
        updatedAt: new Date(now),
      })
      // Any clash (this id, the key, or the seat already taken) leaves what is there alone.
      .onConflictDoNothing()
      .returning({
        id: schema.collectionBooking.id,
        reference: schema.collectionBooking.reference,
      });
    if (!created) return;

    await db
      .insert(schema.collectionBookingLot)
      .values({ bookingId: created.id, lotId: sale.bookingLot.lotId });
    const event = collectionBookingCreated({
      id: created.id,
      reference: created.reference,
      legalEntityId: request.legalEntityId,
      venueId: request.venueId,
      slotStart: slot.start,
      slotEnd: slot.end,
      bookedVia: "staff",
      overCapacity: false,
      collector: { kind: collector.kind },
      icsSequence: 0,
      lots: [{ lotId: sale.bookingLot.lotId, active: true }],
    });
    await writeSeedEvents(db, [
      {
        aggregateType: COLLECTION_BOOKING_EVENT_AGGREGATE,
        aggregateId: created.id,
        eventType: event.eventType,
        payload: event.payload,
        actorUserId: request.bookedByUserId,
        actingLegalEntityId: request.legalEntityId,
        occurredAt: new Date(now),
      },
    ]);
  },
};
