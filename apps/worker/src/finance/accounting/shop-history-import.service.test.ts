import {
  type AccountingDocument,
  type ShopOrderPaidFacts,
  buildContact,
  ok,
  projectShopOrderPaid,
  refuse,
} from "@auction/accounting-domain";
import { describe, expect, it } from "vitest";
import type { IBooksHistoryReader } from "../../repositories/drizzle-books-history.reader.js";
import {
  SHOP_HISTORY_SOURCE,
  ShopHistoryImport,
  historyDocumentsPerDay,
} from "./shop-history-import.service.js";

const NOW = new Date("2027-01-10T09:00:00Z");
const BEFORE = new Date("2027-01-01T00:00:00Z");

/** Synthetic orders: two by the same buyer, one by another. */
const order = (n: number, party: string): ShopOrderPaidFacts => ({
  orderId: `00000000-0000-4000-8000-00000000000${n}`,
  invoiceNumber: `LAX-INV-00000${n}`,
  buyer: { partyId: party, name: `Buyer ${party.slice(-1)}`, email: null },
  paidOn: "2026-11-12",
  totalPence: 10_000 * n,
  lines: [
    {
      id: `line-${n}`,
      kind: "goods",
      label: `Print ${n}`,
      grossPence: 10_000 * n,
      vatTreatment: null,
      vatPence: null,
    },
  ],
  delivery: { scope: "uk", label: "Collection in London", grossPence: 0, vatPence: null },
});
const PARTY_A = "00000000-0000-4000-8000-0000000000aa";
const PARTY_B = "00000000-0000-4000-8000-0000000000bb";
const ORDERS = [order(1, PARTY_A), order(2, PARTY_A), order(3, PARTY_B)];

type Mode = "off" | "dry_run" | "test_org" | "live";

function harness(options: { shopBooks?: Mode; shopXero?: Mode } = {}) {
  const stored = new Map<string, { document: AccountingDocument; source: string }>();
  let createdToday = 0;
  const registered: string[] = [];
  const history: IBooksHistoryReader = {
    paidShopOrders: async ({ afterInvoiceNumber, limit }) =>
      ORDERS.filter((o) => afterInvoiceNumber === null || o.invoiceNumber > afterInvoiceNumber)
        .slice(0, limit)
        .map((o) => ({ orderId: o.orderId, invoiceNumber: o.invoiceNumber })),
    documentsCreatedOn: async (prefix) => {
      expect(prefix).toBe(`${SHOP_HISTORY_SOURCE}:`);
      return createdToday;
    },
    eventsInWindow: async () => [],
  };
  const deps = {
    history,
    shopFacts: {
      orderPaid: async (id: string) => {
        const facts = ORDERS.find((o) => o.orderId === id);
        return facts
          ? ({ status: "ready", facts } as const)
          : ({ status: "skip", reason: "order_not_found" } as const);
      },
    },
    settings: {
      read: async () =>
        ok({
          bid: { xero: "live", books: "off" },
          shop: { xero: options.shopXero ?? "off", books: options.shopBooks ?? "dry_run" },
          lax_art: { xero: "off", books: "off" },
        } as const),
    },
    registry: {
      register: async (input: { document: AccountingDocument; sourceEventRef: string }) => {
        registered.push(input.document.reference);
        const existing = stored.get(input.document.reference);
        if (existing) return ok({ created: false, stored: {} as never });
        stored.set(input.document.reference, {
          document: input.document,
          source: input.sourceEventRef,
        });
        createdToday += 1;
        return ok({ created: true, stored: {} as never });
      },
      awaitCreditRegistrations: async () => {},
    },
    lookup: {
      findByReference: async (_product: string, reference: string) =>
        ok(stored.has(reference) ? ({ record: {} } as never) : null),
    },
    now: () => NOW,
  };
  return {
    stored,
    registered,
    service: (policy?: typeof projectShopOrderPaid) =>
      new ShopHistoryImport({ ...deps, ...(policy ? { policy } : {}) } as never),
  };
}

const run = (h: ReturnType<typeof harness>, over: object = {}) =>
  h.service().run({ before: BEFORE, dryRun: false, maxDocuments: 100, ...over });

describe("ShopHistoryImport", () => {
  it("queues each order's invoice under its LAX-INV- number and each buyer's contact once, never a payment", async () => {
    const h = harness();
    const report = await run(h);
    expect(report.queued).toEqual({ contact: 2, invoice: 3 });
    expect(report.orders).toBe(3);
    expect(report.invoiceGrossPence).toBe(60_000);
    expect([report.firstNumber, report.lastNumber]).toEqual(["LAX-INV-000001", "LAX-INV-000003"]);
    const kinds = [...h.stored.values()].map((s) => s.document.kind);
    expect(kinds).not.toContain("payment");
    const numbers = [...h.stored.values()]
      .map((s) => s.document)
      .flatMap((d) => (d.kind === "invoice" ? [d.number] : []));
    expect(numbers).toEqual(["LAX-INV-000001", "LAX-INV-000002", "LAX-INV-000003"]);
    for (const s of h.stored.values()) expect(s.source).toMatch(/^shop_history_import:/);
  });

  it("a second run queues nothing and registers nothing again", async () => {
    const h = harness();
    await run(h);
    const before = h.registered.length;
    const again = await run(h);
    expect(again.queued).toEqual({ contact: 0, invoice: 0 });
    expect(again.alreadyQueued).toEqual({ contact: 2, invoice: 3 });
    expect(h.registered.length).toBe(before);
  });

  it("a dry run reports what it would queue and writes nothing", async () => {
    const h = harness();
    const report = await run(h, { dryRun: true });
    expect(report.wouldQueue).toEqual({ contact: 2, invoice: 3 });
    expect(report.queued).toEqual({ contact: 0, invoice: 0 });
    expect(h.registered).toEqual([]);
  });

  it("stops at its share of the day's budget, counting what it queued earlier today, and resumes", async () => {
    const h = harness();
    const first = await run(h, { maxDocuments: 3 });
    expect(first.stoppedAtBudget).toBe(true);
    expect(h.stored.size).toBe(3);
    // Same day, same cap: the three already queued today use it up.
    const second = await run(h, { maxDocuments: 3 });
    expect(second.stoppedAtBudget).toBe(true);
    expect(h.stored.size).toBe(3);
    const third = await run(h, { maxDocuments: 10 });
    expect(third.stoppedAtBudget).toBe(false);
    expect(third.queued).toEqual({ contact: 1, invoice: 1 });
    expect(h.stored.size).toBe(5);
  });

  it("the default share leaves three quarters of the Books budget to live work", () => {
    expect(historyDocumentsPerDay(1_000)).toBe(125);
  });

  it.each([
    ["Xero", { shopXero: "live" as Mode, shopBooks: "dry_run" as Mode }, "shop_not_aimed_at_books"],
    ["off", { shopBooks: "off" as Mode }, "shop_not_aimed_at_books"],
    ["Books live", { shopBooks: "live" as Mode }, "books_live_not_in_rehearsal"],
  ])("refuses when the Shop switch is on %s", async (_label, options, code) => {
    const h = harness(options);
    await expect(run(h)).rejects.toThrow(code);
    expect(h.registered).toEqual([]);
  });

  it("never registers a document that is not the Shop's", async () => {
    const h = harness();
    const bidPolicy = () => {
      const contact = buildContact({
        product: "bid",
        sourceId: "bid-buyer",
        name: "B",
        email: null,
      });
      return contact.ok ? ok({ documents: [contact.value] }) : refuse("bad_facts", "x");
    };
    await expect(
      h.service(bidPolicy as never).run({ before: BEFORE, dryRun: false, maxDocuments: 10 }),
    ).rejects.toThrow("not_shop");
    expect(h.registered).toEqual([]);
  });

  it("lists an order the policy refuses and goes on", async () => {
    const h = harness();
    const policy = (facts: ShopOrderPaidFacts) =>
      facts.invoiceNumber === "LAX-INV-000002"
        ? refuse("unmapped_line", "no booking")
        : projectShopOrderPaid(facts);
    const report = await h
      .service(policy as never)
      .run({ before: BEFORE, dryRun: false, maxDocuments: 10 });
    expect(report.refused).toEqual([{ orderId: ORDERS[1]?.orderId, reason: "unmapped_line" }]);
    expect(report.queued.invoice).toBe(2);
  });
});
