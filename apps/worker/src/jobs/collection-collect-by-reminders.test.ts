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

function setup(lots: StoredLot[], facts: Record<string, Partial<CollectionLotFacts>> = {}) {
  const enqueue = vi.fn().mockResolvedValue({ outboxId: "o" });
  const run = (now: string) =>
    runCollectByRemindersJob({
      reader: { storedLotsClearedSince: vi.fn().mockResolvedValue(lots) },
      notices: { accountRecipients: vi.fn().mockResolvedValue([maya]) },
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
  return { run, enqueue };
}

describe("storage reminders", () => {
  it("sends the week-before reminder from 09:00 London time, and nothing earlier that day", async () => {
    const s = setup([stored()]);
    expect(await s.run("2026-12-02T08:59:00Z")).toEqual({ groups: 0, queued: 0 });
    expect(await s.run("2026-12-02T09:00:00Z")).toEqual({ groups: 1, queued: 1 });
    expect(s.enqueue.mock.calls[0]?.[0]).toMatchObject({
      template: "collection-collect-by",
      idempotencyKey: "collection-collect-by:lead:e-1:2026-12-09:maya@example.com",
    });
  });

  it("sends the same key however often it sweeps, so the outbox keeps one", async () => {
    const s = setup([stored()]);
    await s.run("2026-12-02T09:00:00Z");
    await s.run("2026-12-02T15:00:00Z");
    const keys = s.enqueue.mock.calls.map(([email]) => email.idempotencyKey);
    expect(new Set(keys).size).toBe(1);
  });

  it("reminds on the day itself, and on a day with nothing due it sends nothing", async () => {
    const s = setup([stored()]);
    expect(await s.run("2026-12-09T10:00:00Z")).toMatchObject({ queued: 1 });
    expect(s.enqueue.mock.calls[0]?.[0].vars).toMatchObject({ when: "day" });
    expect(await s.run("2026-12-05T10:00:00Z")).toEqual({ groups: 0, queued: 0 });
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
        storedLotsClearedSince: vi
          .fn()
          .mockResolvedValue([stored(), stored({ lotId: "l-2", legalEntityId: "e-2" })]),
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
