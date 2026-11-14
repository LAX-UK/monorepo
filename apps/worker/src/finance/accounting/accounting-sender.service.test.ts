import {
  type AccountingDocument,
  type BidPaymentFacts,
  type DestinationBinding,
  type IssueOutcome,
  MAX_SEND_ATTEMPTS,
  type Payment,
  SETTLE_GRACE_MS,
  WRITE_MARGIN_MS,
  type WriteFence,
  buildContact,
  buildPayment,
  expectedTotals,
  projectBidPaymentCaptured,
  retryDelayMs,
} from "@auction/accounting-domain";
import {
  TRANSIENT_REJECTION_PREFIXES,
  createZohoBooksDryRunAdapter,
} from "@auction/accounting-zoho-books";
import {
  BID_ORG_ID,
  InMemoryAccounting,
  SHOP_ORG_ID,
  testOrgConfigs,
} from "@auction/accounting-zoho-books/testing";
import { afterEach, describe, expect, it, vi } from "vitest";
import { InMemoryAccountingStore } from "../../testing/in-memory-accounting-store.js";
import type { SenderPorts } from "./accounting-dispatch.js";
import { AccountingSender, SENDER_LEASE_MS } from "./accounting-sender.service.js";

const INVOICE_ID = "0b6a7c1e-1111-4a5b-8c9d-000000000001";
const BUYER_ID = "0b6a7c1e-2222-4a5b-8c9d-000000000002";
const PAYMENT_ID = "0b6a7c1e-3333-4a5b-8c9d-000000000003";

const paid: BidPaymentFacts = {
  paymentId: PAYMENT_ID,
  amountPence: 154_320,
  currency: "GBP",
  capturedOn: "2031-03-02",
  invoice: {
    invoiceId: INVOICE_ID,
    buyer: { legalEntityId: BUYER_ID, name: "Ada Collector", email: "ada@example.com" },
    raisedOn: "2031-03-01",
    dueOn: "2031-03-15",
    lines: [
      { kind: "hammer", label: "Hammer price", amountPence: 123_456 },
      { kind: "buyers_premium", label: "Buyer's premium (25%)", amountPence: 30_864 },
    ],
  },
};

function bidDocuments(): readonly AccountingDocument[] {
  const projected = projectBidPaymentCaptured(paid);
  if (!projected.ok) throw new Error(projected.refusal.message);
  return projected.value.documents;
}
const [CONTACT_DOC, , PAYMENT_DOC] = bidDocuments() as [
  AccountingDocument,
  AccountingDocument,
  AccountingDocument,
];
const [CONTACT, INVOICE, PAYMENT] = bidDocuments().map((d) => d.reference) as [
  string,
  string,
  string,
];

const log = { info: vi.fn(), warn: vi.fn() };

/** Each writing mode bound to the fixture's test organisations. */
const BOUND: DestinationBinding = { test_org: { bid: BID_ORG_ID, shop: SHOP_ORG_ID } };

/**
 * The fake as a rehearsal adapter: it answers as Books would and, like the dry run, reaches no
 * organisation. The fake itself names the Books organisation it stands for.
 */
function rehearsing(ports: SenderPorts): SenderPorts {
  return {
    invoices: ports.invoices,
    payments: ports.payments,
    creditNotes: ports.creditNotes,
    bills: ports.bills,
    contacts: ports.contacts,
    lookup: ports.lookup,
    destination: { destinationFor: () => ({ kind: "none" }) },
  };
}

function setUp(
  options: {
    ports?: Partial<Record<"dry_run" | "test_org", SenderPorts>>;
    books?: "off" | "dry_run" | "test_org";
    destinations?: DestinationBinding;
  } = {},
) {
  const store = new InMemoryAccountingStore();
  store.setBooks(options.books ?? "dry_run");
  const fake = new InMemoryAccounting();
  let n = 0;
  const sender = new AccountingSender({
    workQueue: store,
    dueWork: store,
    transitions: store,
    settings: store,
    portsByMode: options.ports ?? { dry_run: rehearsing(fake) },
    destinations: options.destinations ?? BOUND,
    transientErrorPrefixes: ["fake_rate_limited", ...TRANSIENT_REJECTION_PREFIXES],
    newLeaseToken: () => `lease-${++n}`,
    log,
  });
  const queue = async (documents = bidDocuments()) => {
    for (const document of documents) {
      const r = await store.register({ document, sourceEventRef: "domain_event:1" });
      if (!r.ok) throw new Error(r.refusal.message);
    }
  };
  const statusOf = (reference: string) => store.byReference(reference)?.record.status;
  return { store, fake, sender, queue, statusOf };
}

afterEach(() => {
  vi.restoreAllMocks();
});

const refuseAll = async () =>
  ({ ok: false, refusal: { code: "not_found", message: "gone" } }) as const;

describe("accounting sender", () => {
  it("with the switch on Xero, nothing runs and nothing is claimed", async () => {
    const { store, sender, queue } = setUp({ books: "off" });
    store.setBooks("off", "live");
    await queue();
    expect(await sender.tick()).toMatchObject({ active: false, sent: 0 });
    expect(store.claims).toBe(0);
    expect(store.documents().every((d) => d.record.status === "pending")).toBe(true);
  });

  it("in dry run, prepares and records every document and makes no network call at all", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const dryRun = createZohoBooksDryRunAdapter({ orgs: testOrgConfigs() });
    const { store, sender, queue } = setUp({ ports: { dry_run: dryRun } });
    await queue();
    expect(await sender.tick()).toMatchObject({ active: true, sent: 3 });
    for (const reference of [CONTACT, INVOICE, PAYMENT]) {
      expect(store.byReference(reference)?.record).toMatchObject({
        status: "issued",
        issued: { number: "DRY-RUN", providerId: `dry-run:${reference}` },
      });
    }
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("sends the contact, then the invoice, then the payment, and records each answer", async () => {
    const { sender, queue, statusOf, fake } = setUp();
    await queue();
    await sender.tick();
    for (const reference of [CONTACT, INVOICE, PAYMENT]) expect(statusOf(reference)).toBe("issued");
    const found = await fake.lookup.findDocument(PAYMENT_DOC);
    expect(found.status).toBe("found");
  });

  it("looks a lost answer up before anything is sent again, so nothing is made twice", async () => {
    const { store, sender, queue, statusOf, fake } = setUp();
    await queue([bidDocuments()[0] as AccountingDocument]);
    fake.faults.inject("timeout_after_commit");
    await sender.tick();
    expect(statusOf(CONTACT)).toBe("unknown");

    // Not before the first request has settled and the first wait has passed.
    store.nowMs += SENDER_LEASE_MS + SETTLE_GRACE_MS + 29_000;
    expect(await sender.tick()).toMatchObject({ lookedUp: 0, sent: 0 });
    store.nowMs += 1_000;
    expect(await sender.tick()).toMatchObject({ lookedUp: 1, sent: 0 });
    expect(store.byReference(CONTACT)?.record).toMatchObject({
      status: "issued",
      attempts: 1,
    });
  });

  it("treats a sender that vanished mid-send as unknown, never as pending", async () => {
    const { store, sender, queue, statusOf } = setUp();
    await queue([bidDocuments()[0] as AccountingDocument]);
    // A sender that claimed it and died.
    await store.claimNext({
      provider: "books",
      leaseToken: "gone",
      leaseMs: SENDER_LEASE_MS,
      targetModes: ["dry_run"],
    });
    store.nowMs += SENDER_LEASE_MS;
    await sender.tick();
    expect(statusOf(CONTACT)).toBe("unknown");
    // Found nothing once settled: only then is it sent again.
    store.nowMs += SETTLE_GRACE_MS + 30_000;
    await sender.tick();
    await sender.tick();
    expect(store.byReference(CONTACT)?.record).toMatchObject({ status: "issued", attempts: 2 });
  });

  it("retries a passing refusal after its wait, and not before", async () => {
    const { store, sender, queue, statusOf, fake } = setUp();
    await queue([bidDocuments()[0] as AccountingDocument]);
    fake.faults.inject("rate_limited");
    await sender.tick();
    expect(store.byReference(CONTACT)?.record).toMatchObject({
      status: "failed",
      reason: "fake_rate_limited",
    });
    fake.faults.clear();
    store.nowMs += 29_000;
    await sender.tick();
    expect(statusOf(CONTACT)).toBe("failed");
    store.nowMs += 1_000;
    expect(await sender.tick()).toMatchObject({ requeued: 1, sent: 1 });
    expect(store.byReference(CONTACT)?.record).toMatchObject({ status: "issued", attempts: 2 });
  });

  it("hands a document to a person once every attempt is used (poison)", async () => {
    const { store, sender, queue, fake } = setUp();
    await queue([bidDocuments()[0] as AccountingDocument]);
    fake.faults.inject("rate_limited");
    for (let i = 0; i < MAX_SEND_ATTEMPTS + 3; i++) {
      await sender.tick();
      store.nowMs += 31 * 60_000;
    }
    expect(store.byReference(CONTACT)?.record).toMatchObject({
      status: "needs_review",
      attempts: MAX_SEND_ATTEMPTS,
      reason: `refused ${MAX_SEND_ATTEMPTS} times: fake_rate_limited`,
    });
  });

  it("leaves a lasting refusal for a person and never retries it", async () => {
    const { store, sender, queue, fake } = setUp();
    await queue([bidDocuments()[0] as AccountingDocument]);
    fake.faults.inject("locked_period");
    await sender.tick();
    store.nowMs += 24 * 60 * 60_000;
    await sender.tick();
    expect(store.byReference(CONTACT)?.record).toMatchObject({
      status: "failed",
      reason: "fake_period_locked",
      attempts: 1,
    });
  });

  it("holds a payment Books has under our reference but different, with both totals, for a person", async () => {
    const { store, sender, queue, fake } = setUp();
    await queue();
    // Something already made a payment under our reference with another date in Books.
    await fake.contacts.upsertContact(bidDocuments()[0] as never);
    await fake.invoices.issueInvoice(bidDocuments()[1] as never);
    const other = buildPayment({
      product: "bid",
      sourceId: PAYMENT_ID,
      contactReference: CONTACT,
      receivedOn: "2031-03-03",
      amountPence: 154_320,
      allocations: [{ invoiceReference: INVOICE, amountPence: 154_320 }],
    });
    if (!other.ok) throw new Error(other.refusal.message);
    await fake.payments.recordPayment(other.value);

    await sender.tick();
    const held = store.byReference(PAYMENT);
    expect(held?.record).toMatchObject({
      status: "needs_review",
      lookup: "clear",
      issued: { providerId: expect.any(String) },
      reason: "provider document differs from ours: zoho_books_payment_mismatch",
    });
    expect(store.historyOf(PAYMENT).at(-1)?.detail).toEqual({
      providerTotals: held?.totals,
      expectedTotals: held?.totals,
    });
    // Never picked up again: it is not due work and cannot be claimed.
    store.nowMs += 24 * 60 * 60_000;
    expect(await sender.tick()).toMatchObject({ sent: 0, lookedUp: 0, requeued: 0 });
    expect(store.byReference(PAYMENT)?.record.status).toBe("needs_review");
  });

  it("holds a document whose provider totals differ by a penny", async () => {
    const { store, sender, queue, fake } = setUp();
    // The contact goes first (the invoice waits for it); only the invoice drifts.
    await queue(bidDocuments().slice(0, 1));
    await sender.tick();
    await queue(bidDocuments().slice(1, 2));
    fake.faults.inject("totals_drift");
    await sender.tick();
    expect(store.byReference(INVOICE)?.record).toMatchObject({
      status: "needs_review",
      lookup: "clear",
      mismatch: { field: "vatPence", differencePence: 1 },
    });
  });

  it("claims only documents aimed at a mode it has an adapter for", async () => {
    const { store, sender, queue, statusOf } = setUp();
    store.config = {
      bid: { xero: "off", books: "test_org" },
      shop: { xero: "off", books: "dry_run" },
      lax_art: { xero: "off", books: "off" },
    };
    await queue([bidDocuments()[0] as AccountingDocument]);
    const shop = buildContact({ product: "shop", sourceId: "buyer-9", name: "Shop Buyer" });
    if (!shop.ok) throw new Error(shop.refusal.message);
    await queue([shop.value]);
    await sender.tick();
    expect(statusOf(CONTACT)).toBe("pending");
    expect(statusOf(shop.value.reference)).toBe("issued");
  });

  it("with Xero live and Books in rehearsal, stays idle exactly as the projector does", async () => {
    const { store, sender, queue } = setUp();
    await queue();
    const shadow = { xero: "live", books: "dry_run" } as const;
    store.config = { bid: shadow, shop: shadow, lax_art: shadow };
    expect(await sender.tick()).toMatchObject({ active: false, sent: 0 });
    expect(store.claims).toBe(0);
  });

  it("a reference rehearsed in dry run is queued again, pending, for the test organisation and sent there", async () => {
    const testOrg = new InMemoryAccounting();
    const dryRun = createZohoBooksDryRunAdapter({ orgs: testOrgConfigs() });
    const { store, queue } = setUp({ ports: { dry_run: dryRun } });
    await queue();
    const rehearsal = new AccountingSender({
      workQueue: store,
      dueWork: store,
      transitions: store,
      settings: store,
      portsByMode: { dry_run: dryRun },
      destinations: BOUND,
      transientErrorPrefixes: [],
      newLeaseToken: () => "lease-rehearsal",
      log,
    });
    await rehearsal.tick();
    const rehearsed = store.byReference(CONTACT, { provider: "books", mode: "dry_run" });
    expect(rehearsed?.record.status).toBe("issued");

    store.setBooks("test_org");
    await queue();
    for (const reference of [CONTACT, INVOICE, PAYMENT]) {
      expect(store.byReference(reference, { provider: "books", mode: "test_org" })?.record).toEqual(
        expect.objectContaining({ status: "pending" }),
      );
    }
    let n = 0;
    const testSender = new AccountingSender({
      workQueue: store,
      dueWork: store,
      transitions: store,
      settings: store,
      portsByMode: { test_org: testOrg },
      destinations: BOUND,
      transientErrorPrefixes: [],
      newLeaseToken: () => `lease-test-${++n}`,
      log,
    });
    expect(await testSender.tick()).toMatchObject({ active: true, sent: 3 });
    for (const reference of [CONTACT, INVOICE, PAYMENT]) {
      expect(
        store.byReference(reference, { provider: "books", mode: "test_org" })?.record.status,
      ).toBe("issued");
    }
    expect((await testOrg.lookup.findDocument(PAYMENT_DOC)).status).toBe("found");
    // The rehearsal rows are untouched.
    expect(store.byReference(CONTACT, { provider: "books", mode: "dry_run" })).toEqual(rehearsed);
  });

  it("does nothing at all when no product is aimed at a mode it serves", async () => {
    const { store, sender, queue } = setUp({ books: "test_org" });
    await queue();
    expect(await sender.tick()).toMatchObject({ active: false });
    expect(store.claims).toBe(0);
  });

  it("sends each document only through the adapter of the mode it was created for", async () => {
    const rehearsal = new InMemoryAccounting();
    const testOrg = new InMemoryAccounting();
    const { store, sender, queue } = setUp({
      ports: { dry_run: rehearsing(rehearsal), test_org: testOrg },
    });
    store.config = {
      bid: { xero: "off", books: "test_org" },
      shop: { xero: "off", books: "dry_run" },
      lax_art: { xero: "off", books: "off" },
    };
    await queue([bidDocuments()[0] as AccountingDocument]);
    const shop = buildContact({ product: "shop", sourceId: "buyer-9", name: "Shop Buyer" });
    if (!shop.ok) throw new Error(shop.refusal.message);
    await queue([shop.value]);
    await sender.tick();
    expect((await testOrg.lookup.findDocument(CONTACT_DOC)).status).toBe("found");
    expect((await rehearsal.lookup.findDocument(CONTACT_DOC)).status).toBe("not_found");
    expect((await rehearsal.lookup.findDocument(shop.value)).status).toBe("found");
    expect((await testOrg.lookup.findDocument(shop.value)).status).toBe("not_found");
  });
});

describe("accounting sender, a document Books holds but reads back different", () => {
  it("holds it for a person with Books' id even when the answer comes after the lease, and never sends it again", async () => {
    const { store, fake, queue } = setUp();
    const recordPayment = vi.fn(
      async (payment: Parameters<typeof fake.payments.recordPayment>[0]) => {
        // Books made it, read it back different, and the answer arrived after the lease ran out.
        store.nowMs += SENDER_LEASE_MS + 1;
        return {
          status: "differs" as const,
          reason: "zoho_books_payment_mismatch",
          number: "PMT-000009",
          providerId: "7000000000009",
          pdfRef: null,
          totals: expectedTotals(payment),
        };
      },
    );
    const sender = new AccountingSender({
      workQueue: store,
      dueWork: store,
      transitions: store,
      settings: store,
      portsByMode: { dry_run: { ...rehearsing(fake), payments: { recordPayment } } },
      destinations: BOUND,
      transientErrorPrefixes: [],
      newLeaseToken: () => `lease-${store.nowMs}`,
      log,
    });
    await queue();
    await sender.tick();
    const held = {
      status: "needs_review",
      lookup: "clear",
      issued: { number: "PMT-000009", providerId: "7000000000009" },
      reason: "provider document differs from ours: zoho_books_payment_mismatch",
    };
    expect(store.byReference(PAYMENT)?.record).toMatchObject(held);

    // Long after: nothing is looked up, requeued or sent again for it.
    store.nowMs += 24 * 60 * 60_000;
    expect(await sender.tick()).toMatchObject({ sent: 0, lookedUp: 0, requeued: 0 });
    expect(store.byReference(PAYMENT)?.record).toMatchObject(held);
    expect(recordPayment).toHaveBeenCalledTimes(1);
  });
});

describe("accounting sender, a differing payment whose answer never reaches its lease", () => {
  const HELD = {
    status: "needs_review",
    lookup: "clear",
    issued: { number: expect.any(String), providerId: expect.any(String) },
    reason: "provider document differs from ours: zoho_books_payment_mismatch",
  };

  /**
   * Books makes the payment and reads it back different; then `after` decides what becomes of the
   * answer on its way back (swept, lost, or late). Whatever happens, the record must end with a
   * person, Books' id kept, and the payment is never sent again.
   */
  async function run(
    after: (
      answer: IssueOutcome,
      ctx: { store: InMemoryAccountingStore; other: AccountingSender },
    ) => Promise<IssueOutcome>,
  ) {
    const { store, fake, queue } = setUp();
    const deps = {
      workQueue: store,
      dueWork: store,
      transitions: store,
      settings: store,
      destinations: BOUND,
      transientErrorPrefixes: [],
      log,
    };
    // Another worker (a second replica, or the next one during a deploy) over the same store.
    const other = new AccountingSender({
      ...deps,
      portsByMode: { dry_run: rehearsing(fake) },
      newLeaseToken: () => `other-${store.nowMs}`,
    });
    const recordPayment = vi.fn(async (payment: Payment) => {
      fake.faults.inject("read_back_differs");
      return after(await fake.payments.recordPayment(payment), { store, other });
    });
    const sender = new AccountingSender({
      ...deps,
      portsByMode: { dry_run: { ...rehearsing(fake), payments: { recordPayment } } },
      newLeaseToken: () => `lease-${store.nowMs}`,
    });
    await queue();
    await sender.tick();
    // The life cycle settles it: a lookup once the first request can no longer land.
    store.nowMs += SENDER_LEASE_MS + SETTLE_GRACE_MS + retryDelayMs(1) + 1;
    await sender.tick();
    expect(store.byReference(PAYMENT)?.record).toMatchObject(HELD);
    // Long after, nothing is looked up, requeued or sent again for it.
    store.nowMs += 24 * 60 * 60_000;
    expect(await sender.tick()).toMatchObject({ sent: 0, lookedUp: 0, requeued: 0 });
    expect(store.byReference(PAYMENT)?.record).toMatchObject(HELD);
    expect(recordPayment).toHaveBeenCalledTimes(1);
  }

  it("the lease is swept by another worker while the send is in flight", async () => {
    await run(async (answer, { store }) => {
      store.nowMs += SENDER_LEASE_MS + 1;
      const swept = await store.claimNext({
        provider: "books",
        leaseToken: "other-worker",
        leaseMs: SENDER_LEASE_MS,
        targetModes: ["dry_run"],
      });
      expect(swept.ok).toBe(true);
      expect(store.byReference(PAYMENT)?.record.status).toBe("unknown");
      return answer;
    });
  });

  it("the answer is lost on the way back (a timeout after Books made it)", async () => {
    await run(async () => ({ status: "unknown", detail: "zoho_books_timeout" }));
  });

  it("the sender throws after Books made it", async () => {
    await run(async () => {
      throw new Error("after the POST");
    });
  });

  it("the answer arrives after another worker swept the lease and looked the payment up", async () => {
    await run(async (answer, { store, other }) => {
      store.nowMs += SENDER_LEASE_MS + SETTLE_GRACE_MS + 1;
      await other.tick(); // sweeps the lease: unknown
      await other.tick(); // looks it up: read back, it differs
      expect(store.byReference(PAYMENT)?.record).toMatchObject(HELD);
      return answer; // late: refused, the record stays with a person
    });
  });
});

describe("accounting sender, writes tied to the lease", () => {
  /**
   * The contact and invoice go first; the payment's first send runs `during` before Books is asked
   * and `after` once it has answered.
   */
  async function sendPayment(
    during: (ctx: { store: InMemoryAccountingStore }) => Promise<void>,
    after: (
      answer: IssueOutcome,
      ctx: { store: InMemoryAccountingStore },
    ) => Promise<void> = async () => {},
  ) {
    const { store, fake, queue, sender: plain } = setUp();
    await queue(bidDocuments().slice(0, 2));
    await plain.tick();
    // Only the first send is disturbed; any later one runs as usual.
    const recordPayment = vi.fn(async (payment: Payment, fence?: WriteFence) => {
      const first = recordPayment.mock.calls.length === 1;
      if (first) await during({ store });
      const answer = await fake.payments.recordPayment(payment, fence);
      if (first) await after(answer, { store });
      return answer;
    });
    let n = 0;
    const sender = new AccountingSender({
      workQueue: store,
      dueWork: store,
      transitions: store,
      settings: store,
      portsByMode: { dry_run: { ...rehearsing(fake), payments: { recordPayment } } },
      destinations: BOUND,
      transientErrorPrefixes: TRANSIENT_REJECTION_PREFIXES,
      newLeaseToken: () => `pay-lease-${++n}`,
      log,
    });
    await queue([PAYMENT_DOC]);
    await sender.tick();
    return { store, fake, sender, recordPayment };
  }

  const sweep = async (store: InMemoryAccountingStore) => {
    store.nowMs += SENDER_LEASE_MS + 1;
    await store.claimNext({
      provider: "books",
      leaseToken: "other-worker",
      leaseMs: SENDER_LEASE_MS,
      targetModes: ["dry_run"],
    });
  };

  it("no create starts once the lease was swept: the next holder looks up, finds nothing, and sends once", async () => {
    const { store, fake, sender, recordPayment } = await sendPayment(({ store }) => sweep(store));
    // Nothing was written by the fenced send.
    expect((await fake.lookup.findDocument(PAYMENT_DOC)).status).toBe("not_found");
    expect(store.byReference(PAYMENT)?.record.status).toBe("unknown");
    store.nowMs += SETTLE_GRACE_MS + retryDelayMs(2) + 1;
    await sender.tick();
    expect(store.byReference(PAYMENT)?.record.status).toBe("issued");
    expect(recordPayment).toHaveBeenCalledTimes(2);
    expect((await fake.lookup.findDocument(PAYMENT_DOC)).status).toBe("found");
  });

  it("no create starts with less than the write margin of the lease left; it is retried later", async () => {
    const { store, fake, sender } = await sendPayment(async ({ store }) => {
      store.nowMs += SENDER_LEASE_MS - WRITE_MARGIN_MS;
    });
    expect((await fake.lookup.findDocument(PAYMENT_DOC)).status).toBe("not_found");
    expect(store.byReference(PAYMENT)?.record).toMatchObject({
      status: "failed",
      reason: "zoho_books_fenced_lease_lost",
    });
    store.nowMs += retryDelayMs(1) + 1;
    await sender.tick();
    await sender.tick();
    expect(store.byReference(PAYMENT)?.record.status).toBe("issued");
  });

  it("a lease that cannot be checked counts as lost: nothing is written", async () => {
    const { store, fake } = await sendPayment(async ({ store }) => {
      vi.spyOn(store, "holdsLease").mockRejectedValue(new Error("db down"));
    });
    expect((await fake.lookup.findDocument(PAYMENT_DOC)).status).toBe("not_found");
    expect(store.byReference(PAYMENT)?.record).toMatchObject({ status: "failed" });
  });

  it("a lease lost after the create went out is looked up, never created again", async () => {
    const { store, fake, sender, recordPayment } = await sendPayment(
      async () => {},
      async (_answer, { store }) => sweep(store),
    );
    expect(store.byReference(PAYMENT)?.record.status).toBe("unknown");
    store.nowMs += SETTLE_GRACE_MS + retryDelayMs(2) + 1;
    await sender.tick();
    expect(store.byReference(PAYMENT)?.record.status).toBe("issued");
    expect(recordPayment).toHaveBeenCalledTimes(1);
    expect((await fake.lookup.findDocument(PAYMENT_DOC)).status).toBe("found");
  });
});

describe("accounting sender, organisation binding", () => {
  it("never hands a dry run document to an adapter that would reach a Books organisation", async () => {
    // The fake stands for a Books adapter: it names the Bid test organisation.
    const fake = new InMemoryAccounting();
    const upsert = vi.spyOn(fake.contacts, "upsertContact");
    const { sender, queue, store } = setUp({ ports: { dry_run: fake } });
    await queue([bidDocuments()[0] as AccountingDocument]);
    expect(await sender.tick()).toMatchObject({ sent: 1 });
    expect(upsert).not.toHaveBeenCalled();
    expect(store.byReference(CONTACT)?.record).toMatchObject({
      status: "needs_review",
      lookup: "clear",
      issued: null,
      reason: expect.stringMatching(/^rehearsal_reaches_organisation: /),
    });
    // Held for a person: never requeued and tried again on its own.
    store.nowMs += 24 * 60 * 60_000;
    expect(await sender.tick()).toMatchObject({ sent: 0, requeued: 0 });
    expect(upsert).not.toHaveBeenCalled();
  });

  it("holds an unsent document in one step: never failed, even when nothing else can be applied after it", async () => {
    const fake = new InMemoryAccounting();
    const { sender, queue, store } = setUp({ ports: { dry_run: fake } });
    // The process dies (or the store refuses) right after the first transition of the hold.
    const apply = store.apply.bind(store);
    let applied = 0;
    vi.spyOn(store, "apply").mockImplementation(async (id, transition) =>
      applied++ === 0 ? apply(id, transition) : refuseAll(),
    );
    await queue([bidDocuments()[0] as AccountingDocument]);
    await sender.tick();
    expect(store.byReference(CONTACT)?.record).toMatchObject({
      status: "needs_review",
      lookup: "clear",
      issued: null,
      reason: expect.stringMatching(/^rehearsal_reaches_organisation: /),
    });
    expect(store.historyOf(CONTACT).map((h) => h.action)).toEqual(["start_sending", "escalate"]);
  });

  it("refuses a test_org document whose adapter would call another organisation than the one bound", async () => {
    const testOrg = new InMemoryAccounting();
    const upsert = vi.spyOn(testOrg.contacts, "upsertContact");
    const { sender, queue, store } = setUp({
      books: "test_org",
      ports: { test_org: testOrg },
      destinations: { test_org: { bid: "9000000000777" } },
    });
    await queue([bidDocuments()[0] as AccountingDocument]);
    await sender.tick();
    expect(upsert).not.toHaveBeenCalled();
    const record = store.byReference(CONTACT, { provider: "books", mode: "test_org" })?.record;
    expect(record).toMatchObject({ status: "needs_review", lookup: "clear", issued: null });
    expect(record?.status === "needs_review" ? record.reason : "").toBe(
      `destination_mismatch: bid in test_org: the adapter would send to organisation ${BID_ORG_ID}, bound is 9000000000777`,
    );
  });

  it("sends nothing in test_org while no organisation is bound for the product", async () => {
    const testOrg = new InMemoryAccounting();
    const upsert = vi.spyOn(testOrg.contacts, "upsertContact");
    const { sender, queue, store } = setUp({
      books: "test_org",
      ports: { test_org: testOrg },
      destinations: { test_org: { shop: SHOP_ORG_ID } },
    });
    await queue([bidDocuments()[0] as AccountingDocument]);
    await sender.tick();
    expect(upsert).not.toHaveBeenCalled();
    expect(
      store.byReference(CONTACT, { provider: "books", mode: "test_org" })?.record,
    ).toMatchObject({
      status: "needs_review",
      reason: expect.stringMatching(/^destination_not_bound: /),
    });
  });

  it("sends a test_org document to the organisation bound for it", async () => {
    const testOrg = new InMemoryAccounting();
    const { sender, queue, store } = setUp({ books: "test_org", ports: { test_org: testOrg } });
    await queue([bidDocuments()[0] as AccountingDocument]);
    await sender.tick();
    expect(store.byReference(CONTACT, { provider: "books", mode: "test_org" })?.record.status).toBe(
      "issued",
    );
  });

  it("does not look an unknown document up in another organisation: it goes to a person, lookup owed", async () => {
    const testOrg = new InMemoryAccounting();
    const { store, queue, sender } = setUp({ books: "test_org", ports: { test_org: testOrg } });
    await queue([bidDocuments()[0] as AccountingDocument]);
    testOrg.faults.inject("timeout_after_commit");
    await sender.tick();
    const target = { provider: "books", mode: "test_org" } as const;
    expect(store.byReference(CONTACT, target)?.record.status).toBe("unknown");

    // The binding now names another organisation (a configuration change between ticks).
    const lookup = vi.spyOn(testOrg.lookup, "findDocument");
    const rebound = new AccountingSender({
      workQueue: store,
      dueWork: store,
      transitions: store,
      settings: store,
      portsByMode: { test_org: testOrg },
      destinations: { test_org: { bid: "9000000000777" } },
      transientErrorPrefixes: [],
      newLeaseToken: () => "lease-rebound",
      log,
    });
    store.nowMs += SENDER_LEASE_MS + SETTLE_GRACE_MS + 60_000;
    expect(await rebound.tick()).toMatchObject({ lookedUp: 0, escalated: 1, sent: 0 });
    expect(lookup).not.toHaveBeenCalled();
    expect(store.byReference(CONTACT, target)?.record).toMatchObject({
      status: "needs_review",
      lookup: "owed",
      reason: expect.stringMatching(/^destination_mismatch: /),
    });
  });
});
