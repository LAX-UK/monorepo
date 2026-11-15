import type { IEmailService } from "@auction/email";
import pino from "pino";
import { describe, expect, it, vi } from "vitest";
import type { CollectionNoticeVisit } from "../services/collection-notices.js";
import { runCollectionRemindersJob } from "./collection-reminders.js";

const log = pino({ level: "silent" });
const CONFIG = {
  organizer: { email: "collections@lax.bid", name: "LAX" },
  webOrigin: "https://lax.bid",
};

const visit: CollectionNoticeVisit = {
  bookingId: "b-1",
  reference: "COL-4821",
  slotStart: new Date("2026-11-10T14:00:00Z"),
  slotEnd: new Date("2026-11-10T14:30:00Z"),
  icsSequence: 0,
  bookedVia: "client",
  collector: { kind: "self", name: "Maya Okafor", email: null },
  place: { name: "London Art Exchange", address: "156 New Cavendish Street" },
  lots: [{ title: "Lowland Storm", lotNumber: 12, active: true }],
  account: { id: "le-maya", kind: "personal", name: "Maya Okafor" },
  booker: { userId: "u1", email: "maya@example.com", firstName: "Maya", name: "Maya Okafor" },
  accountPeople: [],
};

function setup(
  due: { bookingId: string }[],
  read = async (): Promise<CollectionNoticeVisit | null> => visit,
  taken: readonly string[] = [],
) {
  const existingOutboxKeys = vi.fn(async (keys: readonly string[]) => {
    return new Set(keys.filter((key) => taken.includes(key)));
  });
  const enqueue = vi.fn().mockResolvedValue({ outboxId: "o" });
  const dueReminders = vi.fn().mockResolvedValue(due);
  const createMany = vi.fn().mockResolvedValue([]);
  const run = (now: string) =>
    runCollectionRemindersJob({
      reader: {
        visit: read,
        dueReminders,
        collectorEmailsSince: vi.fn().mockResolvedValue(0),
        existingOutboxKeys,
        accountRecipients: vi.fn().mockResolvedValue([]),
      },
      emailService: { enqueue } as unknown as IEmailService,
      notifications: { createMany },
      config: CONFIG,
      log,
      now: () => new Date(now),
    });
  return { run, enqueue, dueReminders, existingOutboxKeys, createMany };
}

describe("the collection reminder sweep", () => {
  it("does nothing before 09:00 London time", async () => {
    const s = setup([{ bookingId: "b-1" }]);
    expect(await s.run("2026-11-09T08:59:00Z")).toEqual({ visits: 0, queued: 0 });
    expect(s.dueReminders).not.toHaveBeenCalled();
    expect(s.enqueue).not.toHaveBeenCalled();
  });

  it("asks for tomorrow's visits booked before this morning's 09:00, and reminds each buyer", async () => {
    const s = setup([{ bookingId: "b-1" }]);
    expect(await s.run("2026-11-09T09:15:00Z")).toEqual({ visits: 1, queued: 1 });
    expect(s.dueReminders).toHaveBeenCalledWith({
      from: new Date("2026-11-10T00:00:00Z"),
      to: new Date("2026-11-11T00:00:00Z"),
      changedBefore: new Date("2026-11-09T09:00:00Z"),
    });
    expect(s.enqueue.mock.calls[0]?.[0]).toMatchObject({
      template: "collection-reminder",
      to: "maya@example.com",
      idempotencyKey: "collection-reminder:b-1:2026-11-10T14:00:00.000Z:u1",
    });
  });

  it("sends the same key on every sweep, so the outbox keeps one", async () => {
    const s = setup([{ bookingId: "b-1" }]);
    await s.run("2026-11-09T09:15:00Z");
    await s.run("2026-11-09T14:45:00Z");
    const keys = s.enqueue.mock.calls.map(([email]) => email.idempotencyKey);
    expect(new Set(keys).size).toBe(1);
  });

  it("reminds the others when one visit cannot be read", async () => {
    const read = vi
      .fn()
      .mockRejectedValueOnce(new Error("unreadable"))
      .mockResolvedValueOnce(visit);
    const s = setup([{ bookingId: "bad" }, { bookingId: "b-1" }], read);
    expect(await s.run("2026-11-09T09:15:00Z")).toEqual({ visits: 2, queued: 1 });
  });

  it("skips a visit that has gone since it was found", async () => {
    const s = setup([{ bookingId: "gone" }], async () => null);
    expect(await s.run("2026-11-09T09:15:00Z")).toEqual({ visits: 1, queued: 0 });
  });

  it("never puts the address in the key, and checks only the current key format", async () => {
    const s = setup([{ bookingId: "b-1" }]);
    await s.run("2026-11-09T09:15:00Z");
    expect(s.existingOutboxKeys).toHaveBeenCalledWith([
      "collection-reminder:b-1:2026-11-10T14:00:00.000Z:u1",
    ]);
    for (const [email] of s.enqueue.mock.calls) expect(email.idempotencyKey).not.toContain("@");
  });

  it("queues again, but writes no second inbox reminder, when only the current key exists", async () => {
    const s = setup([{ bookingId: "b-1" }], undefined, [
      "collection-reminder:b-1:2026-11-10T14:00:00.000Z:u1",
    ]);
    expect(await s.run("2026-11-09T09:15:00Z")).toEqual({ visits: 1, queued: 1 });
    expect(s.createMany).not.toHaveBeenCalled();
  });

  it("puts the reminder in the buyer's inbox too, about the account the visit was booked for", async () => {
    const s = setup([{ bookingId: "b-1" }]);
    await s.run("2026-11-09T09:15:00Z");
    expect(s.createMany).toHaveBeenCalledWith([
      {
        userId: "u1",
        legalEntityId: "le-maya",
        type: "collection_reminder",
        title: "Your collection is tomorrow",
        message: expect.stringContaining("Reference COL-4821."),
      },
    ]);
  });

  it("writes the inbox reminder once: a later sweep that finds the email already queued writes none", async () => {
    const s = setup([{ bookingId: "b-1" }], undefined, [
      "collection-reminder:b-1:2026-11-10T14:00:00.000Z:u1",
    ]);
    await s.run("2026-11-09T14:45:00Z");
    expect(s.createMany).not.toHaveBeenCalled();
  });
});
