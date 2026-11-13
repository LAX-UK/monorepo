import {
  type DocumentRecord,
  INVOICE_DELAYED_AFTER_MS,
  type Mode,
  ok,
  refuse,
} from "@auction/accounting-domain";
import type { BidInvoiceBooksDocument, BidInvoiceRecord } from "@auction/persistence/interfaces";
import { describe, expect, it, vi } from "vitest";
import type { OrganisationMemberActor } from "../interfaces/organisation-membership-service.js";
import { PurchaseInvoiceBooksService } from "./purchase-invoice-books.service.js";

const LOT = "aaaaaaaa-0000-4000-8000-000000000002";
const PAYMENT = "pay-2";
const RAISED = new Date("2026-11-12T14:05:00Z");
const INVOICE_DOC = "dddddddd-0000-4000-8000-000000000001";
const CREDIT_DOC = "dddddddd-0000-4000-8000-000000000002";

const payer: OrganisationMemberActor = {
  userId: "finance-1",
  legalEntityId: "account-1",
  role: "finance",
};

const INVOICE = {
  id: "inv-2",
  totalPence: 150_000,
  raisedAt: RAISED,
  voidedAt: null,
} as BidInvoiceRecord;

const issued = (number: string, kind: "invoice" | "credit_note" = "invoice"): DocumentRecord => ({
  kind,
  reference: kind === "invoice" ? "LAX-BID-INV-inv-2" : "LAX-BID-CN-r-1",
  attempts: 1,
  status: "issued",
  issued: { number, providerId: number, pdfRef: null },
});

function doc(over: Partial<BidInvoiceBooksDocument> = {}): BidInvoiceBooksDocument {
  return {
    documentId: INVOICE_DOC,
    targetMode: "live",
    record: issued("INV-000123"),
    grossPence: 150_000,
    updatedAt: new Date("2026-11-12T14:20:00Z"),
    copy: { storageKey: "accounting/london_auction_xchange/doc.pdf", rehearsal: false },
    ...over,
  };
}

function setUp(opts: {
  mode?: Mode;
  invoices?: BidInvoiceBooksDocument[];
  creditNotes?: BidInvoiceBooksDocument[];
  voidedAt?: Date | null;
  minutesAfterRaise?: number;
  unreadable?: boolean;
}) {
  const getObjectBytes = vi.fn(async () => Buffer.from("%PDF-1.4 stored"));
  const service = new PurchaseInvoiceBooksService({
    candidates: {
      read: (async () => ({
        entries: [
          {
            lotId: LOT,
            row: { lotId: LOT, payment: { id: PAYMENT, status: "captured" } },
            view: { paymentRole: "payer" },
            flags: {},
          },
        ],
        winners: new Map(),
      })) as never,
    },
    invoices: {
      findByPaymentIds: async () =>
        new Map([[PAYMENT, { ...INVOICE, voidedAt: opts.voidedAt ?? null }]]),
    },
    settings: {
      read: async () =>
        ok({
          bid: { xero: "off", books: opts.mode ?? "live" },
          shop: { xero: "off", books: "off" },
          lax_art: { xero: "off", books: "off" },
        }),
    },
    books: {
      read: async () =>
        opts.unreadable
          ? refuse("bad_stored_document", "broken")
          : ok({
              invoice: { id: INVOICE.id, raisedAt: RAISED, voidedAt: null, totalPence: 150_000 },
              invoices: opts.invoices ?? [],
              creditNotes: opts.creditNotes ?? [],
            }),
    },
    storage: { getObjectBytes },
    now: () => new Date(RAISED.getTime() + (opts.minutesAfterRaise ?? 5) * 60_000),
  });
  return { service, getObjectBytes };
}

const card = async (opts: Parameters<typeof setUp>[0]) =>
  (await setUp(opts).service.card(payer, LOT))._unsafeUnwrap();

describe("PurchaseInvoiceBooksService.card", () => {
  it("keeps LAX's own invoice while Books is off or only rehearsing", async () => {
    expect((await card({ mode: "off" })).state).toBe("lax");
    const rehearsed = await card({
      mode: "dry_run",
      invoices: [
        doc({
          targetMode: "dry_run",
          record: issued("DRY-RUN"),
          copy: { storageKey: "k", rehearsal: true },
        }),
      ],
      minutesAfterRaise: 120,
    });
    expect(rehearsed).toMatchObject({ state: "lax", invoiceNumber: null, invoiceDocumentId: null });
  });

  it("is being prepared, then late after 30 minutes, until the copy is stored", async () => {
    const pending = doc({
      record: { ...issued("x"), status: "pending" } as DocumentRecord,
      copy: null,
    });
    expect((await card({ invoices: [pending] })).state).toBe("preparing");
    expect((await card({ invoices: [pending], minutesAfterRaise: 31 })).state).toBe("delayed");
    expect(INVOICE_DELAYED_AFTER_MS).toBe(30 * 60_000);
    // Issued, but LAX holds no copy yet: no number, nothing to download.
    expect(await card({ invoices: [doc({ copy: null })] })).toMatchObject({
      state: "preparing",
      invoiceNumber: null,
    });
  });

  it("gives the Books number, when it was issued and the stored copy, with its credit notes", async () => {
    const credit = doc({
      documentId: CREDIT_DOC,
      record: issued("CN-000007", "credit_note"),
      grossPence: 25_000,
    });
    const rehearsedCredit = doc({
      documentId: "x",
      targetMode: "dry_run",
      copy: { storageKey: "k", rehearsal: true },
    });
    expect(await card({ invoices: [doc()], creditNotes: [credit, rehearsedCredit] })).toEqual({
      state: "issued",
      invoiceNumber: "INV-000123",
      issuedAt: "2026-11-12T14:20:00.000Z",
      invoiceDocumentId: INVOICE_DOC,
      cancelledAt: null,
      totalPence: 150_000,
      creditNotes: [{ documentId: CREDIT_DOC, number: "CN-000007", amountPence: 25_000 }],
    });
  });

  it("says cancelled, with when", async () => {
    const voidedAt = new Date("2026-11-13T09:00:00Z");
    expect(await card({ invoices: [doc()], voidedAt })).toMatchObject({
      state: "cancelled",
      cancelledAt: voidedAt.toISOString(),
      invoiceNumber: null,
    });
  });

  it("falls back to LAX's own invoice when the Books records cannot be read", async () => {
    expect((await card({ unreadable: true })).state).toBe("lax");
  });
});

describe("PurchaseInvoiceBooksService.document", () => {
  it("serves the stored copy of an issued invoice or credit note, never a rehearsal", async () => {
    const credit = doc({ documentId: CREDIT_DOC, record: issued("CN-000007", "credit_note") });
    const { service, getObjectBytes } = setUp({ invoices: [doc()], creditNotes: [credit] });
    const invoice = (await service.document(payer, LOT, INVOICE_DOC))._unsafeUnwrap();
    expect(invoice.filename).toBe("invoice-INV-000123.pdf");
    expect(getObjectBytes).toHaveBeenCalledWith(
      "accounting/london_auction_xchange/doc.pdf",
      10 * 1024 * 1024,
    );
    const creditNote = (await service.document(payer, LOT, CREDIT_DOC))._unsafeUnwrap();
    expect(creditNote.filename).toBe("credit-note-CN-000007.pdf");

    const rehearsal = setUp({
      mode: "dry_run",
      invoices: [doc({ targetMode: "dry_run", copy: { storageKey: "k", rehearsal: true } })],
    });
    expect((await rehearsal.service.document(payer, LOT, INVOICE_DOC)).isErr()).toBe(true);
    expect(rehearsal.getObjectBytes).not.toHaveBeenCalled();
  });

  it("refuses a member who does not pay the invoice", async () => {
    const { service } = setUp({ invoices: [doc()] });
    const agent: OrganisationMemberActor = { ...payer, role: "buyer_agent" };
    expect((await service.document(agent, LOT, INVOICE_DOC))._unsafeUnwrapErr().code).toBe(
      "insufficient_entity_role",
    );
  });
});
