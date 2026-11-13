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

function issuedDocument(mode: TargetMode, number = "INV-000123"): StoredAccountingDocument {
  const document = invoice();
  const record: DocumentRecord = {
    kind: "invoice",
    reference: document.reference,
    attempts: 1,
    status: "issued",
    issued: { number, providerId: `p-${mode}`, pdfRef: "/invoices/1" },
  };
  return {
    id: `doc-${mode}`,
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

/** The copies table in memory, with the same rules: one copy per document, one email note. */
class Copies implements IAccountingDocumentCopies {
  readonly copies = new Map<string, AccountingDocumentCopy & { emailOutboxId?: string }>();
  constructor(private readonly documents: StoredAccountingDocument[]) {}
  async listUncopied(modes: readonly TargetMode[]) {
    return ok(
      this.documents.filter(
        (d) => d.target && modes.includes(d.target.mode) && !this.copies.has(d.id),
      ),
    );
  }
  async record(copy: AccountingDocumentCopy) {
    if (this.copies.has(copy.documentId)) return false;
    this.copies.set(copy.documentId, copy);
    return true;
  }
  async listEmailDue(): Promise<InvoiceEmailDue[]> {
    return this.documents
      .filter((d) => {
        const copy = this.copies.get(d.id);
        return copy && !copy.rehearsal && !copy.emailOutboxId && d.target?.mode !== "dry_run";
      })
      .map((d) => ({
        documentId: d.id,
        invoiceId: INVOICE_ID,
        number: d.record.status === "issued" ? d.record.issued.number : "",
        storageKey: this.copies.get(d.id)?.storageKey ?? "",
      }));
  }
  async markEmailQueued(documentId: string, outboxId: string) {
    const copy = this.copies.get(documentId);
    if (!copy || copy.emailOutboxId) return false;
    this.copies.set(documentId, { ...copy, emailOutboxId: outboxId });
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
) {
  const copies = new Copies(documents);
  const putObject = vi.fn(async () => ({ url: "unused" }));
  let n = 0;
  const enqueue = vi.fn(async () => ({ outboxId: `outbox-${++n}` }));
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
    emailFacts: { forInvoice: async () => facts },
    email: { enqueue },
    webBaseUrl: "https://lax.bid/",
    now: () => NOW,
    log: { info: vi.fn(), warn: vi.fn() },
  });
  return { service, copies, putObject, enqueue };
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

  it("stores the Books PDF and emails the payer and the billing inbox once", async () => {
    const { service, enqueue } = setUp("test_org");
    expect(await service.tick()).toEqual({ stored: 1, emailed: 1 });
    expect(enqueue).toHaveBeenCalledTimes(2);
    expect(enqueue).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        template: "bid-invoice-issued",
        to: "maya@example.test",
        userId: "user-1",
        idempotencyKey: "bid-invoice-issued:doc-test_org",
        vars: expect.objectContaining({
          invoiceNumber: "INV-000123",
          total: "£1,543.20",
          settlement: { kind: "paid", on: "Thu 12 Nov, 14:05 GMT" },
          purchaseUrl: "https://lax.bid/purchases/7a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d",
          storedAttachment: expect.objectContaining({
            storageKey: "accounting/london_auction_xchange/doc-test_org.pdf",
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
