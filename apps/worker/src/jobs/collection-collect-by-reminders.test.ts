import type { CollectionLotFacts } from "@auction/domain";
import type { IEmailService } from "@auction/email";
import pino from "pino";
import { describe, expect, it, vi } from "vitest";
import type { StoredLot } from "../interfaces/collect-by.reader.js";
import { DEFAULT_TERMS, lotStorage, storedLot } from "../testing/stored-lot.fixture.js";
import { runCollectByRemindersJob } from "./collection-collect-by-reminders.js";

const log = pino({ level: "silent" });
const stored = storedLot;
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
  const outbox: { key: string; template: string; lotIds: string[] }[] = [];
  const enqueue = vi.fn(
    async (email: {
      template: string;
      idempotencyKey?: string;
      userId?: string;
      vars: { lotIds: string[] } & Record<string, unknown>;
    }) => {
      // As the real outbox: a repeated key is not queued twice.
      if (!outbox.some((row) => row.key === email.idempotencyKey)) {
        outbox.push({
          key: email.idempotencyKey as string,
          template: email.template,
          lotIds: email.vars.lotIds,
        });
      }
      return { outboxId: "o" };
    },
  );
  const storedLotsWaiting = vi.fn().mockResolvedValue(lots);
  const remindedLotIds = vi.fn(
    async (query: { keyPrefix: string; userId: string; today: string; template?: string }) =>
      new Set(
        outbox
          .filter(
            (row) =>
              row.key.startsWith(query.keyPrefix) &&
              row.template === (query.template ?? "collection-collect-by"),
          )
          .flatMap((row) => row.lotIds),
      ),
  );
  const accountRecipients = vi.fn().mockResolvedValue([maya, { ...agent, wonOnly: true }]);
  const lockHeld = { value: false };
  const withAccountLock = vi.fn(async (_id: string, work: () => Promise<unknown>) =>
    lockHeld.value ? { ran: false as const } : { ran: true as const, value: await work() },
  );
  const run = (now: string, due: StoredLot[] = lots) => {
    storedLotsWaiting.mockResolvedValue(due);
    return runCollectByRemindersJob({
      reader: { storedLotsWaiting, remindedLotIds, withAccountLock: withAccountLock as never },
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
  return {
    run,
    lockHeld,
    withAccountLock,
    enqueue,
    storedLotsWaiting,
    remindedLotIds,
    accountRecipients,
    outbox,
    facts,
  };
}

describe("storage reminders", () => {
  it("sends the week-before reminder from 09:00 London time, and nothing earlier that day", async () => {
    const s = setup([stored()]);
    expect(await s.run("2026-12-02T08:59:00Z")).toEqual({ groups: 0, queued: 0 });
    expect(await s.run("2026-12-02T09:00:00Z")).toEqual({ groups: 1, queued: 2 });
    expect(s.enqueue.mock.calls[0]?.[0]).toMatchObject({ template: "collection-collect-by" });
  });

  it("works each account under its lock, and leaves one that another sweep holds", async () => {
    const s = setup([stored()]);
    expect(await s.run("2026-12-02T10:00:00Z")).toEqual({ groups: 1, queued: 2 });
    expect(s.withAccountLock).toHaveBeenCalledWith("e-1", expect.any(Function));
    s.enqueue.mockClear();
    s.lockHeld.value = true;
    expect(await s.run("2026-12-03T10:00:00Z")).toEqual({ groups: 1, queued: 0 });
    expect(s.enqueue).not.toHaveBeenCalled();
    expect(s.remindedLotIds).toHaveBeenCalledTimes(2);
  });

  it("asks the reader for the lots waiting on the London day", async () => {
    const s = setup([stored()]);
    await s.run("2026-12-01T23:30:00Z");
    expect(s.storedLotsWaiting).toHaveBeenCalledWith({ today: "2026-12-01" });
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
      template: "collection-collect-by",
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
        storedLotsWaiting: vi
          .fn()
          .mockResolvedValue([stored(), stored({ lotId: "l-2", legalEntityId: "e-2" })]),
        remindedLotIds: vi.fn().mockResolvedValue(new Set()),
        withAccountLock: async (_id: string, work: () => Promise<unknown>) => ({
          ran: true as const,
          value: await work(),
        }),
      } as never,
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

  describe("after the collect-by day, under the terms the lot was sold under", () => {
    // Cleared Mon 9 Nov; 14 days free: collect by Mon 23 Nov, charges from Tue 24 Nov.
    const charged = (over: Parameters<typeof lotStorage>[0] = {}) =>
      stored({
        storage: lotStorage({ ...over, pricing: { terms: DEFAULT_TERMS, ...over.pricing } }),
      });
    const sent = (s: ReturnType<typeof setup>) =>
      s.enqueue.mock.calls.map(([email]) => [email.template, email.vars.kind ?? email.vars.when]);

    it("sends 'Storage charges have started' once, however often the sweep or a retry runs", async () => {
      const s = setup([charged()]);
      expect(await s.run("2026-11-24T10:00:00Z")).toEqual({ groups: 1, queued: 2 });
      expect(await s.run("2026-11-24T10:00:00Z")).toEqual({ groups: 1, queued: 0 });
      expect(await s.run("2026-11-30T10:00:00Z")).toEqual({ groups: 1, queued: 0 });
      expect(sent(s)).toEqual([
        ["collection-storage-charges", "started"],
        ["collection-storage-charges", "started"],
      ]);
      expect(s.remindedLotIds).toHaveBeenCalledWith(
        expect.objectContaining({ template: "collection-storage-charges" }),
      );
    });

    it("sends a running total every 14 days, each once", async () => {
      const s = setup([charged()], {});
      for (const day of ["2026-11-24", "2026-12-08", "2026-12-09", "2026-12-22", "2026-12-23"]) {
        await s.run(`${day}T10:00:00Z`);
      }
      const maya = s.enqueue.mock.calls
        .filter(([email]) => email.userId === "u-maya")
        .map(([email]) => [email.vars.kind, email.vars.lotTotals]);
      expect(maya).toEqual([
        ["started", ["£3.00 so far (1 day at £3 a day), plus VAT where it applies."]],
        ["total", ["£45.00 so far (15 days at £3 a day), plus VAT where it applies."]],
        ["total", ["£87.00 so far (29 days at £3 a day), plus VAT where it applies."]],
      ]);
    });

    it("while charging is off, says only that charges may apply, and sends no totals", async () => {
      const s = setup([charged({ chargingOn: false })]);
      await s.run("2026-11-24T10:00:00Z");
      await s.run("2026-12-08T10:00:00Z");
      expect(sent(s)).toEqual([
        ["collection-storage-charges", "started"],
        ["collection-storage-charges", "started"],
      ]);
      const vars = s.enqueue.mock.calls[0]?.[0].vars;
      expect(vars).toMatchObject({ chargingOn: false, lotTotals: [null] });
      expect(JSON.stringify(vars)).not.toContain("£");
    });

    it("sends nothing for a waived lot", async () => {
      const s = setup([charged({ pricing: { waived: true } })]);
      for (const day of ["2026-11-16", "2026-11-23", "2026-11-24", "2026-12-08"]) {
        expect(await s.run(`${day}T10:00:00Z`)).toEqual({ groups: 0, queued: 0 });
      }
    });

    it("follows an extension: the new day is reminded, and charges start after it", async () => {
      const s = setup([charged({ pricing: { extensionDays: 7 } })]);
      expect(await s.run("2026-11-24T10:00:00Z")).toMatchObject({ queued: 2 });
      expect(s.enqueue.mock.calls[0]?.[0].vars).toMatchObject({
        when: "lead",
        collectByLabel: "Mon 30 Nov",
      });
      await s.run("2026-11-30T10:00:00Z");
      await s.run("2026-12-01T10:00:00Z");
      expect(sent(s).filter((_, i) => i % 2 === 0)).toEqual([
        ["collection-collect-by", "lead"],
        ["collection-collect-by", "day"],
        ["collection-storage-charges", "started"],
      ]);
    });

    it("skips a lot it cannot price and still reminds the rest", async () => {
      const s = setup([charged({ calendar: undefined }), { ...charged(), lotId: "l-2" }]);
      expect(await s.run("2026-11-24T10:00:00Z")).toEqual({ groups: 1, queued: 2 });
      expect(s.enqueue.mock.calls[0]?.[0].vars.lotIds).toEqual(["l-2"]);
    });
  });
});
