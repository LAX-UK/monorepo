import { describe, expect, it } from "vitest";
import { renderEmail } from "./render.js";

describe("payment-receipt", () => {
  it("lists each invoice, the total and how it was paid when one payment settled several", async () => {
    const { html, text } = await renderEmail("payment-receipt", {
      userName: "Maya",
      lotTitle: "3 invoices",
      amount: "£3,600.00",
      receiptUrl: "https://lax.bid/purchases",
      paymentMethod: "Bank transfer",
      lines: [
        { title: "Lot 12 · Harbour at dusk", amount: "£1,200.00" },
        { title: "Lot 14 · Study in blue", amount: "£1,400.00" },
        { title: "Lot 19 · Still life", amount: "£1,000.00" },
      ],
    });
    expect(text).toContain("We received your payment of £3,600.00 for 3 invoices.");
    for (const part of ["Lot 14 · Study in blue", "£1,400.00", "Total", "Bank transfer"]) {
      expect(html).toContain(part);
    }
    expect(html).toContain("View your purchases");
  });

  it("keeps the one-invoice receipt as it was", async () => {
    const { text } = await renderEmail("payment-receipt", {
      userName: "Maya",
      lotTitle: "Harbour at dusk",
      amount: "£1,200.00",
      receiptUrl: "https://lax.bid/purchases",
    });
    expect(text).toContain("We received your payment of £1,200.00 for Harbour at dusk.");
    expect(text).not.toContain("Paid by");
  });
});
