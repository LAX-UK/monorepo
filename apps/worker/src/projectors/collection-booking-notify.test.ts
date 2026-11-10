import type { IEmailService } from "@auction/email";
import pino from "pino";
import { describe, expect, it, vi } from "vitest";
import type { CollectionNoticeVisit } from "../services/collection-notices.js";
import {
  COLLECTION_BOOKING_NOTIFY_PROJECTOR,
  processCollectionBookingNotify,
} from "./collection-booking-notify.js";
import type { ProjectorRunContext } from "./lib/projector.types.js";

const log = pino({ level: "silent" });
const NOW = new Date("2026-11-09T11:20:00Z");

const visit: CollectionNoticeVisit = {
  bookingId: "b-1",
  reference: "COL-4821",
  slotStart: new Date("2026-11-12T14:00:00Z"),
  slotEnd: new Date("2026-11-12T14:30:00Z"),
  icsSequence: 0,
  bookedVia: "client",
  collector: { kind: "self", name: "Maya Okafor", email: null },
  place: { name: "London Art Exchange", address: "156 New Cavendish Street" },
  lots: [{ title: "Lowland Storm", lotNumber: 12, active: true }],
  account: { kind: "personal", name: "Maya Okafor" },
  booker: { userId: "u1", email: "maya@example.com", firstName: "Maya", name: "Maya Okafor" },
  accountPeople: [],
};

type Row = { id: number; eventType: string; payload: Record<string, unknown> };

function setup(rows: Row[], read: (id: string) => Promise<CollectionNoticeVisit | null>) {
  const enqueue = vi.fn().mockResolvedValue({ outboxId: "o" });
  const advanceCursor = vi.fn();
  const listAfterCursor = vi.fn().mockResolvedValue(rows);
  const ctx = {
    projectorStateRepo: { getCursor: vi.fn().mockResolvedValue(5), advanceCursor },
    domainEventReader: { listAfterCursor },
    collectionNoticeReader: {
      visit: read,
      dueReminders: vi.fn(),
      collectorEmailsSince: vi.fn().mockResolvedValue(0),
    },
  } as unknown as ProjectorRunContext;
  const run = () =>
    processCollectionBookingNotify({
      ctx,
      log,
      emailService: { enqueue } as unknown as IEmailService,
      config: {
        organizer: { email: "collections@lax.bid", name: "LAX" },
        webOrigin: "https://lax.bid",
      },
      now: () => NOW,
    });
  return { run, enqueue, advanceCursor, listAfterCursor };
}

describe("collection booking emails from audit events", () => {
  it("emails the buyer when the desk hands works over, and when it marks the visit not collected", async () => {
    const s = setup(
      [
        { id: 6, eventType: "collection.booking.handed_over", payload: { bookingId: "b-1" } },
        { id: 7, eventType: "collection.booking.not_collected", payload: { bookingId: "b-1" } },
      ],
      async () => ({
        ...visit,
        lots: [{ title: "Lowland Storm", lotNumber: 12, active: false, outcome: "collected" }],
      }),
    );
    await s.run();
    expect(s.enqueue.mock.calls.map(([email]) => email.template)).toEqual([
      "collection-collected",
      "collection-missed",
    ]);
    expect(s.advanceCursor).toHaveBeenCalledWith("collection_booking_notify", 7);
  });

  it("asks only for the collection booking events it emails, after its own cursor", async () => {
    const s = setup([], async () => visit);
    await s.run();
    expect(s.listAfterCursor).toHaveBeenCalledWith(5, {
      eventTypes: [
        "collection.booking.created",
        "collection.booking.changed",
        "collection.booking.cancelled",
        "collection.booking.handed_over",
        "collection.booking.not_collected",
      ],
      limit: 50,
    });
    expect(s.advanceCursor).not.toHaveBeenCalled();
  });

  it("emails once for each event and moves the cursor past them", async () => {
    const s = setup(
      [
        { id: 6, eventType: "collection.booking.created", payload: { bookingId: "b-1" } },
        {
          id: 7,
          eventType: "collection.booking.cancelled",
          payload: { bookingId: "b-1", cancelledVia: "staff", reason: "closure_added" },
        },
      ],
      async () => visit,
    );
    await s.run();
    expect(s.enqueue.mock.calls.map(([email]) => [email.template, email.idempotencyKey])).toEqual([
      ["collection-booked", "collection-created:6:u1"],
      ["collection-cancelled", "collection-cancelled:7:u1"],
    ]);
    expect(s.advanceCursor).toHaveBeenCalledWith(COLLECTION_BOOKING_NOTIFY_PROJECTOR, 7);
  });

  it("skips an event with no booking in it, and one whose booking is gone, and carries on", async () => {
    const s = setup(
      [
        { id: 6, eventType: "collection.booking.created", payload: {} },
        { id: 7, eventType: "collection.booking.created", payload: { bookingId: "gone" } },
        { id: 8, eventType: "collection.booking.created", payload: { bookingId: "b-1" } },
      ],
      async (id) => (id === "gone" ? null : visit),
    );
    await s.run();
    expect(s.enqueue).toHaveBeenCalledTimes(1);
    expect(s.advanceCursor).toHaveBeenCalledWith(COLLECTION_BOOKING_NOTIFY_PROJECTOR, 8);
  });

  it("stops at an event it could not send, keeping the ones before it, so it is tried again", async () => {
    const s = setup(
      [
        { id: 6, eventType: "collection.booking.created", payload: { bookingId: "b-1" } },
        { id: 7, eventType: "collection.booking.created", payload: { bookingId: "b-2" } },
        { id: 8, eventType: "collection.booking.created", payload: { bookingId: "b-1" } },
      ],
      async (id) => {
        if (id === "b-2") throw new Error("database unavailable");
        return visit;
      },
    );
    await s.run();
    expect(s.enqueue).toHaveBeenCalledTimes(1);
    expect(s.advanceCursor).toHaveBeenCalledWith(COLLECTION_BOOKING_NOTIFY_PROJECTOR, 6);
  });

  it("needs a previous time to say a booking moved", async () => {
    const s = setup(
      [{ id: 6, eventType: "collection.booking.changed", payload: { bookingId: "b-1" } }],
      async () => visit,
    );
    await s.run();
    expect(s.enqueue).not.toHaveBeenCalled();
    expect(s.advanceCursor).toHaveBeenCalledWith(COLLECTION_BOOKING_NOTIFY_PROJECTOR, 6);
  });
});
