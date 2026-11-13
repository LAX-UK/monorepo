import {
  type DocumentPdfPort,
  type DocumentRecord,
  type Invoice,
  type TargetMode,
  ok,
  projectBidInvoiceRaised,
} from "@auction/accounting-domain";
import type {
  AccountingDocumentCopy,
  BidInvoiceEmailFacts,
  IAccountingDocumentCopies,
  InvoiceEmailDue,
  InvoiceEmailDueList,
  InvoiceEmailSkipReason,
  StoredAccountingDocument,
} from "@auction/persistence/interfaces";
import { describe, expect, it, vi } from "vitest";
import { AccountingInvoiceCopy, accountingCopyKey } from "./accounting-invoice-copy.service.js";

const INVOICE_ID = "0b6a4f8e-3c41-4c55-9d7e-1f0e2a3b4c5d";
const NOW = new Date("2026-11-12T15:00:00Z");
const PDF = new TextEncoder().encode("%PDF-1.4\n%%EOF\n");

function invoice(): Invoice {
  const projected = projectBidInvoiceRaised({
    invoiceId: INVOICE_ID,
    buyer: { legalEntityId: "5c1d2e3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f", name: "Maya", email: null },
    raisedOn: "2026-11-12",
    dueOn: "2026-11-26",
    lines: [{ kind: "hammer", label: "Hammer price", amountPence: 154_320 }],
  });
  if (!projected.ok) throw new Error(projected.refusal.code);
  return projected.value.documents[1] as Invoice;
}

function issuedDocument(
  mode: TargetMode,
  number = "INV-000123",
  id = `doc-${mode}`,
): StoredAccountingDocument {
  const document = invoice();
  const record: DocumentRecord = {
    kind: "invoice",
    reference: document.reference,
    attempts: 1,
    status: "issued",
    issued: { number, providerId: `p-${mode}`, pdfRef: "/invoices/1" },
  };
  return {
    id,
    product: "bid",
    legalEntity: "london_auction_xchange",
    kind: "invoice",
    reference: document.reference,
    sourceEventRef: "domain_event:1",
    document,
    totals: document.totals,
    provider: "books",
    target: { provider: "books", mode },
    record,
    lastErrorClass: null,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

type MemoryCopy = AccountingDocumentCopy & {
  emailOutboxId?: string;
  emailSkipped?: InvoiceEmailSkipReason;
};

/**
 * The copies table in memory, with the same rules: one copy per document, its email settled once
 * (queued or skipped), only live invoices listed as due, oldest stored first, `limit` at a time.
 * A document's invoice id is `invoice-<document id>`; a document numbered "" does not read back.
 */
class Copies implements IAccountingDocumentCopies {
  readonly copies = new Map<string, MemoryCopy>();
  constructor(private readonly documents: StoredAccountingDocument[]) {}
  async listUncopied(modes: readonly TargetMode[]) {
    return {
      documents: this.documents.filter(
        (d) => d.target && modes.includes(d.target.mode) && !this.copies.has(d.id),
      ),
      unreadable: [],
    };
  }
  async record(copy: AccountingDocumentCopy) {
    if (this.copies.has(copy.documentId)) return false;
    this.copies.set(copy.documentId, copy);
    return true;
  }
  async listEmailDue(limit: number): Promise<InvoiceEmailDueList> {
    const listed = this.documents
      .filter((d) => {
        const copy = this.copies.get(d.id);
        return (
          copy &&
          !copy.rehearsal &&
          !copy.emailOutboxId &&
          !copy.emailSkipped &&
          d.target?.mode === "live"
        );
      })
      .slice(0, limit);
    const due: InvoiceEmailDue[] = [];
    const unreadable: string[] = [];
    for (const d of listed) {
      const number = d.record.status === "issued" ? d.record.issued.number : "";
      if (!number) {
        unreadable.push(d.id);
        continue;
      }
      due.push({
        documentId: d.id,
        invoiceId: `invoice-${d.id}`,
        number,
        storageKey: this.copies.get(d.id)?.storageKey ?? "",
      });
    }
    return { due, unreadable };
  }
  async markEmailQueued(documentId: string, outboxId: string) {
    const copy = this.copies.get(documentId);
    if (!copy || copy.emailOutboxId || copy.emailSkipped) return false;
    this.copies.set(documentId, { ...copy, emailOutboxId: outboxId });
    return true;
  }
  async markEmailSkipped(documentId: string, reason: InvoiceEmailSkipReason) {
    const copy = this.copies.get(documentId);
    if (!copy || copy.emailOutboxId || copy.emailSkipped) return false;
    this.copies.set(documentId, { ...copy, emailSkipped: reason });
    return true;
  }
}

const facts: BidInvoiceEmailFacts = {
  invoiceId: INVOICE_ID,
  lotId: "7a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d",
  lotTitle: "Lot 12 · Harbour at dusk",
  totalPence: 154_320,
  paidAt: new Date("2026-11-12T14:05:00Z"),
  dueAt: new Date("2026-11-26T23:59:59Z"),
  cancelled: false,
  payer: { userId: "user-1", email: "maya@example.test", name: "Maya" },
  billingEmail: "accounts@example.test",
  buyerLegalEntityId: "5c1d2e3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f",
};

function setUp(
  mode: TargetMode,
  pdf: Partial<Record<TargetMode, DocumentPdfPort>> = {},
  documents = [issuedDocument(mode)],
  opts: {
    factsFor?: (invoiceId: string) => BidInvoiceEmailFacts | null;
    batch?: number;
    enqueueFails?: boolean;
  } = {},
) {
  const copies = new Copies(documents);
  const putObject = vi.fn(async () => ({ url: "unused" }));
  let n = 0;
  const enqueue = vi.fn(async () => {
    if (opts.enqueueFails) throw new Error("outbox down");
    return { outboxId: `outbox-${++n}` };
  });
  const log = { info: vi.fn(), warn: vi.fn() };
  const fetched = (rehearsal: boolean): DocumentPdfPort => ({
    fetchPdf: vi.fn(async () => ({
      status: "fetched" as const,
      bytes: PDF,
      contentType: "application/pdf" as const,
      rehearsal,
    })),
  });
  const service = new AccountingInvoiceCopy({
    copies,
    settings: {
      read: async () =>
        ok({
          bid: { xero: "off", books: mode },
          shop: { xero: "off", books: "off" },
          lax_art: { xero: "off", books: "off" },
        }),
    },
    pdfsByMode: { [mode]: fetched(mode === "dry_run"), ...pdf },
    storage: { putObject },
    emailFacts: { forInvoice: async (invoiceId) => (opts.factsFor ?? (() => facts))(invoiceId) },
    email: { enqueue },
    webBaseUrl: "https://lax.bid/",
    now: () => NOW,
    log,
    ...(opts.batch ? { batch: opts.batch } : {}),
  });
  return { service, copies, putObject, enqueue, log };
}

describe("AccountingInvoiceCopy", () => {
  it("keeps a rehearsed invoice's stand-in page and emails no one in dry run", async () => {
    const { service, copies, putObject, enqueue } = setUp("dry_run");
    expect(await service.tick()).toEqual({ stored: 1, emailed: 0 });
    const document = issuedDocument("dry_run");
    expect(putObject).toHaveBeenCalledWith(
      accountingCopyKey(document),
      Buffer.from(PDF),
      "application/pdf",
    );
    expect(copies.copies.get(document.id)).toMatchObject({
      storageKey: "accounting/london_auction_xchange/doc-dry_run.pdf",
      byteSize: PDF.length,
      rehearsal: true,
    });
    expect(copies.copies.get(document.id)?.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(enqueue).not.toHaveBeenCalled();
  });

  it("stores the Books PDF and emails the payer and the billing inbox once (live)", async () => {
    const { service, enqueue } = setUp("live");
    expect(await service.tick()).toEqual({ stored: 1, emailed: 1 });
    expect(enqueue).toHaveBeenCalledTimes(2);
    expect(enqueue).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        template: "bid-invoice-issued",
        to: "maya@example.test",
        userId: "user-1",
        idempotencyKey: "bid-invoice-issued:doc-live",
        vars: expect.objectContaining({
          invoiceNumber: "INV-000123",
          total: "£1,543.20",
          settlement: { kind: "paid", on: "Thu 12 Nov, 14:05 GMT" },
          purchaseUrl: "https://lax.bid/purchases/7a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d",
          storedAttachment: expect.objectContaining({
            storageKey: "accounting/london_auction_xchange/doc-live.pdf",
          }),
        }),
      }),
    );
    expect(enqueue).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ to: "accounts@example.test", recipientResolution: "snapshot" }),
    );
    // Once: the next tick finds nothing to store and nothing to send.
    expect(await service.tick()).toEqual({ stored: 0, emailed: 0 });
    expect(enqueue).toHaveBeenCalledTimes(2);
  });

  it("treats the test organisation like a dry run: keeps the copy, emails no one", async () => {
    // Its documents are not tax invoices; no buyer is ever sent one.
    const { service, copies, enqueue } = setUp("test_org");
    expect(await service.tick()).toEqual({ stored: 1, emailed: 0 });
    expect(await service.tick()).toEqual({ stored: 0, emailed: 0 });
    expect(copies.copies.get("doc-test_org")).toMatchObject({ rehearsal: false });
    expect(enqueue).not.toHaveBeenCalled();
  });

  it("settles a cancelled invoice at the head of the list, so the one behind it is emailed", async () => {
    const cancelled = issuedDocument("live", "INV-000001", "doc-a");
    const valid = issuedDocument("live", "INV-000002", "doc-b");
    const { service, copies, enqueue, log } = setUp("live", {}, [cancelled, valid], {
      batch: 1,
      factsFor: (invoiceId) => ({ ...facts, invoiceId, cancelled: invoiceId === "invoice-doc-a" }),
    });
    // Both copies are stored; emails go one at a time: the cancelled one first, settled as
    // skipped for good.
    expect(await service.tick()).toEqual({ stored: 2, emailed: 0 });
    expect(copies.copies.get("doc-a")?.emailSkipped).toBe("invoice_cancelled");
    expect(log.warn).toHaveBeenCalledWith(
      { documentId: "doc-a", reason: "invoice_cancelled" },
      "accounting_invoice_email_skipped",
    );
    expect(await service.tick()).toEqual({ stored: 0, emailed: 1 });
    expect(enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ idempotencyKey: "bid-invoice-issued:doc-b" }),
    );
    expect(enqueue).not.toHaveBeenCalledWith(
      expect.objectContaining({ idempotencyKey: "bid-invoice-issued:doc-a" }),
    );
    expect(copies.copies.get("doc-b")?.emailOutboxId).toBe("outbox-1");
  });

  it("settles every kind of copy it will never email, and keeps one that only failed", async () => {
    const missing = issuedDocument("live", "INV-000001", "doc-missing");
    const nobody = issuedDocument("live", "INV-000002", "doc-nobody");
    const unreadable = issuedDocument("live", "", "doc-unreadable");
    const { service, copies, enqueue } = setUp("live", {}, [missing, nobody, unreadable], {
      factsFor: (invoiceId) =>
        invoiceId === "invoice-doc-missing"
          ? null
          : { ...facts, invoiceId, payer: null, billingEmail: null },
    });
    await service.tick();
    expect(copies.copies.get("doc-missing")?.emailSkipped).toBe("invoice_missing");
    expect(copies.copies.get("doc-nobody")?.emailSkipped).toBe("no_recipient");
    expect(copies.copies.get("doc-unreadable")?.emailSkipped).toBe("unreadable_document");
    expect(enqueue).not.toHaveBeenCalled();

    // An outbox error is not final: the copy stays due and is tried again.
    const failing = setUp("live", {}, undefined, { enqueueFails: true });
    await failing.service.tick();
    await failing.service.tick();
    expect(failing.enqueue).toHaveBeenCalledTimes(2);
    expect(failing.copies.copies.get("doc-live")).not.toHaveProperty("emailSkipped");
    expect(failing.copies.copies.get("doc-live")?.emailOutboxId).toBeUndefined();
  });

  it("sends a former member nothing: only the billing inbox is emailed", async () => {
    // The facts name no payer when the member who paid has left or no longer pays.
    const { service, copies, enqueue } = setUp("live", {}, undefined, {
      factsFor: (invoiceId) => ({ ...facts, invoiceId, payer: null }),
    });
    expect(await service.tick()).toEqual({ stored: 1, emailed: 1 });
    expect(enqueue).toHaveBeenCalledTimes(1);
    expect(enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "accounts@example.test",
        recipientResolution: "snapshot",
        idempotencyKey: `bid-invoice-issued-billing:${facts.buyerLegalEntityId}:doc-live`,
      }),
    );
    expect(enqueue).not.toHaveBeenCalledWith(expect.objectContaining({ userId: "user-1" }));
    expect(copies.copies.get("doc-live")?.emailOutboxId).toBe("outbox-1");
  });

  it("never keeps a rehearsal page as a test or live invoice's copy", async () => {
    const rehearsalOnly: DocumentPdfPort = {
      fetchPdf: async () => ({
        status: "fetched",
        bytes: PDF,
        contentType: "application/pdf",
        rehearsal: true,
      }),
    };
    const { service, putObject, enqueue } = setUp("live", { live: rehearsalOnly });
    expect(await service.tick()).toEqual({ stored: 0, emailed: 0 });
    expect(putObject).not.toHaveBeenCalled();
    expect(enqueue).not.toHaveBeenCalled();
  });

  it("stores nothing when the PDF cannot be fetched, and tries again next tick", async () => {
    const unavailable: DocumentPdfPort = {
      fetchPdf: vi.fn(async () => ({
        status: "unavailable" as const,
        reason: "zoho_books_pdf_not_built",
      })),
    };
    const { service, putObject } = setUp("test_org", { test_org: unavailable });
    await service.tick();
    await service.tick();
    expect(unavailable.fetchPdf).toHaveBeenCalledTimes(2);
    expect(putObject).not.toHaveBeenCalled();
  });
});
