import { type BidInvoiceDocument, InvoiceTotalMismatchError } from "@auction/exports/documents";
import type { BidInvoiceRecord } from "@auction/persistence/interfaces";
import { describe, expect, it, vi } from "vitest";
import type { OrganisationMemberActor } from "../interfaces/organisation-membership-service.js";
import {
  INVOICE_PDF_TOTAL_MISMATCH_EVENT,
  PurchaseInvoicePdfService,
  invoiceFilename,
} from "./purchase-invoice-pdf.service.js";

const LOT = "aaaaaaaa-0000-4000-8000-000000000002";
const PAYMENT = "pay-2";

const actor = (role: OrganisationMemberActor["role"]): OrganisationMemberActor => ({
  userId: `${role}-1`,
  legalEntityId: "account-1",
  role,
});

const INVOICE: BidInvoiceRecord = {
  id: "inv-2",
  lotId: LOT,
  buyerLegalEntityId: "account-1",
  sellerLegalEntityId: "seller-1",
  totalPence: 60_010,
  raisedAt: new Date("2026-11-10T10:00:00Z"),
  dueAt: new Date("2026-11-17T23:59:59Z"),
  pricingPolicyId: null,
  number: "LAXB-10482",
  source: "raised",
  voidedAt: null,
  lines: [
    { kind: "hammer", label: "Hammer price", ratePercent: null, amountPence: 48_008 },
    {
      kind: "buyers_premium",
      label: "Buyer's premium (25%)",
      ratePercent: "25",
      amountPence: 12_002,
    },
  ],
};

type Setup = {
  row?: object | null;
  view?: object | null;
  invoice?: BidInvoiceRecord | null;
  account?: object | null;
  refundedCents?: number;
};

function setup(over: Setup = {}) {
  const row =
    over.row === undefined
      ? {
          lotId: LOT,
          lotTitle: "Harbour",
          lotNumber: 4,
          saleTitle: "Autumn",
          payment: { id: PAYMENT, status: "pending" },
        }
      : over.row;
  const view = over.view === undefined ? { paymentRole: "payer" } : over.view;
  const render = vi.fn(async (_document: BidInvoiceDocument) => Buffer.from("%PDF-test"));
  const findByPaymentIds = vi.fn(async () => {
    const invoice = over.invoice === undefined ? INVOICE : over.invoice;
    return new Map(invoice ? [[PAYMENT, invoice]] : []);
  });
  const read = vi.fn(async () => ({
    entries: [{ lotId: LOT, row, view, flags: {} }],
    winners: new Map(),
  }));
  const record = vi.fn();
  const refundedCents = vi.fn(async (_paymentId: string) => over.refundedCents ?? 0);
  const service = new PurchaseInvoicePdfService({
    candidates: { read: read as never },
    invoices: { findByPaymentIds },
    accounts: {
      findById: async () =>
        (over.account === undefined
          ? {
              id: "account-1",
              displayName: "Northbank Gallery",
              legalName: "Northbank Gallery Ltd",
            }
          : over.account) as never,
    },
    render,
    refunds: { sumRefundLineCentsForPayment: refundedCents },
    metrics: { record },
  });
  return { service, render, read, findByPaymentIds, record, refundedCents };
}

describe("PurchaseInvoicePdfService", () => {
  it("renders the stored invoice's own lines and total for a payer, never recomputed", async () => {
    const { service, render } = setup();
    const result = (await service.render(actor("finance"), LOT))._unsafeUnwrap();
    expect(result.filename).toBe("invoice-LAXB-10482.pdf");
    expect(result.pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(render).toHaveBeenCalledExactlyOnceWith({
      number: "LAXB-10482",
      raisedAt: INVOICE.raisedAt,
      dueAt: INVOICE.dueAt,
      billedTo: "Northbank Gallery Ltd",
      lot: { title: "Harbour", lotNumber: 4, saleTitle: "Autumn" },
      lines: INVOICE.lines,
      totalPence: 60_010,
      status: "awaiting_payment",
      refundedPence: 0,
    });
  });

  it("reads as paid once the payment is captured", async () => {
    const { service, render } = setup({
      row: {
        lotId: LOT,
        lotTitle: "Harbour",
        lotNumber: 4,
        saleTitle: null,
        payment: { id: PAYMENT, status: "captured" },
      },
    });
    await service.render(actor("owner"), LOT);
    expect(render.mock.calls[0]?.[0].status).toBe("paid");
  });

  it("bills the account by its display name when it has no legal name", async () => {
    const { service, render } = setup({
      account: { id: "account-1", displayName: "Northbank Gallery", legalName: null },
    });
    await service.render(actor("admin"), LOT);
    expect(render.mock.calls[0]?.[0].billedTo).toBe("Northbank Gallery");
  });

  it("is for payers only: a member who is told, or whose role does not follow purchases, gets nothing", async () => {
    for (const role of ["buyer_agent", "consignor", "viewer"] as const) {
      const { service, render, read } = setup();
      const error = (await service.render(actor(role), LOT))._unsafeUnwrapErr();
      expect(error.code).toBe("insufficient_entity_role");
      expect(error.status).toBe(403);
      expect(render).not.toHaveBeenCalled();
      expect(read).not.toHaveBeenCalled();
    }
  });

  it("does not confirm an invoice that is not the account's, is not theirs to pay, or is not raised", async () => {
    const cases: [string, Setup][] = [
      ["a lot of another account or none", { row: null, view: null }],
      ["a purchase the member does not pay", { view: { paymentRole: "informed" } }],
      [
        "a lot with no payment yet",
        { row: { lotId: LOT, lotTitle: "x", lotNumber: 1, saleTitle: null, payment: null } },
      ],
      ["a payment with no stored invoice", { invoice: null }],
      ["a voided invoice", { invoice: { ...INVOICE, voidedAt: new Date("2026-11-12T00:00:00Z") } }],
      ["an account that cannot be read", { account: null }],
    ];
    for (const [name, over] of cases) {
      const { service, render } = setup(over);
      const error = (await service.render(actor("finance"), LOT))._unsafeUnwrapErr();
      expect([name, error.code, error.status]).toEqual([name, "invoice_not_ready", 404]);
      expect(render).not.toHaveBeenCalled();
    }
  });

  it("reads the member's own purchases only when they follow just those", async () => {
    const { service, read } = setup();
    await service.render(actor("finance"), LOT);
    expect(read).toHaveBeenCalledWith(expect.objectContaining({ role: "finance" }), false, [LOT]);
  });

  it("reads as refunded once the payment was given back, never as awaiting payment", async () => {
    const { service, render } = setup({
      row: {
        lotId: LOT,
        lotTitle: "Harbour",
        lotNumber: 4,
        saleTitle: null,
        payment: { id: PAYMENT, status: "refunded" },
      },
    });
    await service.render(actor("owner"), LOT);
    expect(render.mock.calls[0]?.[0].status).toBe("refunded");
  });

  it("passes on what was refunded from the refund records, even on a payment still captured", async () => {
    const { service, render, refundedCents } = setup({
      row: {
        lotId: LOT,
        lotTitle: "Harbour",
        lotNumber: 4,
        saleTitle: null,
        payment: { id: PAYMENT, status: "captured" },
      },
      refundedCents: 15_000,
    });
    await service.render(actor("owner"), LOT);
    expect(refundedCents).toHaveBeenCalledWith(PAYMENT);
    expect(render.mock.calls[0]?.[0]).toMatchObject({ status: "paid", refundedPence: 15_000 });
  });

  it("does not look for refunds on an invoice that was never paid", async () => {
    const { service, render, refundedCents } = setup({ refundedCents: 15_000 });
    await service.render(actor("owner"), LOT);
    expect(refundedCents).not.toHaveBeenCalled();
    expect(render.mock.calls[0]?.[0].refundedPence).toBe(0);
  });

  it("refuses an invoice whose lines do not add up, clearly, and tells finance", async () => {
    const { service, render, record } = setup();
    render.mockRejectedValueOnce(new InvoiceTotalMismatchError(1, 60_010));
    const error = (await service.render(actor("finance"), LOT))._unsafeUnwrapErr();
    expect(error).toMatchObject({ code: "invoice_total_mismatch", status: 409 });
    expect(error.message).toContain("finance team has been told");
    expect(record).toHaveBeenCalledExactlyOnceWith(INVOICE_PDF_TOTAL_MISMATCH_EVENT);
  });

  it("does not hide other render failures", async () => {
    const { service, render, record } = setup();
    render.mockRejectedValueOnce(new Error("out of memory"));
    await expect(service.render(actor("finance"), LOT)).rejects.toThrow("out of memory");
    expect(record).not.toHaveBeenCalled();
  });
});

describe("invoiceFilename", () => {
  it("uses the invoice number, made safe for a header", () => {
    expect(invoiceFilename("LAXB-10482", LOT)).toBe("invoice-LAXB-10482.pdf");
    expect(invoiceFilename('LAX/B "1"\r\nX', LOT)).toBe("invoice-LAX-B-1-X.pdf");
  });

  it("falls back to the lot when there is no number yet", () => {
    expect(invoiceFilename(null, LOT)).toBe("invoice-lot-aaaaaaaa.pdf");
  });
});
