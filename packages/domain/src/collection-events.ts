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
        cancelledVia: "client" | "staff";
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

const ref = (booking: CollectionBookingFacts): BookingRef => ({
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

export const collectionBookingCancelled = (
  booking: CollectionBookingFacts,
  cancelledVia: "client" | "staff",
): CollectionBookingEvent => ({
  eventType: "collection.booking.cancelled",
  payload: {
    ...ref(booking),
    venueId: booking.venueId,
    slotStart: booking.slotStart.toISOString(),
    cancelledVia,
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
