import type { CollectorKind } from "./collection-collector.js";
import type { CollectionIdType } from "./collection-handover.js";

/** The aggregate every collection booking event is recorded under. */
export const COLLECTION_BOOKING_EVENT_AGGREGATE = "collection_booking";

/**
 * The audit events of a booking, with their payloads. Payloads hold identifiers, times and codes
 * only: the collector's name, email and company stay on the booking, where they can be erased.
 * The allow-lists in `@auction/types` (domain-event-pii) must name exactly these keys.
 */
type BookingRef = { bookingId: string; reference: string; legalEntityId: string };

/** Who cancelled a visit; "system" is Bid cancelling on its own, always with a reason. */
export type CollectionCancelledVia = "client" | "staff" | "system";

/** Why a visit was cancelled by Bid, or by staff because of a change to the place's settings. */
export const COLLECTION_CANCEL_REASONS = [
  "account_erased",
  "hours_changed",
  "closure_added",
  "opening_removed",
] as const;
export type CollectionCancelReason = (typeof COLLECTION_CANCEL_REASONS)[number];

type VisitFields = {
  venueId: string;
  slotStart: string;
  slotEnd: string;
  lotIds: string[];
  collectorKind: CollectorKind;
  /** Whether a third party was authorised by the account holder in the booking. */
  authorised: boolean;
  bookedVia: "client" | "staff";
  overCapacity: boolean;
};

export type CollectionBookingEvent =
  | { eventType: "collection.booking.created"; payload: BookingRef & VisitFields }
  | {
      eventType: "collection.booking.changed";
      payload: BookingRef & VisitFields & { previousSlotStart: string; icsSequence: number };
    }
  | {
      eventType: "collection.booking.cancelled";
      payload: BookingRef & {
        venueId: string;
        slotStart: string;
        /** Who cancelled it; "system" is Bid cancelling a visit on its own. */
        cancelledVia: CollectionCancelledVia;
        /** Why, when it was not the buyer's or staff's choice. */
        reason?: CollectionCancelReason;
      };
    }
  | {
      eventType: "collection.booking.handed_over";
      payload: BookingRef & {
        handedOverLotIds: string[];
        leftLotIds: string[];
        idCheckType: CollectionIdType;
        status: "collected" | "partly_collected";
      };
    }
  | { eventType: "collection.booking.hand_over_undone"; payload: BookingRef }
  | {
      eventType: "collection.booking.not_collected";
      payload: BookingRef & { slotStart: string };
    };

/** What the booking looks like to the event builders; the persistence record satisfies it. */
export type CollectionBookingFacts = {
  id: string;
  reference: string;
  legalEntityId: string;
  venueId: string;
  slotStart: Date;
  slotEnd: Date;
  bookedVia: "client" | "staff";
  overCapacity: boolean;
  collector: { kind: CollectorKind };
  icsSequence: number;
  lots: { lotId: string; active: boolean }[];
};

const ref = (
  booking: Pick<CollectionBookingFacts, "id" | "reference" | "legalEntityId">,
): BookingRef => ({
  bookingId: booking.id,
  reference: booking.reference,
  legalEntityId: booking.legalEntityId,
});

const visit = (booking: CollectionBookingFacts): VisitFields => ({
  venueId: booking.venueId,
  slotStart: booking.slotStart.toISOString(),
  slotEnd: booking.slotEnd.toISOString(),
  lotIds: booking.lots.filter((lot) => lot.active).map((lot) => lot.lotId),
  collectorKind: booking.collector.kind,
  authorised: booking.collector.kind === "third_party",
  bookedVia: booking.bookedVia,
  overCapacity: booking.overCapacity,
});

export const collectionBookingCreated = (
  booking: CollectionBookingFacts,
): CollectionBookingEvent => ({
  eventType: "collection.booking.created",
  payload: { ...ref(booking), ...visit(booking) },
});

export const collectionBookingChanged = (
  booking: CollectionBookingFacts,
  previousSlotStart: Date,
): CollectionBookingEvent => ({
  eventType: "collection.booking.changed",
  payload: {
    ...ref(booking),
    ...visit(booking),
    previousSlotStart: previousSlotStart.toISOString(),
    icsSequence: booking.icsSequence,
  },
});

/**
 * A cancellation. When Bid cancels a visit because the person who booked it erased their account,
 * `reason` is `account_erased`: that event is what the buyer-cancel email (the organisation's
 * owners, or the account that is still open) hangs off, since the erased person cannot be told.
 */
export const collectionBookingCancelled = (
  booking: Pick<
    CollectionBookingFacts,
    "id" | "reference" | "legalEntityId" | "venueId" | "slotStart"
  >,
  cancelledVia: CollectionCancelledVia,
  reason?: CollectionCancelReason,
): CollectionBookingEvent => ({
  eventType: "collection.booking.cancelled",
  payload: {
    ...ref(booking),
    venueId: booking.venueId,
    slotStart: booking.slotStart.toISOString(),
    cancelledVia,
    ...(reason ? { reason } : {}),
  },
});

export const collectionBookingHandedOver = (
  booking: CollectionBookingFacts,
  result: {
    handedOverLotIds: string[];
    leftLotIds: string[];
    idCheckType: CollectionIdType;
    status: "collected" | "partly_collected";
  },
): CollectionBookingEvent => ({
  eventType: "collection.booking.handed_over",
  payload: { ...ref(booking), ...result },
});

export const collectionBookingHandOverUndone = (
  booking: CollectionBookingFacts,
): CollectionBookingEvent => ({
  eventType: "collection.booking.hand_over_undone",
  payload: ref(booking),
});

export const collectionBookingNotCollected = (
  booking: CollectionBookingFacts,
): CollectionBookingEvent => ({
  eventType: "collection.booking.not_collected",
  payload: { ...ref(booking), slotStart: booking.slotStart.toISOString() },
});
