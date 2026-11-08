import { describe, expect, it } from "vitest";
import {
  type BidInvoiceDocument,
  InvoiceTotalMismatchError,
  bidInvoiceView,
  invoiceMoney,
  renderBidInvoicePdf,
} from "./bid-invoice.pdf.js";

const base: BidInvoiceDocument = {
  number: "LAXB-10482",
  raisedAt: new Date("2026-10-30T10:00:00Z"),
  dueAt: new Date("2026-11-13T23:59:59Z"),
  billedTo: "Northbank Gallery",
  lot: { title: "Coastal Notation", lotNumber: 12, saleTitle: "Autumn Works on Paper" },
  lines: [
    { label: "Hammer price", ratePercent: null, amountPence: 190_000 },
    { label: "Buyer's premium (25%)", ratePercent: "25", amountPence: 47_500 },
  ],
  totalPence: 237_500,
  status: "awaiting_payment",
};

describe("bidInvoiceView", () => {
  it("names London Auction Xchange LTD and its address, and no numbers that are not confirmed", () => {
    const { issuer, footer } = bidInvoiceView(base);
    expect(issuer.name).toBe("London Auction Xchange LTD");
    expect(issuer.address).toContain("156 New Cavendish Street");
    expect(issuer.registration).toEqual([]);
    expect(footer[0]).toBe(
      "Invoice from London Auction Xchange LTD, 156 New Cavendish Street, Marylebone, London W1W 6YW, United Kingdom",
    );
  });

  it("never names the Art company", () => {
    expect(JSON.stringify(bidInvoiceView(base))).not.toContain("London Art Exchange");
  });

  it("prints the invoice's own lines in its own order, and the stored total", () => {
    const view = bidInvoiceView(base);
    expect(view.lines).toEqual([
      ["Hammer price", "£1,900.00"],
      ["Buyer's premium (25%)", "£475.00"],
    ]);
    expect(view.total).toEqual(["Total to pay", "£2,375.00"]);
  });

  it("says who it is billed to, the work and lot, and the dates in the London day", () => {
    const { facts, title } = bidInvoiceView(base);
    expect(title).toBe("Invoice LAXB-10482");
    expect(facts).toEqual([
      ["Billed to", "Northbank Gallery"],
      ["Work", "Coastal Notation"],
      ["Lot", "Lot 12 · Autumn Works on Paper"],
      ["Raised", "Fri 30 Oct 2026"],
      ["Due by", "Fri 13 Nov 2026"],
      ["Status", "Awaiting payment"],
    ]);
  });

  it("reads as paid once paid", () => {
    const view = bidInvoiceView({ ...base, status: "paid" });
    expect(view.total[0]).toBe("Total paid");
    expect(view.facts).toContainEqual(["Status", "Paid"]);
    expect(view.facts).toContainEqual(["Was due", "Fri 13 Nov 2026"]);
  });

  it("reads as refunded once the payment was given back, never as awaiting payment", () => {
    const view = bidInvoiceView({ ...base, status: "refunded" });
    expect(view.total).toEqual(["Total refunded", "£2,375.00"]);
    expect(view.facts).toContainEqual(["Status", "Refunded"]);
    expect(view.facts).toContainEqual(["Was due", "Fri 13 Nov 2026"]);
    expect(JSON.stringify(view)).not.toContain("Awaiting payment");
  });

  it("has no number in the title until one is assigned, and no lot line without a lot", () => {
    const view = bidInvoiceView({
      ...base,
      number: null,
      lot: { title: "Coastal Notation", lotNumber: null, saleTitle: null },
    });
    expect(view.title).toBe("Invoice");
    expect(view.facts.map(([label]) => label)).not.toContain("Lot");
  });

  it("will not show lines that do not add up to the total, to the penny", () => {
    expect(() => bidInvoiceView({ ...base, totalPence: 237_501 })).toThrow(
      InvoiceTotalMismatchError,
    );
    expect(() => bidInvoiceView({ ...base, lines: base.lines.slice(0, 1) })).toThrow(
      InvoiceTotalMismatchError,
    );
  });

  it("is exact at the edges of the tier bands", () => {
    const view = bidInvoiceView({
      ...base,
      lines: [
        { label: "Hammer price", ratePercent: null, amountPence: 49_999_999 },
        { label: "Buyer's premium", ratePercent: "25", amountPence: 12_500_000 },
      ],
      totalPence: 62_499_999,
    });
    expect(view.total[1]).toBe("£624,999.99");
  });
});

describe("invoiceMoney", () => {
  it("writes whole pence as pounds", () => {
    expect(invoiceMoney(5)).toBe("£0.05");
    expect(invoiceMoney(100_000_001)).toBe("£1,000,000.01");
  });
});

describe("renderBidInvoicePdf", () => {
  it("renders a PDF", async () => {
    const pdf = await renderBidInvoicePdf(base);
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(1000);
  });

  it("renders a paid invoice with a long title", async () => {
    const pdf = await renderBidInvoicePdf({
      ...base,
      status: "paid",
      lot: { title: "A very long title ".repeat(12), lotNumber: 1, saleTitle: null },
    });
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
  });

  it("embeds a Unicode font so names in Greek and Cyrillic print", async () => {
    const pdf = await renderBidInvoicePdf({
      ...base,
      billedTo: "Галерея «Северный берег»",
      lot: { title: "Παράκτιος συμβολισμός", lotNumber: 3, saleTitle: "Škoda Ærø Łódź" },
    });
    const text = pdf.toString("latin1");
    expect(text).toContain("NotoSans");
    expect(text).not.toContain("Helvetica");
  });

  it("renders a refunded invoice", async () => {
    const pdf = await renderBidInvoicePdf({ ...base, status: "refunded" });
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
  });

  it("refuses to render lines that do not add up", async () => {
    await expect(renderBidInvoicePdf({ ...base, totalPence: 1 })).rejects.toBeInstanceOf(
      InvoiceTotalMismatchError,
    );
  });
});
