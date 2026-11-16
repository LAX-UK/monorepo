import type { CollectionLotFacts } from "@auction/domain";
import type { IEmailService } from "@auction/email";
import pino from "pino";
import { describe, expect, it, vi } from "vitest";
import type { StoredLot } from "../interfaces/collect-by.reader.js";
import { runCanBookJob } from "./collection-can-book.js";

const CAN_BOOK_EMAILS_FROM = new Date("2026-11-16T00:00:00Z");
const log = pino({ level: "silent" });
const PLACE = { name: "London Art Exchange", address: "156 New Cavendish Street" };
const stored = (over: Partial<StoredLot> = {}): StoredLot => ({
  lotId: "l-1",
  legalEntityId: "e-1",
  venueId: "v-1",
  winnerId: "u-agent",
  title: "Lowland Storm",
  lotNumber: 12,
  clearedAt: new Date("2026-11-20T10:00:00Z"),
  place: PLACE,
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
  const outbox: { key: string; lotIds: string[]; template: string }[] = [];
  const enqueue = vi.fn(
    async (email: { idempotencyKey?: string; template: string; vars: { lotIds: string[] } }) => {
      outbox.push({
        key: email.idempotencyKey as string,
        lotIds: email.vars.lotIds,
        template: email.template,
      });
      return { outboxId: "o" };
    },
  );
  const lotsClearedSince = vi.fn().mockResolvedValue(lots);
  const remindedLotIds = vi.fn(
    async (query: { keyPrefix: string; userId: string; today: string; template?: string }) =>
      new Set(
        outbox
          .filter((row) => row.template === query.template && row.key.startsWith(query.keyPrefix))
          .flatMap((row) => row.lotIds),
      ),
  );
  const accountRecipients = vi.fn().mockResolvedValue([maya, { ...agent, wonOnly: true }]);
  const run = (now: string) =>
    runCanBookJob({
      reader: { lotsClearedSince, remindedLotIds },
      notices: { accountRecipients },
      facts: {
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
      from: CAN_BOOK_EMAILS_FROM,
      now: () => new Date(now),
    });
  return { run, enqueue, lotsClearedSince, remindedLotIds, accountRecipients, outbox };
}

describe("you can book emails", () => {
  it("ignores payments cleared before the configured date", async () => {
    const s = setup([
      stored({ lotId: "l-old", clearedAt: new Date("2026-11-10T10:00:00Z") }),
      stored({ lotId: "l-new", clearedAt: new Date("2026-11-20T10:00:00Z") }),
    ]);
    await s.run("2026-11-21T09:15:00Z");
    expect(s.outbox.flatMap((row) => row.lotIds)).not.toContain("l-old");
    expect(s.outbox.flatMap((row) => row.lotIds)).toContain("l-new");
  });

  it("sends nothing before 09:00 London time", async () => {
    const s = setup([stored()]);
    expect(await s.run("2026-11-21T08:59:00Z")).toEqual({ groups: 0, queued: 0 });
    expect(s.lotsClearedSince).not.toHaveBeenCalled();
  });

  it("asks only for purchases paid since the release, and tells each person once", async () => {
    const s = setup([stored()]);
    expect(await s.run("2026-11-21T09:15:00Z")).toEqual({ groups: 1, queued: 2 });
    expect(s.lotsClearedSince).toHaveBeenCalledWith(CAN_BOOK_EMAILS_FROM);
    expect(s.enqueue.mock.calls[0]?.[0]).toMatchObject({
      template: "collection-can-book",
      to: "maya@example.com",
      userId: "u-maya",
      category: "transactional",
      vars: {
        lots: ["Lot 12 · Lowland Storm"],
        lotIds: ["l-1"],
        bookUrl: "https://lax.bid/purchases/collect?lots=l-1",
      },
    });
    expect(String(s.enqueue.mock.calls[0]?.[0].idempotencyKey)).not.toContain("@");
    expect(await s.run("2026-11-21T09:30:00Z")).toEqual({ groups: 1, queued: 0 });
  });

  it("waits while a check is open, and writes once the check has closed", async () => {
    const facts: Record<string, Partial<CollectionLotFacts>> = {
      "l-1": { openChecks: ["source_of_funds"] },
    };
    const s = setup([stored()], facts);
    expect(await s.run("2026-11-21T09:15:00Z")).toEqual({ groups: 1, queued: 0 });
    facts["l-1"] = {};
    expect(await s.run("2026-11-21T09:30:00Z")).toEqual({ groups: 1, queued: 2 });
  });

  it("tells an agent only about the lots they won, and a later lot in an email of its own", async () => {
    const s = setup([stored(), stored({ lotId: "l-2", winnerId: "u-maya", lotNumber: 14 })]);
    await s.run("2026-11-21T09:15:00Z");
    const byPerson = (userId: string) =>
      s.enqueue.mock.calls
        .map(([email]) => email as unknown as { userId: string; vars: { lotIds: string[] } })
        .filter((email) => email.userId === userId)
        .map((email) => email.vars.lotIds);
    expect(byPerson("u-maya")).toEqual([["l-1", "l-2"]]);
    expect(byPerson("u-agent")).toEqual([["l-1"]]);

    s.lotsClearedSince.mockResolvedValue([
      stored(),
      stored({ lotId: "l-2", winnerId: "u-maya" }),
      stored({ lotId: "l-3", winnerId: "u-agent", lotNumber: 15 }),
    ]);
    await s.run("2026-11-22T09:15:00Z");
    expect(byPerson("u-maya")).toEqual([["l-1", "l-2"], ["l-3"]]);
    expect(byPerson("u-agent")).toEqual([["l-1"], ["l-3"]]);
  });

  it("never counts a storage reminder as having told them they can book", async () => {
    const s = setup([stored()]);
    s.outbox.push({
      key: "collection-can-book:e-1:v-1:u-maya:x",
      lotIds: ["l-1"],
      template: "collection-collect-by",
    });
    expect((await s.run("2026-11-21T09:15:00Z")).queued).toBe(2);
  });

  it("carries on with the other accounts when one cannot be read", async () => {
    const s = setup([stored(), stored({ lotId: "l-9", legalEntityId: "e-2" })]);
    s.accountRecipients.mockRejectedValueOnce(new Error("unreadable"));
    expect(await s.run("2026-11-21T09:15:00Z")).toEqual({ groups: 2, queued: 2 });
  });
});
