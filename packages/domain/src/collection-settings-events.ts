import type { CollectionExceptionSource } from "./collection-calendar.js";

/** The aggregate the settings events of a collection place are recorded under. */
export const COLLECTION_PLACE_EVENT_AGGREGATE = "collection_place";

/**
 * The audit events of a place's collection settings. Payloads hold identifiers, the names of the
 * settings that changed and dates; never the staff note on a closure, which stays on the closure.
 * The allow-lists in `@auction/types` (domain-event-pii) must name exactly these keys.
 */
export type CollectionSettingsEvent =
  | {
      eventType: "collection.place.updated";
      payload: {
        venueId: string;
        /** The settings that changed, by name ("visit_minutes", "weekly_hours", ...). */
        changed: string[];
        /** Bookings the change put outside what the place now offers. */
        affectedBookings: number;
        /** What staff chose for them: "keep", or "cancel_and_rebook". `none` when none were affected. */
        affectedHandling: "none" | "keep" | "cancel_and_rebook";
      };
    }
  | {
      eventType: "collection.exception.added" | "collection.exception.removed";
      payload: {
        venueId: string;
        exceptionId: string;
        kind: "closure" | "extra_opening";
        source: CollectionExceptionSource;
        startsOn: string;
        endsOn: string;
        /** Whether it covers only part of each day. */
        partDay: boolean;
        affectedBookings: number;
        affectedHandling: "none" | "keep" | "cancel_and_rebook";
      };
    };

export type AffectedHandling = "none" | "keep" | "cancel_and_rebook";

export const collectionPlaceUpdated = (input: {
  venueId: string;
  changed: readonly string[];
  affectedBookings: number;
  affectedHandling: AffectedHandling;
}): CollectionSettingsEvent => ({
  eventType: "collection.place.updated",
  payload: { ...input, changed: [...input.changed] },
});

export const collectionExceptionChanged = (
  eventType: "collection.exception.added" | "collection.exception.removed",
  input: {
    venueId: string;
    exceptionId: string;
    kind: "closure" | "extra_opening";
    source: CollectionExceptionSource;
    startsOn: string;
    endsOn: string;
    opensLocal: string | null;
    closesLocal: string | null;
    affectedBookings: number;
    affectedHandling: AffectedHandling;
  },
): CollectionSettingsEvent => ({
  eventType,
  payload: {
    venueId: input.venueId,
    exceptionId: input.exceptionId,
    kind: input.kind,
    source: input.source,
    startsOn: input.startsOn,
    endsOn: input.endsOn,
    partDay: input.opensLocal !== null,
    affectedBookings: input.affectedBookings,
    affectedHandling: input.affectedHandling,
  },
});
