import { invoiceDueAt } from "@auction/domain";
import { describe, expect, it } from "vitest";
import { penceToPounds, priceSeedInvoice, totalOnlySeedInvoice } from "./seed-invoice.js";

const raisedAt = new Date("2026-11-02T10:00:00Z");

describe("seed invoices", () => {
  it("prices a hammer through the application calculator: hammer and premium lines", () => {
    const invoice = priceSeedInvoice({
      paymentId: "p1",
      hammerPounds: 1_500,
      rate: 0.25,
      raisedAt,
    });
    expect(invoice.lines.map((l) => [l.kind, l.amountPence])).toEqual([
      ["hammer", 150_000],
      ["buyers_premium", 37_500],
    ]);
    expect(invoice.totalPence).toBe(187_500);
    expect(invoice.dueAt.getTime()).toBe(invoiceDueAt(raisedAt).getTime());
    expect(invoice.source).toBe("raised");
  });

  it("gives the same invoice id to the same payment on every run", () => {
    const a = priceSeedInvoice({ paymentId: "p1", hammerPounds: 10, rate: 0.25, raisedAt });
    const b = priceSeedInvoice({ paymentId: "p1", hammerPounds: 10, rate: 0.25, raisedAt });
    const c = priceSeedInvoice({ paymentId: "p2", hammerPounds: 10, rate: 0.25, raisedAt });
    expect(a.id).toBe(b.id);
    expect(a.id).not.toBe(c.id);
  });

  it("keeps a fixture amount as one flagged total line", () => {
    const invoice = totalOnlySeedInvoice({ paymentId: "p3", amountPounds: "143750.00", raisedAt });
    expect(invoice.lines).toEqual([
      { kind: "legacy_total", label: "Total", ratePercent: null, amountPence: 14_375_000 },
    ]);
    expect(invoice.totalPence).toBe(14_375_000);
    expect(invoice.source).toBe("legacy_backfill");
  });

  it("writes whole pence as a pounds string without floating point", () => {
    expect(penceToPounds(187_500)).toBe("1875.00");
    expect(penceToPounds(5)).toBe("0.05");
    expect(penceToPounds(1_000_001)).toBe("10000.01");
  });
});
