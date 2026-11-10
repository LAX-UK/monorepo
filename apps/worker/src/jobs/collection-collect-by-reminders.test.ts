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

/** An outbox that remembers what was sent, so a later sweep sees it as the real one does. */
function setup(lots: StoredLot[], facts: Record<string, Partial<CollectionLotFacts>> = {}) {
  const outbox: { key: string; lotIds: string[] }[] = [];
  const enqueue = vi.fn(
    async (email: { idempotencyKey?: string; userId?: string; vars: { lotIds: string[] } }) => {
      outbox.push({ key: email.idempotencyKey as string, lotIds: email.vars.lotIds });
      return { outboxId: "o" };
    },
  );
  const storedLotsDue = vi.fn().mockResolvedValue(lots);
  const remindedLotIds = vi.fn(
    async (query: { keyPrefix: string; userId: string; today: string }) =>
      new Set(
        outbox.filter((row) => row.key.startsWith(query.keyPrefix)).flatMap((row) => row.lotIds),
      ),
  );
  const accountRecipients = vi.fn().mockResolvedValue([maya, { ...agent, wonOnly: true }]);
  const run = (now: string, due: StoredLot[] = lots) => {
    storedLotsDue.mockResolvedValue(due);
    return runCollectByRemindersJob({
      reader: { storedLotsDue, remindedLotIds },
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
  };
  return { run, enqueue, storedLotsDue, remindedLotIds, accountRecipients, outbox, facts };
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

  it("tells an agent who is not an owner or admin only about the lots they won", async () => {
    const s = setup([stored(), stored({ lotId: "l-2", winnerId: "u-someone-else" })]);
    await s.run("2026-12-02T10:00:00Z");
    const byUser = Object.fromEntries(
      s.enqueue.mock.calls.map(([email]) => [email.userId, email.vars.lotIds]),
    );
    expect(byUser["u-maya"]).toEqual(["l-1", "l-2"]);
    expect(byUser["u-agent"]).toEqual(["l-1"]);
  });

  it("asks about the person's own reminders, on the London day of the sweep", async () => {
    const s = setup([stored()]);
    await s.run("2026-12-02T10:00:00Z");
    expect(s.remindedLotIds).toHaveBeenCalledWith({
      keyPrefix: "collection-collect-by:lead:e-1:v-1:2026-12-09:u-maya:",
      userId: "u-maya",
      today: "2026-12-02",
    });
  });

  it("sends nothing more on a later sweep for the same lots", async () => {
    const s = setup([stored()]);
    await s.run("2026-12-02T10:00:00Z");
    expect(await s.run("2026-12-02T15:00:00Z")).toEqual({ groups: 1, queued: 0 });
    expect(await s.run("2026-12-03T10:00:00Z")).toEqual({ groups: 1, queued: 0 });
    expect(s.enqueue).toHaveBeenCalledTimes(2);
  });

  it("sends nothing more when the buyer books one of three lots, which is what the email asks", async () => {
    const three = [stored(), stored({ lotId: "l-2" }), stored({ lotId: "l-3" })];
    const s = setup(three);
    expect(await s.run("2026-12-02T10:00:00Z")).toMatchObject({ queued: 2 });
    // l-1 is booked: it drops out of the lots still waiting, so the set shrinks.
    expect(await s.run("2026-12-02T10:15:00Z", three.slice(1))).toEqual({ groups: 1, queued: 0 });
    expect(await s.run("2026-12-03T10:00:00Z", three.slice(1))).toEqual({ groups: 1, queued: 0 });
    expect(s.enqueue).toHaveBeenCalledTimes(2);
  });

  it("sends an email when a lot becomes eligible later, covering the lots still waiting", async () => {
    const lots = [stored(), stored({ lotId: "l-2" })];
    const s = setup(lots, { "l-2": { openChecks: ["source_of_funds"] } });
    expect(await s.run("2026-12-02T09:30:00Z")).toMatchObject({ queued: 2 });
    s.facts["l-2"] = {};
    expect(await s.run("2026-12-02T14:00:00Z")).toMatchObject({ queued: 2 });
    expect(s.enqueue.mock.calls.at(-2)?.[0].vars.lotIds).toEqual(["l-1", "l-2"]);
  });

  it("does not send again for lots an earlier email covered, once the new one has gone", async () => {
    const lots = [stored(), stored({ lotId: "l-2" })];
    const s = setup(lots, { "l-2": { openChecks: ["source_of_funds"] } });
    await s.run("2026-12-02T09:30:00Z");
    s.facts["l-2"] = {};
    await s.run("2026-12-02T14:00:00Z");
    expect(await s.run("2026-12-02T15:00:00Z")).toMatchObject({ queued: 0 });
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
        remindedLotIds: vi.fn().mockResolvedValue(new Set()),
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
