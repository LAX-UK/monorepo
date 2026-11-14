import type {
  BidInvoiceFacts,
  BidPaymentFacts,
  BidPaymentGroupFacts,
  BidRefundsFacts,
} from "@auction/accounting-domain";
import type { FactsRead, IBidAccountingFactsReader } from "@auction/persistence/interfaces";
import { describe, expect, it, vi } from "vitest";
import { classifyDeliveryError } from "../../lib/delivery-retry.js";
import { InMemoryAccountingStore } from "../../testing/in-memory-accounting-store.js";
import {
  ACCOUNTING_EVENT_ROUTES,
  AccountingGroupRowsChangedError,
  AccountingInvoiceLinesChangedError,
} from "./accounting-event-routes.js";
import {
  AccountingProjection,
  AccountingProjectionRefusedError,
  AccountingSwitchUnreadableError,
} from "./accounting-projection.service.js";

const INVOICE_ID = "0b6a7c1e-1111-4a5b-8c9d-000000000001";
const BUYER_ID = "0b6a7c1e-2222-4a5b-8c9d-000000000002";
const PAYMENT_ID = "0b6a7c1e-3333-4a5b-8c9d-000000000003";
const REFUND_ID = "0b6a7c1e-4444-4a5b-8c9d-000000000004";
const GROUP_ID = "0b6a7c1e-6666-4a5b-8c9d-000000000006";
const SECOND_INVOICE_ID = "0b6a7c1e-1111-4a5b-8c9d-000000000007";
const SECOND_PAYMENT_ID = "0b6a7c1e-3333-4a5b-8c9d-000000000008";
const QUOTE_ID = "0b6a7c1e-9999-4a5b-8c9d-000000000009";

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

/** Two invoices of one buyer paid together; with a courier quote when `delivery` is given. */
function groupFacts(delivery?: number): BidPaymentGroupFacts {
  return {
    groupId: GROUP_ID,
    buyer: invoice.buyer,
    currency: "GBP",
    totalPence: 154_320 + 1_000 + (delivery ?? 0),
    settledOn: "2031-03-05",
    members: [
      { paymentId: PAYMENT_ID, amountPence: 154_320, invoice },
      {
        paymentId: SECOND_PAYMENT_ID,
        amountPence: 1_000,
        invoice: {
          ...invoice,
          invoiceId: SECOND_INVOICE_ID,
          lines: [{ kind: "hammer", label: "Hammer price", amountPence: 1_000 }],
        },
      },
    ],
    deliveries: delivery ? [{ quoteId: QUOTE_ID, amountPence: delivery }] : [],
  };
}

function factsReader(over: Partial<IBidAccountingFactsReader> = {}): IBidAccountingFactsReader {
  return {
    invoiceRaised: vi.fn(async () => ready(invoice)),
    paymentCaptured: vi.fn(async (_id: string, capturedAt: Date) =>
      ready<BidPaymentFacts>({
        paymentId: PAYMENT_ID,
        invoice,
        amountPence: 154_320,
        currency: "GBP",
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
    paymentGroupSettled: vi.fn(async () => ready(groupFacts())),
    deliveryGroupOf: vi.fn(async () => GROUP_ID),
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
const settled = (deliveryQuoteIds: string[] = []) => ({
  id: 13,
  eventType: "payment_group.settled",
  aggregateId: GROUP_ID,
  payload: {
    paymentGroupId: GROUP_ID,
    buyerLegalEntityId: BUYER_ID,
    paymentIds: [SECOND_PAYMENT_ID, PAYMENT_ID],
    deliveryQuoteIds,
    settledAt: "2031-03-05T10:00:00.000Z",
  },
});

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
      parked: 0,
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

  it("projects the frozen lines the event named, and refuses lines that are not them", async () => {
    const lineIds = [
      "0b6a7c1e-6666-4a5b-8c9d-000000000006",
      "0b6a7c1e-7777-4a5b-8c9d-000000000007",
    ];
    const withIds = {
      ...invoice,
      lines: invoice.lines.map((line, index) => ({ ...line, id: lineIds[index] ?? "" })),
    };
    const named = { ...raised, payload: { ...raised.payload, lineIds } };
    const same = setUp(factsReader({ invoiceRaised: async () => ready(withIds) }));
    expect(await same.projection.project(named)).toMatchObject({
      outcome: "projected",
      created: 2,
    });

    const swapped = { ...named, payload: { ...named.payload, lineIds: [...lineIds].reverse() } };
    const changed = setUp(factsReader({ invoiceRaised: async () => ready(withIds) }));
    const error = await changed.projection.project(swapped).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AccountingInvoiceLinesChangedError);
    expect(classifyDeliveryError(error)).toBe("fatal");
    expect(changed.store.documents()).toHaveLength(0);
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

describe("accounting projection: payments", () => {
  it("Pay several: one payment applied to each invoice, after a replay of the invoices", async () => {
    const { store, projection, facts } = setUp();
    await projection.project(raised);
    expect(await projection.project(settled())).toEqual({
      outcome: "projected",
      created: 2,
      replayed: 2,
      kept: 0,
      parked: 0,
    });
    expect(facts.paymentGroupSettled).toHaveBeenCalledWith(GROUP_ID);
    const payment = store.documents().find((d) => d.kind === "payment");
    expect(payment?.reference).toBe(`LAX-BID-PAY-grp-${GROUP_ID}`);
    expect(payment?.record.status).toBe("pending");
    expect(payment?.document).toMatchObject({
      amountPence: 155_320,
      allocations: [
        { invoiceReference: `LAX-BID-INV-${INVOICE_ID}`, amountPence: 154_320 },
        { invoiceReference: `LAX-BID-INV-${SECOND_INVOICE_ID}`, amountPence: 1_000 },
      ],
    });
    // Again: a replay, nothing new.
    expect(await projection.project(settled())).toMatchObject({ created: 0, replayed: 4 });
  });

  it("Pay several with a courier quote: the delivery invoice and the payment are parked, the lots are not", async () => {
    const facts = factsReader({ paymentGroupSettled: vi.fn(async () => ready(groupFacts(4_500))) });
    const { store, projection } = setUp(facts);
    expect(await projection.project(settled([QUOTE_ID]))).toMatchObject({
      created: 5,
      parked: 2,
    });
    const byRef = (reference: string) => store.documents().find((d) => d.reference === reference);
    for (const reference of [`LAX-BID-INV-dlv-${QUOTE_ID}`, `LAX-BID-PAY-grp-${GROUP_ID}`]) {
      expect(byRef(reference)?.record).toMatchObject({
        status: "needs_review",
        reason: "accounting_parked_vat_on_delivery",
      });
    }
    for (const reference of [`LAX-BID-INV-${INVOICE_ID}`, `LAX-BID-INV-${SECOND_INVOICE_ID}`]) {
      expect(byRef(reference)?.record.status).toBe("pending");
    }
    // Redelivered: still parked, nothing new.
    expect(await projection.project(settled([QUOTE_ID]))).toMatchObject({
      created: 0,
      parked: 0,
    });
    expect(byRef(`LAX-BID-PAY-grp-${GROUP_ID}`)?.record.status).toBe("needs_review");
  });

  it("refuses, without retrying, a group whose stored rows are not the ones the event named", async () => {
    const { store, projection } = setUp();
    const other = settled();
    other.payload.paymentIds = [PAYMENT_ID];
    const error = await projection.project(other).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AccountingGroupRowsChangedError);
    expect(classifyDeliveryError(error)).toBe("fatal");
    const withQuote = await projection.project(settled([QUOTE_ID])).catch((e: unknown) => e);
    expect(withQuote).toBeInstanceOf(AccountingGroupRowsChangedError);
    expect(store.documents()).toHaveLength(0);
  });

  it("refuses a group whose allocations do not equal its total, to the penny", async () => {
    const facts = factsReader({
      paymentGroupSettled: vi.fn(async () => ready({ ...groupFacts(), totalPence: 155_321 })),
    });
    const { store, projection } = setUp(facts);
    const error = await projection.project(settled()).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AccountingProjectionRefusedError);
    expect((error as AccountingProjectionRefusedError).code).toBe("allocation_mismatch");
    expect(store.documents()).toHaveLength(0);
  });

  it("parks a payment taken for an invoice cancelled since, and does not queue the invoice", async () => {
    const facts = factsReader({
      paymentCaptured: vi.fn(async () =>
        ready<BidPaymentFacts>({
          paymentId: PAYMENT_ID,
          invoice: { invoiceId: INVOICE_ID, buyer: invoice.buyer, cancelled: true },
          amountPence: 154_320,
          currency: "GBP",
          capturedOn: "2031-03-02",
        }),
      ),
    });
    const { store, projection } = setUp(facts);
    expect(await projection.project(captured)).toMatchObject({ created: 2, parked: 1 });
    expect(store.documents().map((d) => [d.kind, d.record.status])).toEqual([
      ["contact", "pending"],
      ["payment", "needs_review"],
    ]);
  });

  it("makes no Books document for money that has only partly arrived, or could not be applied", () => {
    for (const eventType of [
      "payment.bank_transfer_partially_funded",
      "payment_group.bank_transfer_partially_funded",
      "payment.unapplied_money_received",
      "payment_group.paid",
    ]) {
      expect(Object.hasOwn(ACCOUNTING_EVENT_ROUTES, eventType), eventType).toBe(false);
    }
  });

  it("skips an event for a part-funded bank transfer: it is not an accounting event", async () => {
    const { store, projection } = setUp();
    expect(
      await projection.project({
        id: 20,
        eventType: "payment.bank_transfer_partially_funded",
        aggregateId: PAYMENT_ID,
        payload: { paymentId: PAYMENT_ID },
      }),
    ).toEqual({ outcome: "skipped", reason: "not_an_accounting_event" });
    expect(store.documents()).toHaveLength(0);
  });
});
