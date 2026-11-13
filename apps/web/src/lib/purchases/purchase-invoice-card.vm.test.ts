import type { PurchaseInvoiceCard } from "@auction/types";
import { describe, expect, it } from "vitest";
import { purchaseDocumentHref, purchaseInvoiceCard } from "./purchase-invoice-card.vm";

const LOT = "5c1d2e3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f";
const DOC = "dddddddd-0000-4000-8000-000000000001";
const CREDIT = "dddddddd-0000-4000-8000-000000000002";
const NOW = new Date("2026-11-13T10:00:00Z");
const LAX_PDF = `/purchases/${LOT}/invoice`;

const base: PurchaseInvoiceCard = {
  state: "preparing",
  invoiceNumber: null,
  issuedAt: null,
  invoiceDocumentId: null,
  cancelledAt: null,
  totalPence: 150_000,
  creditNotes: [],
};

const vm = (card: Partial<PurchaseInvoiceCard> | null) =>
  purchaseInvoiceCard({
    lotId: LOT,
    card: card === null ? null : { ...base, ...card },
    laxInvoiceHref: LAX_PDF,
    now: NOW,
  });

describe("purchaseInvoiceCard", () => {
  it("is being prepared: the buyer can pay now, and there is no PDF yet", () => {
    expect(vm({ state: "preparing" })).toEqual({
      kind: "preparing",
      title: "Invoice being prepared",
      detail: "You can pay now. We'll email your invoice as soon as it's ready.",
      note: "PDF available once issued",
      tone: "neutral",
    });
  });

  it("says when it is taking longer, that the team knows, and that paying is not affected", () => {
    expect(vm({ state: "delayed" })).toMatchObject({
      kind: "delayed",
      title: "Invoice being prepared",
      detail:
        "This is taking longer than usual. Our team has been told. Your payment is not affected.",
      note: "PDF available once issued",
      tone: "warning",
    });
  });

  it("names the Books invoice, when it was issued, and downloads LAX's stored copy", () => {
    expect(
      vm({
        state: "issued",
        invoiceNumber: "INV-000123",
        issuedAt: "2026-11-12T14:05:00.000Z",
        invoiceDocumentId: DOC,
      }),
    ).toEqual({
      kind: "issued",
      title: "Invoice INV-000123",
      meta: "Issued Thu 12 Nov, 14:05 GMT",
      download: { label: "Download invoice (PDF)", href: `/purchases/${LOT}/documents/${DOC}` },
      credits: [],
    });
  });

  it("lists a part refund with its credit note, only when there is one", () => {
    const card = vm({
      state: "issued",
      invoiceNumber: "INV-000123",
      issuedAt: "2026-11-12T14:05:00.000Z",
      invoiceDocumentId: DOC,
      creditNotes: [{ documentId: CREDIT, number: "CN-000007", amountPence: 25_000 }],
    });
    expect(card.kind === "issued" && card.credits).toEqual([
      {
        label: "Refunded −£250.00",
        link: {
          label: "Download credit note CN-000007 (PDF)",
          href: purchaseDocumentHref(LOT, CREDIT),
        },
      },
    ]);
  });

  it("says when it was cancelled and that nothing is owed", () => {
    expect(vm({ state: "cancelled", cancelledAt: "2026-11-12T16:30:00.000Z" })).toEqual({
      kind: "cancelled",
      title: "Invoice cancelled",
      detail: "This invoice was cancelled on Thu 12 Nov, 16:30 GMT. You owe nothing on it.",
    });
  });

  it("keeps LAX's own invoice when Books does not issue it, or its card cannot be read", () => {
    const lax = {
      kind: "lax",
      download: { label: "Invoice", href: LAX_PDF },
      empty: "The invoice appears here once it is raised.",
    };
    expect(vm({ state: "lax" })).toEqual(lax);
    expect(vm(null)).toEqual(lax);
    // Never a Books number without the stored copy behind it.
    expect(vm({ state: "issued", invoiceNumber: "INV-000123" })).toEqual(lax);
  });

  it("uses British Summer Time in summer", () => {
    const card = vm({
      state: "issued",
      invoiceNumber: "INV-000124",
      issuedAt: "2026-07-02T13:05:00.000Z",
      invoiceDocumentId: DOC,
    });
    expect(card.kind === "issued" && card.meta).toBe("Issued Thu 2 Jul, 14:05 BST");
  });
});
