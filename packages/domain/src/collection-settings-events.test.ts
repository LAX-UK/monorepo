import { redactDomainEventPayload } from "@auction/types";
import { describe, expect, it } from "vitest";
import {
  COLLECTION_PLACE_EVENT_AGGREGATE,
  collectionExceptionChanged,
  collectionPlaceUpdated,
} from "./collection-settings-events.js";

const VENUE = "7f1c2a40-0000-4000-8000-0000000000aa";
const EXCEPTION = "7f1c2a40-0000-4000-8000-0000000000e1";

describe("collection settings events", () => {
  it("record the names of the settings that changed and what staff chose for affected bookings", () => {
    const event = collectionPlaceUpdated({
      venueId: VENUE,
      changed: ["weekly_hours", "visit_minutes"],
      affectedBookings: 3,
      affectedHandling: "cancel_and_rebook",
    });
    expect(COLLECTION_PLACE_EVENT_AGGREGATE).toBe("collection_place");
    expect(event).toEqual({
      eventType: "collection.place.updated",
      payload: {
        venueId: VENUE,
        changed: ["weekly_hours", "visit_minutes"],
        affectedBookings: 3,
        affectedHandling: "cancel_and_rebook",
      },
    });
  });

  it("record a closure by its dates and whether it covers part of a day, with no staff note", () => {
    const event = collectionExceptionChanged("collection.exception.added", {
      venueId: VENUE,
      exceptionId: EXCEPTION,
      kind: "closure",
      source: "staff",
      startsOn: "2026-12-24",
      endsOn: "2026-12-24",
      opensLocal: "13:00",
      closesLocal: "14:00",
      affectedBookings: 0,
      affectedHandling: "none",
    });
    expect(event.payload).toEqual({
      venueId: VENUE,
      exceptionId: EXCEPTION,
      kind: "closure",
      source: "staff",
      startsOn: "2026-12-24",
      endsOn: "2026-12-24",
      partDay: true,
      affectedBookings: 0,
      affectedHandling: "none",
    });
    expect(JSON.stringify(event.payload)).not.toMatch(/reason|note|13:00/i);
  });

  it("tell a whole day from part of one", () => {
    const whole = collectionExceptionChanged("collection.exception.removed", {
      venueId: VENUE,
      exceptionId: EXCEPTION,
      kind: "extra_opening",
      source: "bank_holiday",
      startsOn: "2026-12-25",
      endsOn: "2026-12-25",
      opensLocal: null,
      closesLocal: null,
      affectedBookings: 1,
      affectedHandling: "keep",
    });
    expect(whole.eventType).toBe("collection.exception.removed");
    expect(whole.payload).toMatchObject({ partDay: false, affectedHandling: "keep" });
  });

  it("pass the audit log's personal-data filter untouched, so every key is allow-listed", () => {
    const events = [
      collectionPlaceUpdated({
        venueId: VENUE,
        changed: ["weekly_hours"],
        affectedBookings: 0,
        affectedHandling: "none",
      }),
      collectionExceptionChanged("collection.exception.added", {
        venueId: VENUE,
        exceptionId: EXCEPTION,
        kind: "closure",
        source: "staff",
        startsOn: "2026-12-24",
        endsOn: "2026-12-26",
        opensLocal: null,
        closesLocal: null,
        affectedBookings: 2,
        affectedHandling: "keep",
      }),
      collectionExceptionChanged("collection.exception.removed", {
        venueId: VENUE,
        exceptionId: EXCEPTION,
        kind: "closure",
        source: "bank_holiday",
        startsOn: "2026-12-25",
        endsOn: "2026-12-25",
        opensLocal: null,
        closesLocal: null,
        affectedBookings: 0,
        affectedHandling: "none",
      }),
    ];
    for (const event of events) {
      expect(redactDomainEventPayload(event.eventType, event.payload)).toEqual(event.payload);
    }
  });
});
