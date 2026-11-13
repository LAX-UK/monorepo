import type { BidInvoiceEmailFacts } from "@auction/persistence/interfaces";
import { describe, expect, it } from "vitest";
import { composeBidInvoiceEmail, invoicePdfFilename } from "./bid-invoice-email.js";

const facts: BidInvoiceEmailFacts = {
  invoiceId: "0b6a4f8e-3c41-4c55-9d7e-1f0e2a3b4c5d",
  lotId: "5c1d2e3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f",
  lotTitle: "Lot 12 · Harbour at dusk",
  totalPence: 154_320,
  paidAt: null,
  dueAt: new Date("2026-11-26T23:59:59Z"),
  cancelled: false,
  payer: { userId: "user-1", email: "maya@example.test", name: "Maya" },
  billingEmail: null,
  buyerLegalEntityId: "9f1c2d3e-4a5b-4c6d-8e7f-9a0b1c2d3e4f",
};
const now = new Date("2026-11-12T15:00:00Z");

function compose(over: Partial<BidInvoiceEmailFacts> = {}) {
  return composeBidInvoiceEmail({
    number: "INV-000123",
    facts: { ...facts, ...over },
    storageKey: "accounting/london_auction_xchange/doc-1.pdf",
    purchaseUrl: "https://lax.bid/purchases/x",
    userName: "Maya",
    now,
  });
}

describe("composeBidInvoiceEmail", () => {
  it("states the stored total and the due date in the shared style while it is owed", () => {
    const vars = compose();
    expect(vars.invoiceNumber).toBe("INV-000123");
    expect(vars.lotTitle).toBe("Lot 12 · Harbour at dusk");
    expect(vars.total).toBe("£1,543.20");
    expect(vars.settlement).toEqual({ kind: "due", by: "Thu 26 Nov, 23:59 GMT" });
  });

  it("says when it was paid once it is", () => {
    const vars = compose({ paidAt: new Date("2026-11-12T14:05:00Z") });
    expect(vars.settlement).toEqual({ kind: "paid", on: "Thu 12 Nov, 14:05 GMT" });
  });

  it("attaches the stored copy by key under a header-safe name", () => {
    expect(compose().storedAttachment).toEqual({
      storageKey: "accounting/london_auction_xchange/doc-1.pdf",
      filename: "invoice-INV-000123.pdf",
      contentType: "application/pdf",
    });
    expect(invoicePdfFilename('INV/12 "x"')).toBe("invoice-INV-12-x.pdf");
    expect(invoicePdfFilename("///")).toBe("invoice-invoice.pdf");
  });
});
