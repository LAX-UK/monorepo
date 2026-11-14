import {
  type DocumentRecord,
  type Result,
  buildInvoice,
  laxReference,
  ok,
  refuse,
  requeue,
} from "@auction/accounting-domain";
import type {
  AccountingQueueQuery,
  DocumentTransition,
  IAccountingDocumentBrowser,
  IAccountingDocumentTransitions,
  StoredAccountingDocument,
  TransitionCode,
} from "@auction/persistence/interfaces";
import { describe, expect, it } from "vitest";
import { AccountingQueueService } from "./accounting-queue.service.js";

function must<T>(result: Result<T, string>): T {
  if (!result.ok) throw new Error(result.refusal.message);
  return result.value;
}

const invoice = must(
  buildInvoice({
    product: "bid",
    sourceId: "inv-1",
    contactReference: must(laxReference("bid", "contact", "c1")),
    issuedOn: "2026-11-01",
    dueOn: "2026-11-15",
    lines: [
      {
        description: "Lot 1",
        quantity: 1,
        unitNetPence: 10_000,
        treatment: "standard",
        role: "goods",
      },
    ],
  }),
);

function stored(
  record: Partial<DocumentRecord> & Pick<DocumentRecord, "status">,
  mode: "dry_run" | "test_org" = "dry_run",
): StoredAccountingDocument {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    product: "bid",
    legalEntity: "london_auction_xchange",
    kind: "invoice",
    reference: invoice.reference,
    sourceEventRef: "evt-1",
    document: invoice,
    totals: invoice.totals,
    provider: "books",
    target: { provider: "books", mode },
    record: {
      kind: "invoice",
      reference: invoice.reference,
      attempts: 1,
      ...record,
    } as DocumentRecord,
    lastErrorClass: null,
    createdAt: new Date("2026-11-10T09:00:00Z"),
    updatedAt: new Date("2026-11-11T09:00:00Z"),
  };
}

class FakeQueue implements IAccountingDocumentBrowser, IAccountingDocumentTransitions {
  queries: AccountingQueueQuery[] = [];
  applied: DocumentTransition[] = [];
  constructor(public document: StoredAccountingDocument | null) {}

  async list(query: AccountingQueueQuery) {
    this.queries.push(query);
    return {
      documents: this.document ? [this.document] : [],
      unreadable: ["bad-row"],
      total: 1,
      counts: { needs_person: 2, failed: 1, waiting: 0, issued: 4 },
      issuedToday: 3,
      lastSent: { at: new Date("2026-11-11T09:00:00Z"), rehearsal: false },
    };
  }

  async findById(id: string) {
    return ok(this.document?.id === id ? this.document : null);
  }

  async apply(
    _id: string,
    transition: DocumentTransition,
  ): Promise<Result<StoredAccountingDocument, TransitionCode>> {
    this.applied.push(transition);
    if (!this.document) return refuse("not_found", "no such document");
    const next = requeue(this.document.record);
    if (!next.ok) return next;
    this.document = { ...this.document, record: next.value };
    return ok(this.document);
  }
}

function setUp(document: StoredAccountingDocument | null) {
  const queue = new FakeQueue(document);
  const audits: unknown[] = [];
  const service = new AccountingQueueService({
    browser: queue,
    transitions: queue,
    audit: { retryRequested: async (input) => void audits.push(input) },
    booksLink: () => null,
  });
  return { queue, audits, service };
}

const failed = { status: "failed", reason: "zoho_books_mapping_no_tax_id" } as const;

describe("AccountingQueueService.list", () => {
  it("passes the tab, company and page through and words each row for staff", async () => {
    const { queue, service } = setUp(stored(failed));
    const page = await service.list({
      tab: "failed",
      organisation: "london_auction_xchange",
      reference: "LAX-BID-INV-abc",
      limit: 25,
      offset: 50,
      canAct: true,
    });
    expect(queue.queries).toEqual([
      {
        tab: "failed",
        legalEntity: "london_auction_xchange",
        reference: "LAX-BID-INV-abc",
        limit: 25,
        offset: 50,
      },
    ]);
    expect(page).toMatchObject({
      total: 1,
      unreadable: 1,
      canAct: true,
      limit: 25,
      offset: 50,
      issuedToday: 3,
      reference: "LAX-BID-INV-abc",
      lastSent: { at: "2026-11-11T09:00:00.000Z", rehearsal: false },
    });
    expect(page.counts).toEqual({ needs_person: 2, failed: 1, waiting: 0, issued: 4 });
    expect(page.rows[0]).toMatchObject({
      reference: invoice.reference,
      documentType: "invoice",
      organisation: "london_auction_xchange",
      grossPence: invoice.totals.grossPence,
      attempts: 1,
      problem: "A line carries VAT, but Books has no VAT rate set up for it.",
      problemCode: "zoho_books_mapping_no_tax_id",
      lockedPeriod: false,
      books: null,
      canTryAgain: true,
    });
  });

  it("names Books' own total when it worked the invoice out differently", async () => {
    const { service } = setUp(
      stored(
        {
          status: "needs_review",
          lookup: "clear",
          reason: "provider total differs: grossPence by 1 pence",
          issued: { number: "INV-000042", providerId: "42", pdfRef: null },
          mismatch: { field: "grossPence", differencePence: 1 },
        },
        "test_org",
      ),
    );
    const page = await service.list({
      tab: "needs_person",
      organisation: null,
      reference: null,
      limit: 50,
      offset: 0,
      canAct: true,
    });
    // Ours is £120.00 (£100 and its VAT); Books' is 1p more.
    expect(page.rows[0]).toMatchObject({
      state: "needs_review",
      problem: "Books worked out £120.01. The totals must match before it can be issued.",
      canTryAgain: false,
    });
  });

  it("offers no try again to someone who may only look", async () => {
    const { service } = setUp(stored(failed));
    const page = await service.list({
      tab: "failed",
      organisation: null,
      reference: null,
      limit: 50,
      offset: 0,
      canAct: false,
    });
    expect(page.rows[0]?.canTryAgain).toBe(false);
  });

  it("marks a locked period and shows the Books document once issued", async () => {
    const locked = setUp(
      stored({ status: "failed", reason: "zoho_books_validation_period_locked" }),
    );
    const lockedRow = (
      await locked.service.list({
        tab: "needs_person",
        organisation: null,
        reference: null,
        limit: 50,
        offset: 0,
        canAct: true,
      })
    ).rows[0];
    expect(lockedRow?.lockedPeriod).toBe(true);
    expect(lockedRow?.problem).toBe("This falls in a period your accountant has closed.");

    const issued = setUp(
      stored({ status: "issued", issued: { number: "INV-9", providerId: "123456", pdfRef: null } }),
    );
    const row = (
      await issued.service.list({
        tab: "issued",
        organisation: null,
        reference: null,
        limit: 50,
        offset: 0,
        canAct: true,
      })
    ).rows[0];
    expect(row).toMatchObject({
      books: { number: "INV-9", id: "123456", url: null },
      problem: null,
    });
    expect(row?.canTryAgain).toBe(false);
  });
});

describe("AccountingQueueService.tryAgain", () => {
  it("requeues the same document under the same reference and records who asked", async () => {
    const { queue, audits, service } = setUp(stored(failed));
    const answer = await service.tryAgain({
      documentId: "00000000-0000-4000-8000-000000000001",
      actorUserId: "staff-1",
    });
    expect(answer).toEqual({
      ok: true,
      value: {
        id: "00000000-0000-4000-8000-000000000001",
        reference: invoice.reference,
        outcome: "requeued",
      },
    });
    expect(queue.applied).toEqual([{ action: "requeue", requestedBy: "staff-1" }]);
    expect(audits).toEqual([
      {
        documentId: "00000000-0000-4000-8000-000000000001",
        actorUserId: "staff-1",
        payload: {
          reference: invoice.reference,
          documentType: "invoice",
          product: "bid",
          organisation: "london_auction_xchange",
          fromState: "failed",
          reason: "zoho_books_mapping_no_tax_id",
        },
      },
    ]);
  });

  it("is idempotent: asking again for a queued document changes nothing and audits nothing", async () => {
    const { queue, audits, service } = setUp(stored(failed));
    const request = { documentId: "00000000-0000-4000-8000-000000000001", actorUserId: "staff-1" };
    await service.tryAgain(request);
    const again = await service.tryAgain(request);
    expect(again).toMatchObject({ ok: true, value: { outcome: "already_queued" } });
    expect(queue.applied).toHaveLength(1);
    expect(audits).toHaveLength(1);
  });

  it("refuses what the life cycle will not requeue, and a document that does not exist", async () => {
    const held = setUp(
      stored({
        status: "needs_review",
        lookup: "clear",
        reason: "provider total differs: grossPence by 1 pence",
        issued: { number: "INV-1", providerId: "1", pdfRef: null },
        mismatch: { field: "grossPence", differencePence: 1 },
      }),
    );
    expect(
      await held.service.tryAgain({
        documentId: "00000000-0000-4000-8000-000000000001",
        actorUserId: "staff-1",
      }),
    ).toMatchObject({ ok: false, refusal: "not_allowed" });
    expect(held.queue.applied).toEqual([]);

    const none = setUp(null);
    expect(
      await none.service.tryAgain({
        documentId: "00000000-0000-4000-8000-000000000009",
        actorUserId: "s",
      }),
    ).toMatchObject({ ok: false, refusal: "not_found" });
  });
});
