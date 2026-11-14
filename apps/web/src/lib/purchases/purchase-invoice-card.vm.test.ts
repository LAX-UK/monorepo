import type { PurchaseInvoiceCard } from "@auction/types";
import { describe, expect, it } from "vitest";
import { purchaseInvoiceCard, refundedInFull, withBooksRefund } from "./purchase-invoice-card.vm";
import type { PurchaseCardVm } from "./purchases.vm";

const LOT = "5c1d2e3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f";
const DOC = "dddddddd-0000-4000-8000-000000000001";
const NOW = new Date("2026-11-13T10:00:00Z");
const LAX_PDF = `/purchases/${LOT}/invoice`;

const base: PurchaseInvoiceCard = {
  state: "preparing",
  invoiceNumber: null,
  issuedAt: null,
  invoiceDocumentId: null,
  cancelledAt: null,
  totalPence: 150_000,
  cancelledAfterDefault: false,
  creditNotes: [],
  paidWith: null,
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

  it("says the day it was cancelled (no time) and that nothing is owed", () => {
    expect(vm({ state: "cancelled", cancelledAt: "2026-11-16T16:30:00.000Z" })).toEqual({
      kind: "cancelled",
      title: "Invoice cancelled",
      detail: "This invoice was cancelled on Mon 16 Nov. You owe nothing on it.",
      credits: [],
    });
    // The day is London's: 23:30 GMT on the 15th in summer time is already the 16th.
    const lateInSummer = vm({ state: "cancelled", cancelledAt: "2026-07-15T23:30:00.000Z" });
    expect(lateInSummer.kind === "cancelled" && lateInSummer.detail).toBe(
      "This invoice was cancelled on Thu 16 Jul. You owe nothing on it.",
    );
    // A cancellation in another year names it.
    const lastYear = vm({ state: "cancelled", cancelledAt: "2025-12-30T10:00:00.000Z" });
    expect(lastYear.kind === "cancelled" && lastYear.detail).toBe(
      "This invoice was cancelled on Tue 30 Dec 2025. You owe nothing on it.",
    );
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

describe("purchaseInvoiceCard: credit notes", () => {
  const CN = "c0c0c0c0-0000-4000-8000-000000000001";
  const issued = {
    state: "issued" as const,
    invoiceNumber: "INV-000123",
    issuedAt: "2026-11-12T14:05:00.000Z",
    invoiceDocumentId: DOC,
  };

  it("lists each refund: 'Refunded −£[amount]' and 'Download credit note [number] (PDF)'", () => {
    const out = vm({
      ...issued,
      creditNotes: [
        { documentId: CN, number: "CN-00001", grossPence: 12_345, issuedAt: null, kind: "refund" },
      ],
    });
    expect(out).toMatchObject({
      kind: "issued",
      credits: [
        {
          text: "Refunded \u2212£123.45",
          download: {
            label: "Download credit note CN-00001 (PDF)",
            href: `/purchases/${LOT}/documents/${CN}`,
          },
        },
      ],
    });
  });

  it("says 'Cancelled after a default' with its credit note once issued", () => {
    const out = vm({
      state: "cancelled",
      cancelledAt: "2026-11-30T10:00:00.000Z",
      cancelledAfterDefault: true,
      creditNotes: [
        {
          documentId: CN,
          number: "CN-00009",
          grossPence: 150_000,
          issuedAt: null,
          kind: "default",
        },
      ],
    });
    expect(out).toMatchObject({
      kind: "cancelled",
      title: "Cancelled after a default",
      // The number is the title; the link only says what it does.
      credits: [{ text: "Credit note CN-00009", download: { label: "Download (PDF)" } }],
    });
    expect(vm({ state: "cancelled", cancelledAt: null })).toMatchObject({
      title: "Invoice cancelled",
      credits: [],
    });
  });

  it("says where a refund went, by how the invoice was paid", () => {
    const refund = {
      documentId: CN,
      number: "CN-00001",
      grossPence: 12_345,
      issuedAt: null,
      kind: "refund" as const,
    };
    const text = (paidWith: PurchaseInvoiceCard["paidWith"]) => {
      const out = vm({ ...issued, paidWith, creditNotes: [refund] });
      return out.kind === "issued" ? out.credits[0]?.text : null;
    };
    expect(text("card")).toBe("Refunded \u2212£123.45 to your card");
    expect(text("bank_transfer")).toBe("Refunded \u2212£123.45 to your bank account");
    expect(text(null)).toBe("Refunded \u2212£123.45");
  });
});

describe("refunded in full (Books' credit notes)", () => {
  const refund = (grossPence: number, n: number) => ({
    documentId: `dddddddd-0000-4000-8000-00000000010${n}`,
    number: `CN-0000${n}`,
    grossPence,
    issuedAt: null,
    kind: "refund" as const,
  });
  const issued = {
    state: "issued" as const,
    invoiceNumber: "INV-000123",
    issuedAt: "2026-11-12T14:05:00.000Z",
    invoiceDocumentId: DOC,
  };
  const paid = {
    state: "delivered",
    badge: { label: "Delivered", tone: "success", shape: "dot" },
    statusLabel: "Delivered",
    statusNote: "Delivered by insured courier",
    amountLabel: "total paid",
    amount: "£1,500.00",
  } as unknown as PurchaseCardVm;

  it("reads 'Refunded', never 'Paid / Total paid', once the refunds credit the whole invoice", () => {
    const books = { ...base, ...issued, creditNotes: [refund(100_000, 1), refund(50_000, 2)] };
    expect(refundedInFull(books)).toBe(true);
    expect(withBooksRefund(paid, books)).toMatchObject({
      badge: { label: "Refunded", tone: "neutral", shape: "ring" },
      statusLabel: "Refunded",
      amountLabel: "refunded",
      amount: "£1,500.00",
    });
  });

  it("a part refund, a default's credit note or no Books card leave the purchase as it is", () => {
    const part = { ...base, ...issued, creditNotes: [refund(100_000, 1)] };
    expect(withBooksRefund(paid, part)).toBe(paid);
    const defaulted = {
      ...base,
      ...issued,
      creditNotes: [{ ...refund(150_000, 1), kind: "default" as const }],
    };
    expect(withBooksRefund(paid, defaulted)).toBe(paid);
    expect(withBooksRefund(paid, null)).toBe(paid);
  });
});
