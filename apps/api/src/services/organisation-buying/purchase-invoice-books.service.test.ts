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
/** A document of another account's invoice: never this lot's to serve. */
const FOREIGN_DOC = "dddddddd-0000-4000-8000-0000000000f0";

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

const issued = (number: string): DocumentRecord => ({
  kind: "invoice",
  reference: "LAX-BID-INV-inv-2",
  attempts: 1,
  status: "issued",
  issued: { number, providerId: number, pdfRef: null },
});

function doc(over: Partial<BidInvoiceBooksDocument> = {}): BidInvoiceBooksDocument {
  return {
    documentId: INVOICE_DOC,
    reference: "LAX-BID-INV-inv-2",
    targetMode: "live",
    record: issued("INV-000123"),
    grossPence: 150_000,
    issuedAt: new Date("2026-11-12T14:20:00Z"),
    copy: { storageKey: "accounting/london_auction_xchange/doc.pdf", rehearsal: false },
    ...over,
  };
}

function setUp(opts: {
  mode?: Mode;
  invoices?: BidInvoiceBooksDocument[];
  voidedAt?: Date | null;
  minutesAfterRaise?: number;
  unreadable?: boolean;
  paidWith?: "card" | "bank_transfer" | null;
  creditNotes?: BidInvoiceBooksDocument[];
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
      read: async (invoiceId: string) => {
        if (opts.unreadable) return refuse("bad_stored_document", "broken");
        // Another account's invoice holds its own issued, stored document.
        const foreign = invoiceId !== INVOICE.id;
        return ok({
          invoice: { id: invoiceId, raisedAt: RAISED, voidedAt: null, totalPence: 150_000 },
          invoices: foreign
            ? [
                doc({
                  documentId: FOREIGN_DOC,
                  copy: { storageKey: "accounting/x/f.pdf", rehearsal: false },
                }),
              ]
            : (opts.invoices ?? []),
          creditNotes: foreign
            ? [credit({ documentId: FOREIGN_CREDIT, number: "CN-FOREIGN" })]
            : (opts.creditNotes ?? []),
          paidWith: opts.paidWith ?? null,
        });
      },
    },
    storage: { getObjectBytes },
    now: () => new Date(RAISED.getTime() + (opts.minutesAfterRaise ?? 5) * 60_000),
  });
  return { service, getObjectBytes };
}

const FOREIGN_CREDIT = "c0c0c0c0-0000-4000-8000-0000000000f1";

/** A credit note Books issued live for the invoice, with LAX's copy stored. */
function credit(
  over: { documentId?: string; number?: string; gross?: number; reference?: string } & Partial<
    Pick<BidInvoiceBooksDocument, "targetMode" | "copy">
  > = {},
): BidInvoiceBooksDocument {
  const reference = over.reference ?? "LAX-BID-CN-refund-1";
  return {
    documentId: over.documentId ?? "c0c0c0c0-0000-4000-8000-000000000001",
    reference,
    targetMode: over.targetMode ?? "live",
    record: {
      kind: "credit_note",
      reference,
      attempts: 1,
      status: "issued",
      issued: { number: over.number ?? "CN-00001", providerId: "cn-1", pdfRef: null },
    },
    grossPence: over.gross ?? 12_345,
    issuedAt: new Date("2026-11-20T09:30:00Z"),
    copy:
      over.copy === undefined
        ? { storageKey: "accounting/london_auction_xchange/cn.pdf", rehearsal: false }
        : over.copy,
  };
}

const card = async (opts: Parameters<typeof setUp>[0]) =>
  (await setUp(opts).service.card(payer, LOT))._unsafeUnwrap();

describe("PurchaseInvoiceBooksService.card", () => {
  it("keeps LAX's own invoice while Books is off, only rehearsing, or at the test organisation", async () => {
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
    // The test organisation's documents are not tax invoices: never shown, never "late".
    const atTestOrg = await card({
      mode: "test_org",
      invoices: [doc({ targetMode: "test_org" })],
      minutesAfterRaise: 120,
    });
    expect(atTestOrg).toMatchObject({ state: "lax", invoiceNumber: null, issuedAt: null });
    const waitingAtTestOrg = await card({
      mode: "test_org",
      invoices: [doc({ targetMode: "test_org", copy: null })],
      minutesAfterRaise: 120,
    });
    expect(waitingAtTestOrg.state).toBe("lax");
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

  it("gives the Books number, when it was issued (the issue event, not the row) and the stored copy", async () => {
    expect(await card({ invoices: [doc()] })).toEqual({
      state: "issued",
      invoiceNumber: "INV-000123",
      issuedAt: "2026-11-12T14:20:00.000Z",
      invoiceDocumentId: INVOICE_DOC,
      cancelledAt: null,
      totalPence: 150_000,
      cancelledAfterDefault: false,
      creditNotes: [],
      paidWith: null,
    });
  });

  it("says how the invoice was paid, so a refund can say where it went", async () => {
    expect(await card({ invoices: [doc()], paidWith: "bank_transfer" })).toMatchObject({
      paidWith: "bank_transfer",
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
  it("serves the stored copy of the invoice Books issued live", async () => {
    const { service, getObjectBytes } = setUp({ invoices: [doc()] });
    const invoice = (await service.document(payer, LOT, INVOICE_DOC))._unsafeUnwrap();
    expect(invoice.filename).toBe("invoice-INV-000123.pdf");
    expect(getObjectBytes).toHaveBeenCalledWith(
      "accounting/london_auction_xchange/doc.pdf",
      10 * 1024 * 1024,
    );
  });

  it("never serves a rehearsal copy, even of a live document", async () => {
    // Each guard on its own: here the mode is live and only the copy is a rehearsal.
    const { service, getObjectBytes } = setUp({
      invoices: [doc({ copy: { storageKey: "accounting/x/r.pdf", rehearsal: true } })],
    });
    expect((await service.document(payer, LOT, INVOICE_DOC))._unsafeUnwrapErr().code).toBe(
      "invoice_not_ready",
    );
    expect(getObjectBytes).not.toHaveBeenCalled();
  });

  it("never serves a dry run's or the test organisation's document, even with a real copy", async () => {
    // Each guard on its own: here the copy is not a rehearsal and only the mode refuses it.
    for (const mode of ["dry_run", "test_org"] as const) {
      const { service, getObjectBytes } = setUp({ mode, invoices: [doc({ targetMode: mode })] });
      expect((await service.document(payer, LOT, INVOICE_DOC))._unsafeUnwrapErr().code).toBe(
        "invoice_not_ready",
      );
      expect(getObjectBytes).not.toHaveBeenCalled();
    }
  });

  it("refuses the document of a cancelled invoice", async () => {
    const { service, getObjectBytes } = setUp({
      invoices: [doc()],
      voidedAt: new Date("2026-11-13T09:00:00Z"),
    });
    const refused = (await service.document(payer, LOT, INVOICE_DOC))._unsafeUnwrapErr();
    expect(refused.code).toBe("invoice_not_ready");
    expect(refused.status).toBe(404);
    expect(getObjectBytes).not.toHaveBeenCalled();
  });

  it("refuses a document of another account's invoice with the same 404, reading nothing", async () => {
    const { service, getObjectBytes } = setUp({ invoices: [doc()] });
    const refused = (await service.document(payer, LOT, FOREIGN_DOC))._unsafeUnwrapErr();
    expect(refused).toMatchObject({ code: "invoice_not_ready", status: 404 });
    expect(getObjectBytes).not.toHaveBeenCalled();
  });

  it("refuses a member who does not pay the invoice", async () => {
    const { service } = setUp({ invoices: [doc()] });
    const agent: OrganisationMemberActor = { ...payer, role: "buyer_agent" };
    expect((await service.document(agent, LOT, INVOICE_DOC))._unsafeUnwrapErr().code).toBe(
      "insufficient_entity_role",
    );
  });
});

describe("PurchaseInvoiceBooksService: credit notes", () => {
  it("lists a refund's credit note issued live with its copy, beside the issued invoice", async () => {
    const out = await card({ invoices: [doc()], creditNotes: [credit()] });
    expect(out).toMatchObject({
      state: "issued",
      cancelledAfterDefault: false,
      creditNotes: [
        {
          documentId: "c0c0c0c0-0000-4000-8000-000000000001",
          number: "CN-00001",
          grossPence: 12_345,
          kind: "refund",
        },
      ],
    });
  });

  it("never lists a credit note before its copy is stored, or from a rehearsal or the test organisation", async () => {
    expect(
      (await card({ invoices: [doc()], creditNotes: [credit({ copy: null })] })).creditNotes,
    ).toEqual([]);
    expect(
      (
        await card({
          invoices: [doc()],
          creditNotes: [credit({ copy: { storageKey: "k", rehearsal: true } })],
        })
      ).creditNotes,
    ).toEqual([]);
    const atTestOrg = await card({
      mode: "test_org",
      invoices: [doc({ targetMode: "test_org" })],
      creditNotes: [credit({ targetMode: "test_org" })],
    });
    expect(atTestOrg).toMatchObject({ state: "lax", creditNotes: [] });
  });

  it("says cancelled after a default, with its credit note once issued", async () => {
    const waiting = await card({
      voidedAt: new Date("2026-11-30T10:00:00Z"),
      invoices: [doc()],
      creditNotes: [credit({ reference: "LAX-BID-CN-dft-inv-2", copy: null })],
    });
    expect(waiting).toMatchObject({
      state: "cancelled",
      cancelledAfterDefault: true,
      creditNotes: [],
    });
    const issuedCredit = await card({
      voidedAt: new Date("2026-11-30T10:00:00Z"),
      invoices: [doc()],
      creditNotes: [
        credit({ reference: "LAX-BID-CN-dft-inv-2", number: "CN-00009", gross: 150_000 }),
      ],
    });
    expect(issuedCredit).toMatchObject({
      state: "cancelled",
      cancelledAfterDefault: true,
      creditNotes: [{ number: "CN-00009", grossPence: 150_000, kind: "default" }],
    });
    // A plain cancel (no default's credit note) is not called a default.
    expect(
      await card({ voidedAt: new Date("2026-11-30T10:00:00Z"), invoices: [doc()] }),
    ).toMatchObject({
      state: "cancelled",
      cancelledAfterDefault: false,
    });
  });

  it("serves a credit note's stored copy, also for a cancelled invoice; never another invoice's (same 404)", async () => {
    const { service, getObjectBytes } = setUp({
      voidedAt: new Date("2026-11-30T10:00:00Z"),
      invoices: [doc()],
      creditNotes: [credit({ reference: "LAX-BID-CN-dft-inv-2", number: "CN-00009" })],
    });
    const served = await service.document(payer, LOT, "c0c0c0c0-0000-4000-8000-000000000001");
    expect(served._unsafeUnwrap().filename).toBe("credit-note-CN-00009.pdf");
    // The cancelled invoice itself is still not served.
    expect((await service.document(payer, LOT, INVOICE_DOC))._unsafeUnwrapErr().status).toBe(404);
    getObjectBytes.mockClear();
    const foreign = await service.document(payer, LOT, FOREIGN_CREDIT);
    const missing = await service.document(payer, LOT, "c0c0c0c0-0000-4000-8000-00000000dead");
    expect(foreign._unsafeUnwrapErr()).toEqual(missing._unsafeUnwrapErr());
    expect(getObjectBytes).not.toHaveBeenCalled();
  });

  /** The credit note held for a person, Books' document kept, for `reason`. */
  const heldFor = (reason: string): BidInvoiceBooksDocument => {
    const issuedNote = credit({ number: "CN-00007", gross: 150_000 });
    const record = issuedNote.record;
    if (record.status !== "issued") throw new Error("fixture");
    return {
      ...issuedNote,
      record: {
        kind: "credit_note",
        reference: issuedNote.reference,
        attempts: 1,
        status: "needs_review",
        lookup: "clear",
        issued: record.issued,
        mismatch: null,
        reason,
      },
    };
  };

  it("keeps listing and serving a refund's credit note when only its refund from clearing was refused (review N3); never one whose refund was taken back", async () => {
    const refused = heldFor("accounting_credit_note_refund_refused");
    const { service } = setUp({ invoices: [doc()], creditNotes: [refused] });
    expect((await service.card(payer, LOT))._unsafeUnwrap().creditNotes).toEqual([
      {
        documentId: refused.documentId,
        number: "CN-00007",
        grossPence: 150_000,
        issuedAt: "2026-11-20T09:30:00.000Z",
        kind: "refund",
      },
    ]);
    const served = await service.document(payer, LOT, refused.documentId);
    expect(served._unsafeUnwrap().filename).toBe("credit-note-CN-00007.pdf");
    for (const reason of [
      "accounting_refund_reversed_after_credit",
      "accounting_totals_mismatch",
    ]) {
      const held = heldFor(reason);
      const other = setUp({ invoices: [doc()], creditNotes: [held] });
      expect((await other.service.card(payer, LOT))._unsafeUnwrap().creditNotes).toEqual([]);
      expect(
        (await other.service.document(payer, LOT, held.documentId))._unsafeUnwrapErr().status,
      ).toBe(404);
    }
    // Without its stored live copy it is not listed either.
    const uncopied = { ...refused, copy: null };
    expect((await card({ invoices: [doc()], creditNotes: [uncopied] })).creditNotes).toEqual([]);
  });
});
