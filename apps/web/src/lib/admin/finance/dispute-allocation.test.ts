import type { DisputeDeskInvoice } from "@auction/types";
import { describe, expect, it } from "vitest";
import {
  allocationEffects,
  allocationLines,
  checkAllocation,
  splitInProportion,
} from "./dispute-allocation";

const invoice = (
  paymentId: string,
  invoicePence: number,
  platformFeePence = 0,
  sellerId = "s1",
): DisputeDeskInvoice => ({
  paymentId,
  reference: paymentId.toUpperCase(),
  lotId: `lot-${paymentId}`,
  lotTitle: `Lot ${paymentId}`,
  sellerId,
  sellerName: `Seller ${sellerId}`,
  invoicePence,
  platformFeePence,
  paymentStatus: "captured",
});

describe("splitInProportion", () => {
  it("shares a dispute equal to the charge in full", () => {
    const invoices = [invoice("a", 860_000), invoice("b", 320_000), invoice("c", 240_000)];
    expect(splitInProportion(invoices, 1_420_000)).toEqual({ a: 860_000, b: 320_000, c: 240_000 });
  });

  it("gives the rounding pence to the largest invoices so the shares add up", () => {
    const invoices = [invoice("a", 100), invoice("b", 100), invoice("c", 100)];
    const shares = splitInProportion(invoices, 100);
    expect(Object.values(shares).reduce((a, b) => a + b, 0)).toBe(100);
    expect(Object.values(shares).sort()).toEqual([33, 33, 34]);
  });

  it("never gives an invoice more than it is worth", () => {
    const invoices = [invoice("a", 1_000), invoice("b", 9_000)];
    const shares = splitInProportion(invoices, 10_000);
    expect(shares).toEqual({ a: 1_000, b: 9_000 });
  });

  it("is all zero when there is nothing to split", () => {
    expect(splitInProportion([invoice("a", 100)], 0)).toEqual({ a: 0 });
    expect(splitInProportion([], 500)).toEqual({});
  });
});

describe("checkAllocation", () => {
  const invoices = [invoice("a", 8_600), invoice("b", 3_200)];

  it("is valid when the shares add up to the dispute", () => {
    const check = checkAllocation(invoices, { a: 8_600, b: 2_700 }, 11_300);
    expect(check).toMatchObject({ allocatedPence: 11_300, remainingPence: 0, valid: true });
  });

  it("reports what is left to allocate", () => {
    const check = checkAllocation(invoices, { a: 8_600, b: 2_700 }, 11_800);
    expect(check).toMatchObject({ remainingPence: 500, valid: false });
  });

  it("reports an over-allocation as negative", () => {
    expect(checkAllocation(invoices, { a: 8_600, b: 3_200 }, 11_000).remainingPence).toBe(-800);
  });

  it("flags a share larger than its invoice", () => {
    const check = checkAllocation(invoices, { a: 9_000, b: 0 }, 9_000);
    expect(check.rowProblems).toEqual({ a: "exceeds_invoice" });
    expect(check.valid).toBe(false);
  });

  it("is not valid with nothing allocated", () => {
    expect(checkAllocation(invoices, {}, 0).valid).toBe(false);
  });
});

describe("allocationLines", () => {
  it("sends only the invoices that carry something", () => {
    const invoices = [invoice("a", 100), invoice("b", 100)];
    expect(allocationLines(invoices, { a: 0, b: 80 })).toEqual([
      { paymentId: "b", amountPence: 80 },
    ]);
  });
});

describe("allocationEffects", () => {
  it("charges each seller their net share and leaves the fee to the house", () => {
    const invoices = [
      invoice("a", 860_000, 86_000, "s1"),
      invoice("b", 320_000, 32_000, "s1"),
      invoice("c", 240_000, 24_000, "s2"),
    ];
    const effects = allocationEffects(invoices, { a: 860_000, b: 320_000, c: 240_000 });
    expect(effects.sellers).toEqual([
      { sellerId: "s1", sellerName: "Seller s1", sellerSharePence: 774_000 + 288_000 },
      { sellerId: "s2", sellerName: "Seller s2", sellerSharePence: 216_000 },
    ]);
    expect(effects.houseSharePence).toBe(142_000);
  });

  it("ignores invoices that carry nothing", () => {
    const effects = allocationEffects([invoice("a", 1_000, 100)], { a: 0 });
    expect(effects).toEqual({ sellers: [], houseSharePence: 0 });
  });
});
