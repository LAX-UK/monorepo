import {
  type AccountingDocument,
  type BidPaymentFacts,
  type BooksStatusDecision,
  type BooksStatusSnapshot,
  type DocumentStatusPort,
  NO_LAX_PAYMENTS,
  type StatusReadOutcome,
  projectBidPaymentCaptured,
} from "@auction/accounting-domain";
import { TRANSIENT_REJECTION_PREFIXES } from "@auction/accounting-zoho-books";
import {
  BID_ORG_ID,
  InMemoryAccounting,
  SHOP_ORG_ID,
} from "@auction/accounting-zoho-books/testing";
import type { UnappliedMoney } from "@auction/domain";
import type {
  BooksStatusDue,
  BooksStatusDueList,
  BooksStatusRunCounts,
  BooksStatusRunOutcome,
  IAccountingBooksStatusStore,
  StoredAccountingDocument,
} from "@auction/persistence/interfaces";
import { describe, expect, it, vi } from "vitest";
import { InMemoryAccountingStore } from "../../testing/in-memory-accounting-store.js";
import { AccountingSender } from "./accounting-sender.service.js";
import { AccountingStatusCheck } from "./accounting-status-check.service.js";

const paid: BidPaymentFacts = {
  paymentId: "0b6a7c1e-3333-4a5b-8c9d-000000000003",
  amountPence: 154_320,
  currency: "GBP",
  capturedOn: "2031-03-02",
  invoice: {
    invoiceId: "0b6a7c1e-1111-4a5b-8c9d-000000000001",
    buyer: {
      legalEntityId: "0b6a7c1e-2222-4a5b-8c9d-000000000002",
      name: "Ada Collector",
      email: "ada@example.com",
    },
    raisedOn: "2031-03-01",
    dueOn: "2031-03-15",
    lines: [
      { kind: "hammer", label: "Hammer price", amountPence: 123_456 },
      { kind: "buyers_premium", label: "Buyer's premium (25%)", amountPence: 30_864 },
    ],
  },
};

const log = { info: vi.fn(), warn: vi.fn() };

/** The status check's record in memory, as the Drizzle store keeps it. */
class InMemoryStatusStore implements IAccountingBooksStatusStore {
  readonly snapshots = new Map<string, BooksStatusSnapshot>();
  readonly changes: { documentId: string; decision: BooksStatusDecision }[] = [];
  readonly runs: { id: string; outcome?: BooksStatusRunOutcome; counts?: BooksStatusRunCounts }[] =
    [];
  readonly rechecks = new Set<string>();

  constructor(private readonly issued: () => StoredAccountingDocument[]) {}

  private due(stored: StoredAccountingDocument): BooksStatusDue {
    return { stored, previous: this.snapshots.get(stored.id) ?? null };
  }
  async listDue(_modes: unknown, _since: Date, limit: number): Promise<BooksStatusDueList> {
    const all = this.issued().filter((d) => d.kind !== "contact" && d.record.status === "issued");
    const first = [
      ...all.filter((d) => this.rechecks.has(d.id)),
      ...all.filter((d) => !this.rechecks.has(d.id)),
    ];
    return { documents: first.slice(0, limit).map((d) => this.due(d)), unreadable: [] };
  }
  async findDue(id: string) {
    const stored = this.issued().find((d) => d.id === id);
    return stored ? this.due(stored) : null;
  }
  /** Set by a test: a LAX payment on the invoice is not settled yet. */
  laxPaymentUnresolved = false;
  async laxPaymentsFor(_invoice: unknown, ids: readonly string[]) {
    const lax = new Set(
      this.issued()
        .filter((d) => d.kind === "payment" && d.record.status === "issued")
        .map((d) => (d.record.status === "issued" ? d.record.issued.providerId : "")),
    );
    return {
      ...NO_LAX_PAYMENTS,
      providerIds: new Set(ids.filter((id) => lax.has(id))),
      unresolved: this.laxPaymentUnresolved,
    };
  }
  async record(_tx: unknown, documentId: string, decision: BooksStatusDecision) {
    this.snapshots.set(documentId, decision.snapshot);
    this.rechecks.delete(documentId);
    if (decision.changes.length > 0) this.changes.push({ documentId, decision });
  }
  async requestRecheck(_m: unknown, _e: unknown, kind: string, providerId: string) {
    const docs = this.issued().filter(
      (d) =>
        d.kind === kind &&
        d.record.status === "issued" &&
        d.record.issued.providerId === providerId,
    );
    for (const doc of docs) this.rechecks.add(doc.id);
    return docs.map((doc) => doc.id);
  }
  async startRun() {
    const id = `run-${this.runs.length + 1}`;
    this.runs.push({ id });
    return id;
  }
  async finishRun(id: string, outcome: BooksStatusRunOutcome, counts: BooksStatusRunCounts) {
    const run = this.runs.find((r) => r.id === id);
    if (run) Object.assign(run, { outcome, counts });
  }
  async lastFinishedRunAt() {
    return null;
  }
}

/** Issues the Bid contact, invoice and payment through the sender against the fake. */
async function issuedBooks() {
  const documents = new InMemoryAccountingStore();
  documents.setBooks("dry_run");
  const fake = new InMemoryAccounting();
  const projected = projectBidPaymentCaptured(paid);
  if (!projected.ok) throw new Error(projected.refusal.message);
  for (const document of projected.value.documents as readonly AccountingDocument[]) {
    const r = await documents.register({ document, sourceEventRef: "domain_event:1" });
    if (!r.ok) throw new Error(r.refusal.message);
  }
  let n = 0;
  const sender = new AccountingSender({
    workQueue: documents,
    dueWork: documents,
    transitions: documents,
    settings: documents,
    portsByMode: {
      dry_run: { ...fake, destination: { destinationFor: () => ({ kind: "none" }) } },
    },
    destinations: { test_org: { bid: BID_ORG_ID, shop: SHOP_ORG_ID } },
    transientErrorPrefixes: TRANSIENT_REJECTION_PREFIXES,
    newLeaseToken: () => `lease-${++n}`,
    log,
  });
  for (let i = 0; i < 6; i++) await sender.tick();
  const issued = documents.documents();
  if (!issued.every((d) => d.record.status === "issued")) throw new Error("not all issued");
  const byKind = (kind: string) => {
    const d = issued.find((x) => x.kind === kind);
    if (!d || d.record.status !== "issued") throw new Error(kind);
    return { stored: d, providerId: d.record.issued.providerId };
  };
  return { documents, fake, invoice: byKind("invoice"), payment: byKind("payment") };
}

async function setUp(options: { statuses?: DocumentStatusPort; maxCalls?: number } = {}) {
  const books = await issuedBooks();
  const store = new InMemoryStatusStore(() => books.documents.documents());
  const opened: UnappliedMoney[] = [];
  const tx = { tx: "the read's transaction" };
  const txSeen: unknown[] = [];
  const check = new AccountingStatusCheck({
    store,
    statusesByMode: { dry_run: options.statuses ?? books.fake.statuses },
    organisationIds: { london_auction_xchange: BID_ORG_ID },
    tasks: {
      open: async (t, money) => {
        txSeen.push(t);
        opened.push(money);
      },
    },
    transactions: { runInTransaction: async (fn) => fn(tx as never) },
    log,
    now: () => new Date("2031-03-10T02:15:00Z"),
    ...(options.maxCalls !== undefined
      ? { allowance: { maxCalls: options.maxCalls, keepFree: 0 } }
      : {}),
  });
  return { ...books, store, check, opened, txSeen, tx };
}

const read = (reading: Partial<Extract<StatusReadOutcome, { status: "read" }>["reading"]>) =>
  ({
    status: "read",
    reading: { state: "open", balancePence: null, payments: [], ...reading },
  }) as const;

describe("the nightly Books status check, against the Books fake", () => {
  it("records each issued document's first state and opens no task when nothing was done by hand", async () => {
    const { check, store, opened, fake, payment, invoice } = await setUp();
    // LAX's own payment shows against the invoice: never a task.
    fake.setStatus(
      invoice.providerId,
      read({
        state: "paid",
        balancePence: 0,
        payments: [
          {
            providerPaymentId: payment.providerId,
            amountPence: 154_320,
            date: "2031-03-02",
            mode: "Stripe",
            reference: payment.stored.reference,
          },
        ],
      }),
    );
    const result = await check.runNightly();
    expect(result).toEqual({ outcome: "completed", checked: 2, changed: 2, tasks: 0 });
    expect(opened).toEqual([]);
    expect(store.snapshots.get(invoice.stored.id)?.state).toBe("paid");
    expect(store.snapshots.get(payment.stored.id)?.state).toBe("recorded");
    expect(store.runs).toEqual([
      { id: "run-1", outcome: "completed", counts: { checked: 2, changed: 2, tasks: 0 } },
    ]);
  });

  it("records a void made in Books, and nothing changes on the second night", async () => {
    const { check, store, fake, invoice } = await setUp();
    await check.runNightly();
    fake.setStatus(invoice.providerId, read({ state: "void" }));
    expect((await check.runNightly()).changed).toBe(1);
    const last = store.changes.at(-1);
    expect(last?.documentId).toBe(invoice.stored.id);
    expect(last?.decision.changes).toEqual([{ kind: "state_changed", from: "open", to: "void" }]);
    expect((await check.runNightly()).changed).toBe(0);
  });

  it("a payment recorded by hand in Books opens one finance task, in the read's transaction, and marks nothing paid", async () => {
    const { check, opened, fake, invoice, documents, txSeen, tx } = await setUp();
    const before = JSON.stringify(documents.documents().map((d) => [d.id, d.record]));
    const cheque = {
      providerPaymentId: "5000000000999",
      amountPence: 40_000,
      date: "2031-03-09",
      mode: "Cheque",
      reference: null,
    };
    fake.setStatus(
      invoice.providerId,
      read({ state: "partially_paid", balancePence: 114_320, payments: [cheque] }),
    );

    expect((await check.runNightly()).tasks).toBe(1);
    expect(opened).toEqual([
      {
        reason: "books_payment_recorded_by_hand",
        paymentId: null,
        paymentGroupId: null,
        stripePaymentIntentId: null,
        stripeChargeId: null,
        stripeCustomerId: null,
        booksPaymentKey: `books:${BID_ORG_ID}:5000000000999:${invoice.stored.reference}`,
        accountingReference: invoice.stored.reference,
        booksPaymentMode: "Cheque",
        booksPaymentDate: "2031-03-09",
        amountCents: 40_000,
        currency: "GBP",
      },
    ]);
    expect(txSeen).toEqual([tx]);
    // Seen again the next night: no second task.
    await check.runNightly();
    expect(opened).toHaveLength(1);
    // No document moved: the check never marks an invoice or payment anything.
    expect(JSON.stringify(documents.documents().map((d) => [d.id, d.record]))).toBe(before);
  });

  it("while a LAX payment on the invoice is unsettled, an unknown Books payment opens no task and is looked at again", async () => {
    const { check, store, opened, fake, invoice } = await setUp();
    const unknown = {
      providerPaymentId: "5000000000998",
      amountPence: 154_320,
      date: "2031-03-02",
      mode: "Stripe",
      reference: null,
    };
    fake.setStatus(
      invoice.providerId,
      read({ state: "paid", balancePence: 0, payments: [unknown] }),
    );
    store.laxPaymentUnresolved = true;
    expect((await check.runNightly()).tasks).toBe(0);
    expect(opened).toEqual([]);
    expect(store.snapshots.get(invoice.stored.id)?.paymentIds).toEqual([]);
    expect(log.info).toHaveBeenCalledWith(
      {
        documentId: invoice.stored.id,
        reference: invoice.stored.reference,
        booksPaymentIds: ["5000000000998"],
      },
      "accounting_status_payments_held_back",
    );
  });

  it("stops at its share of the budget and records the run as budget_spent", async () => {
    const { check, store, fake } = await setUp({ maxCalls: 1 });
    expect(await check.runNightly()).toMatchObject({ outcome: "budget_spent", checked: 1 });
    expect(fake.statusReads).toHaveLength(1);
    expect(store.runs[0]?.outcome).toBe("budget_spent");
  });

  it("stops as soon as Books says the day's budget is spent, reading nothing more", async () => {
    const reads: string[] = [];
    const statuses: DocumentStatusPort = {
      readStatus: async (_d, issued) => {
        reads.push(issued.providerId);
        return { status: "budget_spent" };
      },
    };
    const { check, store } = await setUp({ statuses });
    expect(await check.runNightly()).toEqual({
      outcome: "budget_spent",
      checked: 0,
      changed: 0,
      tasks: 0,
    });
    expect(reads).toHaveLength(1);
    expect(store.snapshots.size).toBe(0);
  });

  it("in the dry run reads nothing, records nothing and the run says rehearsal", async () => {
    const statuses: DocumentStatusPort = { readStatus: async () => ({ status: "rehearsal" }) };
    const { check, store, opened } = await setUp({ statuses });
    expect((await check.runNightly()).outcome).toBe("rehearsal");
    expect(store.snapshots.size).toBe(0);
    expect(opened).toEqual([]);
  });

  it("skips a document Books cannot answer for now, without recording it", async () => {
    const { check, store, fake, invoice } = await setUp();
    fake.setStatus(invoice.providerId, { status: "unavailable", reason: "zoho_books_server_500" });
    await check.runNightly();
    expect(store.snapshots.has(invoice.stored.id)).toBe(false);
    expect(log.warn).toHaveBeenCalledWith(
      { documentId: invoice.stored.id, reason: "zoho_books_server_500" },
      "accounting_status_unavailable",
    );
  });

  it("a run that fails is recorded as failed", async () => {
    const statuses: DocumentStatusPort = {
      readStatus: async () => {
        throw new Error("boom");
      },
    };
    const { check, store } = await setUp({ statuses });
    await expect(check.runNightly()).rejects.toThrow("boom");
    expect(store.runs[0]?.outcome).toBe("failed");
  });
});

describe("a Books notice is only a hint to read again", () => {
  it("reads the named document from Books now, whatever the notice said", async () => {
    const { check, store, fake, invoice } = await setUp();
    fake.setStatus(invoice.providerId, read({ state: "void" }));
    expect(
      await check.recheckFromNotice({
        organizationId: BID_ORG_ID,
        module: "invoice",
        entityId: invoice.providerId,
      }),
    ).toBe("read");
    expect(fake.statusReads).toEqual([invoice.providerId]);
    expect(store.snapshots.get(invoice.stored.id)?.state).toBe("void");
  });

  it("changes nothing for another organisation or a document LAX does not hold", async () => {
    const { check, fake, invoice } = await setUp();
    expect(
      await check.recheckFromNotice({
        organizationId: SHOP_ORG_ID,
        module: "invoice",
        entityId: invoice.providerId,
      }),
    ).toBe("not_ours");
    expect(
      await check.recheckFromNotice({
        organizationId: BID_ORG_ID,
        module: "invoice",
        entityId: "123",
      }),
    ).toBe("not_ours");
    expect(
      await check.recheckFromNotice({
        organizationId: BID_ORG_ID,
        module: "creditnote",
        entityId: invoice.providerId,
      }),
    ).toBe("not_ours");
    expect(fake.statusReads).toEqual([]);
  });

  it("leaves the mark for tonight when Books cannot be read now", async () => {
    const { check, store, fake, invoice } = await setUp();
    fake.setStatus(invoice.providerId, { status: "budget_spent" });
    expect(
      await check.recheckFromNotice({
        organizationId: BID_ORG_ID,
        module: "invoice",
        entityId: invoice.providerId,
      }),
    ).toBe("not_read");
    expect(store.rechecks.has(invoice.stored.id)).toBe(true);
  });
});
