import type { BidInvoiceFacts, BidPaymentFacts, BidRefundsFacts } from "@auction/accounting-domain";
import type { FactsRead, IBidAccountingFactsReader } from "@auction/persistence/interfaces";
import { describe, expect, it, vi } from "vitest";
import { classifyDeliveryError } from "../../lib/delivery-retry.js";
import { InMemoryAccountingStore } from "../../testing/in-memory-accounting-store.js";
import {
  AccountingProjection,
  AccountingProjectionRefusedError,
  AccountingSwitchUnreadableError,
} from "./accounting-projection.service.js";

const INVOICE_ID = "0b6a7c1e-1111-4a5b-8c9d-000000000001";
const BUYER_ID = "0b6a7c1e-2222-4a5b-8c9d-000000000002";
const PAYMENT_ID = "0b6a7c1e-3333-4a5b-8c9d-000000000003";
const REFUND_ID = "0b6a7c1e-4444-4a5b-8c9d-000000000004";

const invoice: BidInvoiceFacts = {
  invoiceId: INVOICE_ID,
  buyer: { legalEntityId: BUYER_ID, name: "Ada Collector", email: "ada@example.com" },
  raisedOn: "2031-03-01",
  dueOn: "2031-03-15",
  lines: [
    { kind: "hammer", label: "Hammer price", amountPence: 123_456 },
    { kind: "buyers_premium", label: "Buyer's premium (25%)", amountPence: 30_864 },
  ],
};

const ready = <T>(facts: T): FactsRead<T> => ({ status: "ready", facts });

function factsReader(over: Partial<IBidAccountingFactsReader> = {}): IBidAccountingFactsReader {
  return {
    invoiceRaised: vi.fn(async () => ready(invoice)),
    paymentCaptured: vi.fn(async (_id: string, capturedAt: Date) =>
      ready<BidPaymentFacts>({
        paymentId: PAYMENT_ID,
        invoice,
        amountPence: 154_320,
        capturedOn: capturedAt.toISOString().slice(0, 10),
      }),
    ),
    paymentRefunded: vi.fn(async () =>
      ready<BidRefundsFacts>({
        invoice,
        paidPence: 154_320,
        refunds: [{ refundId: REFUND_ID, amountPence: 1_001, refundedOn: "2031-03-04" }],
      }),
    ),
    ...over,
  };
}

const raised = {
  id: 10,
  eventType: "invoice.raised",
  aggregateId: INVOICE_ID,
  payload: {
    invoiceId: INVOICE_ID,
    lotId: "0b6a7c1e-5555-4a5b-8c9d-000000000005",
    buyerLegalEntityId: BUYER_ID,
    totalPence: 154_320,
    raisedAt: "2031-03-01T10:00:00.000Z",
  },
};
const captured = {
  id: 11,
  eventType: "payment.captured",
  aggregateId: PAYMENT_ID,
  payload: {
    paymentId: PAYMENT_ID,
    lotId: "0b6a7c1e-5555-4a5b-8c9d-000000000005",
    userId: "user-1",
    amountCents: 154_320,
    capturedAt: "2031-03-02T10:00:00.000Z",
    via: "stripe_checkout_webhook",
  },
};
const refunded = { id: 12, eventType: "payment.refunded", aggregateId: PAYMENT_ID, payload: {} };

function setUp(facts = factsReader()) {
  const store = new InMemoryAccountingStore();
  store.setBooks("dry_run");
  const projection = new AccountingProjection({ facts, settings: store, registry: store });
  return { store, projection, facts };
}

describe("accounting projection", () => {
  it("with the switch on Xero it reads nothing and writes nothing", async () => {
    const { store, projection, facts } = setUp();
    store.setBooks("off", "live");
    expect(await projection.isActive()).toBe(false);
    expect(await projection.project(raised)).toEqual({
      outcome: "skipped",
      reason: "books_not_selected",
    });
    expect(facts.invoiceRaised).not.toHaveBeenCalled();
    expect(store.documents()).toHaveLength(0);
  });

  it("is active once a product is aimed at Books, in any mode", async () => {
    const { store, projection } = setUp();
    for (const mode of ["dry_run", "test_org"] as const) {
      store.setBooks(mode);
      expect(await projection.isActive()).toBe(true);
    }
  });

  it("queues the contact and invoice for a raised invoice, aimed at Books in dry run", async () => {
    const { store, projection } = setUp();
    expect(await projection.project(raised)).toEqual({
      outcome: "projected",
      created: 2,
      replayed: 0,
      kept: 0,
    });
    expect(store.documents().map((d) => [d.kind, d.target, d.sourceEventRef])).toEqual([
      ["contact", { provider: "books", mode: "dry_run" }, "domain_event:10"],
      ["invoice", { provider: "books", mode: "dry_run" }, "domain_event:10"],
    ]);
  });

  it("is idempotent: the same event again, or a payment naming the invoice, replays", async () => {
    const { store, projection, facts } = setUp();
    await projection.project(raised);
    expect(await projection.project(raised)).toMatchObject({ created: 0, replayed: 2 });
    expect(await projection.project(captured)).toMatchObject({ created: 1, replayed: 2 });
    expect(facts.paymentCaptured).toHaveBeenCalledWith(
      PAYMENT_ID,
      new Date("2031-03-02T10:00:00.000Z"),
    );
    expect(await projection.project(refunded)).toMatchObject({ created: 1, replayed: 2 });
    expect(store.documents().map((d) => d.kind)).toEqual([
      "contact",
      "invoice",
      "payment",
      "credit_note",
    ]);
  });

  it("after a rehearsal, re-projects the contact and invoice for the new target before what names them", async () => {
    const { store, projection } = setUp();
    await projection.project(raised);
    expect(store.documents()).toHaveLength(2);

    // The rehearsal is over: Bid moves to the test organisation and the invoice is paid.
    store.setBooks("test_org");
    expect(await projection.project(captured)).toMatchObject({ created: 3, replayed: 0 });
    const testOrg = store
      .documents()
      .filter((d) => d.target?.mode === "test_org")
      .map((d) => d.kind);
    expect(testOrg).toEqual(["contact", "invoice", "payment"]);
    // The rehearsal rows stand as they were, still aimed at dry run.
    expect(
      store
        .documents()
        .filter((d) => d.target?.mode === "dry_run")
        .map((d) => d.kind),
    ).toEqual(["contact", "invoice"]);

    // A refund then credits an invoice the test organisation already holds: a replay.
    expect(await projection.project(refunded)).toMatchObject({ created: 1, replayed: 2 });
  });

  it("with Xero live, takes nothing whatever Books says, like the sender", async () => {
    const { store, projection, facts } = setUp();
    for (const books of ["dry_run", "test_org"] as const) {
      const shadow = { xero: "live", books } as const;
      store.config = { bid: shadow, shop: shadow, lax_art: shadow };
      expect(await projection.activity()).toBe("inactive");
      expect(await projection.project(raised)).toEqual({
        outcome: "skipped",
        reason: "books_not_selected",
      });
    }
    expect(facts.invoiceRaised).not.toHaveBeenCalled();
  });

  it("keeps a contact already queued with other details, and refuses any other clash", async () => {
    const { store, projection } = setUp();
    await projection.project(raised);
    const withFacts = (facts: IBidAccountingFactsReader) =>
      new AccountingProjection({ facts, settings: store, registry: store });

    const renamed = withFacts(
      factsReader({
        invoiceRaised: async () =>
          ready({ ...invoice, buyer: { ...invoice.buyer, name: "Ada Collector Ltd" } }),
      }),
    );
    expect(await renamed.project(raised)).toMatchObject({ created: 0, replayed: 1, kept: 1 });

    const repriced = withFacts(
      factsReader({
        invoiceRaised: async () =>
          ready({ ...invoice, lines: [{ kind: "hammer", label: "Hammer price", amountPence: 1 }] }),
      }),
    );
    const error = await repriced.project(raised).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AccountingProjectionRefusedError);
    expect((error as AccountingProjectionRefusedError).code).toBe("reference_in_use");
    expect(classifyDeliveryError(error)).toBe("fatal");
  });

  it("refuses an event its policy cannot book; the delivery is not retried", async () => {
    const { projection, store } = setUp(
      factsReader({
        invoiceRaised: async () =>
          ready({ ...invoice, lines: [{ kind: "vat_on_hammer", label: "VAT", amountPence: 5 }] }),
      }),
    );
    const error = await projection.project(raised).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AccountingProjectionRefusedError);
    expect((error as AccountingProjectionRefusedError).code).toBe("line_awaiting_accountant");
    expect(classifyDeliveryError(error)).toBe("fatal");
    expect(store.documents()).toHaveLength(0);
  });

  it("skips with the reader's reason when the event gives the books nothing", async () => {
    const { projection } = setUp(
      factsReader({
        paymentCaptured: async () => ({ status: "skip", reason: "payment_in_group" }),
      }),
    );
    expect(await projection.project(captured)).toEqual({
      outcome: "skipped",
      reason: "payment_in_group",
    });
  });

  it("skips an event that is not an accounting event", async () => {
    const { projection } = setUp();
    expect(
      await projection.project({ id: 1, eventType: "lot.ended", aggregateId: "x", payload: {} }),
    ).toEqual({ outcome: "skipped", reason: "not_an_accounting_event" });
    expect(
      await projection.project({ id: 1, eventType: "constructor", aggregateId: "x", payload: {} }),
    ).toEqual({ outcome: "skipped", reason: "not_an_accounting_event" });
  });

  it("retries later when the switch cannot be read", async () => {
    const projection = new AccountingProjection({
      facts: factsReader(),
      settings: {
        read: async () => ({
          ok: false,
          refusal: { code: "missing_product", message: "x" },
        }),
      },
      registry: new InMemoryAccountingStore(),
    });
    const error = await projection.project(raised).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AccountingSwitchUnreadableError);
    expect(classifyDeliveryError(error)).toBe("retryable");
    expect(await projection.isActive()).toBe(false);
    // Unreadable is not "off": the projector must not move its cursor on it.
    expect(await projection.activity()).toBe("unreadable");
  });

  it("reads exactly the event types the catalogue routes to the accounting consumer", async () => {
    const { listDomainEventTypesForConsumer } = await import("@auction/types");
    const { projection } = setUp();
    expect([...projection.eventTypes()].sort()).toEqual(
      [...listDomainEventTypesForConsumer("accounting")].sort(),
    );
  });
});
