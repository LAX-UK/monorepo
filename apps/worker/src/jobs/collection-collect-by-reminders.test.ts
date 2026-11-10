import type { CollectionLotFacts } from "@auction/domain";
import type { IEmailService } from "@auction/email";
import pino from "pino";
import { describe, expect, it, vi } from "vitest";
import type { StoredLot } from "../interfaces/collect-by.reader.js";
import { runCollectByRemindersJob } from "./collection-collect-by-reminders.js";

const log = pino({ level: "silent" });
const PLACE = { name: "London Art Exchange", address: "156 New Cavendish Street" };
const stored = (over: Partial<StoredLot> = {}): StoredLot => ({
  lotId: "l-1",
  legalEntityId: "e-1",
  venueId: "v-1",
  winnerId: "u-agent",
  title: "Lowland Storm",
  lotNumber: 12,
  clearedAt: new Date("2026-11-09T10:00:00Z"),
  place: PLACE,
  freeStorageDays: null,
  ...over,
});
const FACTS_OK: CollectionLotFacts = {
  paymentCleared: true,
  openChecks: [],
  organisationStatus: null,
  disputeOpen: false,
  refunded: false,
  refundOpen: false,
  fulfilment: "none",
  activeBookingId: null,
};
const maya = { userId: "u-maya", email: "maya@example.com", firstName: "Maya" };
const agent = { userId: "u-agent", email: "agent@example.com", firstName: "Alex" };

function setup(
  lots: StoredLot[],
  facts: Record<string, Partial<CollectionLotFacts>> = {},
  queued: string[] = [],
) {
  const enqueue = vi.fn().mockResolvedValue({ outboxId: "o" });
  const storedLotsDue = vi.fn().mockResolvedValue(lots);
  const queuedKeys = vi.fn(
    async (keys: readonly string[]) => new Set(keys.filter((k) => queued.includes(k))),
  );
  const accountRecipients = vi.fn().mockResolvedValue([maya, agent]);
  const run = (now: string) =>
    runCollectByRemindersJob({
      reader: { storedLotsDue, queuedKeys },
      notices: { accountRecipients },
      facts: {
        lotIdsForBuyer: vi.fn(),
        read: async (ids: readonly string[]) =>
          new Map(
            ids.map((id) => [
              id,
              { lotId: id, title: "x", lotNumber: 1, facts: { ...FACTS_OK, ...(facts[id] ?? {}) } },
            ]),
          ),
      } as never,
      emailService: { enqueue } as unknown as IEmailService,
      webOrigin: "https://lax.bid",
      log,
      now: () => new Date(now),
    });
  return { run, enqueue, storedLotsDue, queuedKeys, accountRecipients };
}

describe("storage reminders", () => {
  it("sends the week-before reminder from 09:00 London time, and nothing earlier that day", async () => {
    const s = setup([stored()]);
    expect(await s.run("2026-12-02T08:59:00Z")).toEqual({ groups: 0, queued: 0 });
    expect(await s.run("2026-12-02T09:00:00Z")).toEqual({ groups: 1, queued: 2 });
    expect(s.enqueue.mock.calls[0]?.[0]).toMatchObject({ template: "collection-collect-by" });
  });

  it("asks the reader for the London day and the default period, not the whole history", async () => {
    const s = setup([stored()]);
    await s.run("2026-12-02T10:00:00Z");
    expect(s.storedLotsDue).toHaveBeenCalledWith({
      today: "2026-12-02",
      defaultFreeStorageDays: 30,
      reminderLeadDays: 7,
    });
  });

  it("emails the account's people and the agent who won the lot", async () => {
    const s = setup([stored()]);
    await s.run("2026-12-02T10:00:00Z");
    expect(s.accountRecipients).toHaveBeenCalledWith("e-1", ["u-agent"]);
    expect(s.enqueue.mock.calls.map(([email]) => email.userId)).toEqual(["u-maya", "u-agent"]);
  });

  it("leaves alone an email whose key is already in the outbox, and counts only what it sends", async () => {
    const first = setup([stored()]);
    await first.run("2026-12-02T10:00:00Z");
    const keys = first.enqueue.mock.calls.map(([email]) => email.idempotencyKey as string);
    const again = setup([stored()], {}, [keys[0] as string]);
    expect(await again.run("2026-12-02T15:00:00Z")).toEqual({ groups: 1, queued: 1 });
    expect(again.enqueue).toHaveBeenCalledTimes(1);
    const none = setup([stored()], {}, keys);
    expect(await none.run("2026-12-02T15:00:00Z")).toEqual({ groups: 1, queued: 0 });
    expect(none.enqueue).not.toHaveBeenCalled();
  });

  it("sends the key a lot became eligible under later the same day as a new email", async () => {
    const early = setup([stored(), stored({ lotId: "l-2" })], {
      "l-2": { openChecks: ["source_of_funds"] },
    });
    await early.run("2026-12-02T09:30:00Z");
    const sentKeys = early.enqueue.mock.calls.map(([email]) => email.idempotencyKey as string);
    const later = setup([stored(), stored({ lotId: "l-2" })], {}, sentKeys);
    expect(await later.run("2026-12-02T14:00:00Z")).toMatchObject({ queued: 2 });
  });

  it("reminds on the day itself, and on a day with nothing due it sends nothing", async () => {
    const s = setup([stored()]);
    expect(await s.run("2026-12-09T10:00:00Z")).toMatchObject({ queued: 2 });
    expect(s.enqueue.mock.calls[0]?.[0].vars).toMatchObject({ when: "day" });
    expect(await s.run("2026-12-10T10:00:00Z")).toEqual({ groups: 0, queued: 0 });
  });

  it("leaves out a lot already booked, collected, refunded or held by a check", async () => {
    for (const blocked of [
      { activeBookingId: "b-1" },
      { fulfilment: "collected" as const },
      { refunded: true },
      { openChecks: ["source_of_funds" as const] },
      { disputeOpen: true },
    ]) {
      const s = setup([stored()], { "l-1": blocked });
      expect(await s.run("2026-12-02T10:00:00Z")).toMatchObject({ groups: 1, queued: 0 });
      expect(s.enqueue).not.toHaveBeenCalled();
    }
  });

  it("carries on with the other accounts when one cannot be read", async () => {
    const enqueue = vi.fn().mockResolvedValue({ outboxId: "o" });
    const accountRecipients = vi
      .fn()
      .mockRejectedValueOnce(new Error("gone"))
      .mockResolvedValue([maya]);
    const result = await runCollectByRemindersJob({
      reader: {
        storedLotsDue: vi
          .fn()
          .mockResolvedValue([stored(), stored({ lotId: "l-2", legalEntityId: "e-2" })]),
        queuedKeys: vi.fn().mockResolvedValue(new Set()),
      },
      notices: { accountRecipients },
      facts: {
        read: async (ids: readonly string[]) =>
          new Map(ids.map((id) => [id, { lotId: id, title: "x", lotNumber: 1, facts: FACTS_OK }])),
      } as never,
      emailService: { enqueue } as unknown as IEmailService,
      webOrigin: "https://lax.bid",
      log,
      now: () => new Date("2026-12-02T10:00:00Z"),
    });
    expect(result).toEqual({ groups: 2, queued: 1 });
  });
});
