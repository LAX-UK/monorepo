import {
  type AccountingDocument,
  type BidPaymentFacts,
  MAX_SEND_ATTEMPTS,
  SETTLE_GRACE_MS,
  buildContact,
  buildPayment,
  projectBidPaymentCaptured,
} from "@auction/accounting-domain";
import { createZohoBooksDryRunAdapter } from "@auction/accounting-zoho-books";
import { InMemoryAccounting, testOrgConfigs } from "@auction/accounting-zoho-books/testing";
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
const [CONTACT, INVOICE, PAYMENT] = bidDocuments().map((d) => d.reference) as [
  string,
  string,
  string,
];

const log = { info: vi.fn(), warn: vi.fn() };

function setUp(
  options: {
    ports?: Partial<Record<"dry_run" | "test_org", SenderPorts>>;
    books?: "off" | "dry_run" | "test_org";
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
    portsByMode: options.ports ?? { dry_run: fake },
    transientErrorPrefixes: ["fake_rate_limited"],
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
    const found = await fake.lookup.findByReference("bid", "payment", PAYMENT);
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
      reason: "fake_locked_period",
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
    // The contact is already in Books; only the invoice is sent.
    await fake.contacts.upsertContact(bidDocuments()[0] as never);
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
    expect((await testOrg.lookup.findByReference("bid", "payment", PAYMENT)).status).toBe("found");
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
    const { store, sender, queue } = setUp({ ports: { dry_run: rehearsal, test_org: testOrg } });
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
    expect((await testOrg.lookup.findByReference("bid", "contact", CONTACT)).status).toBe("found");
    expect((await rehearsal.lookup.findByReference("bid", "contact", CONTACT)).status).toBe(
      "not_found",
    );
    expect(
      (await rehearsal.lookup.findByReference("shop", "contact", shop.value.reference)).status,
    ).toBe("found");
    expect(
      (await testOrg.lookup.findByReference("shop", "contact", shop.value.reference)).status,
    ).toBe("not_found");
  });
});
