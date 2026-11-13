import type {
  AccountingQueueQuery,
  IAccountingDocumentBrowser,
  StoredAccountingDocument,
} from "@auction/persistence/interfaces";
import type { FailedJobSource } from "@auction/types";
import { describe, expect, it, vi } from "vitest";
import { AccountingDocumentsSource, BOOKS_QUEUE_ID } from "./accounting-documents.source.js";
import type { SourceListQuery } from "./failed-job-source.js";

function doc(
  id: string,
  createdAt: string,
  updatedAt: string,
  record: object,
): StoredAccountingDocument {
  return {
    id,
    kind: "invoice",
    reference: `LAX-BID-INV-${id}`,
    record: { kind: "invoice", reference: `LAX-BID-INV-${id}`, attempts: 2, ...record },
    lastErrorClass: null,
    createdAt: new Date(createdAt),
    updatedAt: new Date(updatedAt),
  } as unknown as StoredAccountingDocument;
}

const failed = doc("a1", "2026-11-09T08:00:00Z", "2026-11-10T10:00:00Z", {
  status: "failed",
  reason: "zoho_books_mapping_no_tax_id",
});
const locked = doc("b2", "2026-11-11T08:00:00Z", "2026-11-12T10:00:00Z", {
  status: "failed",
  reason: "zoho_books_validation_period_locked",
});

function browser(): IAccountingDocumentBrowser & { list: ReturnType<typeof vi.fn> } {
  return {
    list: vi.fn(async (query: AccountingQueueQuery) => ({
      documents: query.tab === "failed" ? [failed] : [locked],
      unreadable: [],
      total: 1,
      counts: { needs_person: 1, failed: 1, waiting: 4, issued: 9 },
      issuedToday: 0,
      lastSent: null,
    })),
    findById: vi.fn(),
  };
}

function query(read: FailedJobSource[], extra: Partial<SourceListQuery> = {}): SourceListQuery {
  return {
    view: "needs_review",
    sort: "failed_desc",
    limit: 50,
    offset: 0,
    viewer: { read: new Set(read), act: new Set(read) },
    actionsEnabled: true,
    ...extra,
  };
}

describe("AccountingDocumentsSource", () => {
  it("lists refused and waiting-for-a-person Books documents, newest first, read-only", async () => {
    const source = new AccountingDocumentsSource({ browser: browser() });
    const result = await source.list(query(["integrations.books"]));
    expect(result.readable).toBe(true);
    expect(result.total).toBe(2);
    expect(result.counts).toEqual({ needs_review: 2, retried: 0, discarded: 0 });
    expect(result.queues).toEqual([
      { id: BOOKS_QUEUE_ID, label: "Zoho Books documents", count: 2 },
    ]);
    expect(result.rows.map((r) => r.id)).toEqual([
      "accounting:needs_person:b2",
      "accounting:failed:a1",
    ]);
    expect(result.rows[1]).toMatchObject({
      source: "integrations.books",
      canAct: false,
      typeLabel: "Invoice to Zoho Books",
      jobLabel: "LAX-BID-INV-a1",
      sourceLabel: "Integrations · Zoho Books",
      errorSummary: "A line carries VAT, but Books has no VAT rate set up for it.",
      attempts: 2,
      // First failed is when it entered the queue; last failed is its last change.
      firstFailedAt: "2026-11-09T08:00:00.000Z",
      lastFailedAt: "2026-11-10T10:00:00.000Z",
      retry: { allowed: false, reason: "Try it again from Finance › Accounting." },
    });
  });

  it("hides itself from someone who cannot read Books documents", async () => {
    const reader = browser();
    const source = new AccountingDocumentsSource({ browser: reader });
    const result = await source.list(query(["integrations.xero"]));
    expect(result).toMatchObject({ readable: false, rows: [], total: 0 });
    expect(reader.list).not.toHaveBeenCalled();
  });

  it("has nothing retried or discarded, and filters by text", async () => {
    const source = new AccountingDocumentsSource({ browser: browser() });
    expect((await source.list(query(["integrations.books"], { view: "retried" }))).rows).toEqual(
      [],
    );
    const searched = await source.list(
      query(["integrations.books"], { q: "accountant has closed" }),
    );
    expect(searched.rows.map((r) => r.id)).toEqual(["accounting:needs_person:b2"]);
    expect(searched.total).toBe(1);
  });

  it("owns only its ids and queue, opens nothing and acts on nothing", async () => {
    const source = new AccountingDocumentsSource({ browser: browser() });
    expect(source.owns("accounting:x")).toBe(true);
    expect(source.owns("delivery:1")).toBe(false);
    expect(source.ownsQueue(BOOKS_QUEUE_ID)).toBe(true);
    expect(await source.detail()).toBeNull();
    expect(await source.find()).toEqual([]);
  });
});
