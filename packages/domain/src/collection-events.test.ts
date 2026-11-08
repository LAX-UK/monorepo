import { redactDomainEventPayload } from "@auction/types";
import { describe, expect, it } from "vitest";
import {
  COLLECTION_BOOKING_EVENT_AGGREGATE,
  type CollectionBookingEvent,
  type CollectionBookingFacts,
  collectionBookingCancelled,
  collectionBookingChanged,
  collectionBookingCreated,
  collectionBookingHandOverUndone,
  collectionBookingHandedOver,
  collectionBookingNotCollected,
} from "./collection-events.js";

const booking: CollectionBookingFacts & { collector: { kind: "third_party"; name: string } } = {
  id: "7f1c2a40-0000-4000-8000-000000000001",
  reference: "COL-1042",
  legalEntityId: "7f1c2a40-0000-4000-8000-000000000002",
  venueId: "7f1c2a40-0000-4000-8000-000000000003",
  slotStart: new Date("2026-11-12T14:00:00Z"),
  slotEnd: new Date("2026-11-12T14:30:00Z"),
  bookedVia: "client",
  overCapacity: false,
  collector: { kind: "third_party", name: "Sam Okoro" },
  icsSequence: 2,
  lots: [
    { lotId: "7f1c2a40-0000-4000-8000-0000000000a1", active: true },
    { lotId: "7f1c2a40-0000-4000-8000-0000000000b2", active: false },
    { lotId: "7f1c2a40-0000-4000-8000-0000000000c3", active: true },
  ],
};

const events: CollectionBookingEvent[] = [
  collectionBookingCreated(booking),
  collectionBookingChanged(booking, new Date("2026-11-11T10:00:00Z")),
  collectionBookingCancelled(booking, "staff"),
  collectionBookingHandedOver(booking, {
    handedOverLotIds: ["7f1c2a40-0000-4000-8000-0000000000a1"],
    leftLotIds: ["7f1c2a40-0000-4000-8000-0000000000c3"],
    idCheckType: "passport",
    status: "partly_collected",
  }),
  collectionBookingHandOverUndone(booking),
  collectionBookingNotCollected(booking),
];

describe("collection booking events", () => {
  it("are one family under one aggregate", () => {
    expect(COLLECTION_BOOKING_EVENT_AGGREGATE).toBe("collection_booking");
    expect(events.map((e) => e.eventType)).toEqual([
      "collection.booking.created",
      "collection.booking.changed",
      "collection.booking.cancelled",
      "collection.booking.handed_over",
      "collection.booking.hand_over_undone",
      "collection.booking.not_collected",
    ]);
  });

  it("carry only the booking's live lots, times in UTC, and codes", () => {
    const created = collectionBookingCreated(booking);
    expect(created.payload).toMatchObject({
      reference: "COL-1042",
      lotIds: ["7f1c2a40-0000-4000-8000-0000000000a1", "7f1c2a40-0000-4000-8000-0000000000c3"],
      slotStart: "2026-11-12T14:00:00.000Z",
      slotEnd: "2026-11-12T14:30:00.000Z",
      collectorKind: "third_party",
      authorised: true,
      bookedVia: "client",
      overCapacity: false,
    });
  });

  it("never hold the collector's name, email or company", () => {
    for (const event of events) {
      const text = JSON.stringify(event.payload);
      expect(text).not.toContain("Sam Okoro");
      expect(text).not.toMatch(/email|company|collectorName/i);
    }
  });

  it("pass the audit log's personal-data filter untouched, so every key is allow-listed", () => {
    for (const event of events) {
      expect(redactDomainEventPayload(event.eventType, event.payload)).toEqual(event.payload);
    }
  });

  it("record a change with the time it moved from and the calendar sequence", () => {
    const changed = collectionBookingChanged(booking, new Date("2026-11-11T10:00:00Z"));
    expect(changed.payload).toMatchObject({
      previousSlotStart: "2026-11-11T10:00:00.000Z",
      icsSequence: 2,
    });
  });
});
