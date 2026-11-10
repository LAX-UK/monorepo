import { collectionBooking, collectionBookingLot, domainEvent } from "@auction/db/schema";
import { COLLECTION_BOOKING_EVENT_AGGREGATE, collectionBookingCancelled } from "@auction/domain";
import { and, eq, inArray, isNull, or, sql } from "drizzle-orm";
import type { ProjectorDbConnection } from "../interfaces/worker-db.types.js";

/** What replaces the name of someone who came to collect for the person, or a third party. */
export const THIRD_PARTY_COLLECTOR_PLACEHOLDER = "Deleted collector";

export type ErasureScope = {
  subjectIds: readonly string[];
  personalLegalEntityIds: readonly string[];
  /** "Deleted user 7F3A": stands in for the person's own name. */
  pseudonym: string;
};

export type CollectionErasureCounts = {
  /** Live visits cancelled because the person erased their account. */
  collection_booking_cancelled: number;
  /** Ended visits whose collector details were scrubbed. */
  collection_booking: number;
};

/** Visits that ended without anything being handed over. */
const UNHANDED = ["cancelled", "not_collected"] as const;
/** Visits where works were handed over: the record of who collected is kept for a time. */
const HANDED_OVER = ["collected", "partly_collected"] as const;

/** The bookings the person is behind: they made, authorised or collected at them, or own the account. */
export function involvedIn(scope: ErasureScope) {
  const subjects = [...scope.subjectIds];
  const accounts = [...scope.personalLegalEntityIds];
  return and(
    isNull(collectionBooking.personalDetailsErasedAt),
    or(
      inArray(collectionBooking.bookedByUserId, subjects),
      inArray(collectionBooking.collectorUserId, subjects),
      inArray(collectionBooking.authorisedByUserId, subjects),
      accounts.length > 0 ? inArray(collectionBooking.legalEntityId, accounts) : undefined,
    ),
  );
}

/**
 * Cancels the visits that are still live. A visit someone is expected at cannot keep a collector
 * whose details are gone, so it is cancelled first, its lots are released, and a cancellation is
 * recorded with the reason `account_erased`. That event is what the notice to the account's
 * remaining people (or the gallery) hangs off, since the erased person cannot be told.
 */
async function cancelLiveVisits(
  tx: ProjectorDbConnection,
  scope: ErasureScope,
  now: Date,
): Promise<number> {
  const live = await tx
    .select({
      id: collectionBooking.id,
      reference: collectionBooking.reference,
      legalEntityId: collectionBooking.legalEntityId,
      venueId: collectionBooking.venueId,
      slotStart: collectionBooking.slotStart,
    })
    .from(collectionBooking)
    .where(and(involvedIn(scope), eq(collectionBooking.status, "booked")));
  let cancelled = 0;
  for (const visit of live) {
    // The update only takes a visit that is still live, so one the API cancelled or handed over a
    // moment ago is skipped and gets no second event.
    const [taken] = await tx
      .update(collectionBooking)
      .set({
        status: "cancelled",
        cancelledAt: now,
        icsSequence: sql`${collectionBooking.icsSequence} + 1`,
        updatedAt: now,
      })
      .where(and(eq(collectionBooking.id, visit.id), eq(collectionBooking.status, "booked")))
      .returning({ id: collectionBooking.id });
    if (!taken) continue;
    cancelled += 1;
    await tx
      .update(collectionBookingLot)
      .set({ active: false })
      .where(eq(collectionBookingLot.bookingId, visit.id));
    const event = collectionBookingCancelled(visit, "system", "account_erased");
    await tx.insert(domainEvent).values({
      aggregateType: COLLECTION_BOOKING_EVENT_AGGREGATE,
      aggregateId: visit.id,
      eventType: event.eventType,
      payload: event.payload,
      schemaVersion: 1,
      producer: "apps/worker",
    });
  }
  return cancelled;
}

/**
 * Erases what collection bookings hold about a purged person, in the order that keeps every
 * record honest:
 * 1. Live visits are cancelled (never scrubbed while someone may turn up).
 * 2. Visits that ended with nothing handed over lose the collector's name, email and company.
 * 3. Visits where works were handed over lose the collector's email and company now. The name and
 *    the ID type stay as the record of who collected, until the retention purge clears them
 *    (`purgeCollectionHandoverRecords`).
 * Running it again changes nothing, so a retry after a crash is safe.
 */
export async function eraseCollectionBookings(
  tx: ProjectorDbConnection,
  scope: ErasureScope,
  now: Date = new Date(),
): Promise<CollectionErasureCounts> {
  const cancelled = await cancelLiveVisits(tx, scope, now);

  const unhanded = await tx
    .update(collectionBooking)
    .set({
      collectorName: sql`CASE WHEN ${collectionBooking.collectorKind} = 'third_party' THEN ${THIRD_PARTY_COLLECTOR_PLACEHOLDER} ELSE ${scope.pseudonym} END`,
      collectorEmail: null,
      collectorCompany: null,
      personalDetailsErasedAt: now,
    })
    .where(and(involvedIn(scope), inArray(collectionBooking.status, [...UNHANDED])))
    .returning({ id: collectionBooking.id });

  const handedOver = await tx
    .update(collectionBooking)
    .set({ collectorEmail: null, collectorCompany: null, personalDetailsErasedAt: now })
    .where(and(involvedIn(scope), inArray(collectionBooking.status, [...HANDED_OVER])))
    .returning({ id: collectionBooking.id });

  return {
    collection_booking_cancelled: cancelled,
    collection_booking: unhanded.length + handedOver.length,
  };
}
