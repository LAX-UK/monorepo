import { describe, expect, it } from "vitest";
import {
  computeLineVat,
  deliveryVatPence,
  orderVatBreakdown,
  vatIncludedIn,
} from "./vat-policy.js";

describe("computeLineVat", () => {
  it("takes the VAT out of the VAT-inclusive price", () => {
    const result = computeLineVat(
      { standardRateBp: 2000 },
      { unitPricePence: 12_000, quantity: 1 },
    );
    expect(result).toEqual({
      ok: true,
      vatTreatment: "standard",
      vatRateBp: 2000,
      vatPence: 2000,
    });
  });

  it("covers every unit on the line", () => {
    const result = computeLineVat({ standardRateBp: 2000 }, { unitPricePence: 6000, quantity: 2 });
    expect(result).toMatchObject({ ok: true, vatPence: 2000 });
  });

  it("returns not configured when policy is missing", () => {
    expect(computeLineVat(null, { unitPricePence: 100 })).toEqual({
      ok: false,
      reason: "policy_not_configured",
    });
  });
});

describe("vatIncludedIn", () => {
  it("rounds to the nearest penny", () => {
    expect(vatIncludedIn(8500, 2000)).toBe(1417);
    expect(vatIncludedIn(0, 2000)).toBe(0);
    expect(vatIncludedIn(8500, 0)).toBe(0);
  });
});

describe("deliveryVatPence", () => {
  it("charges delivery at the goods' single rate", () => {
    expect(deliveryVatPence({ lineRatesBp: [2000, 2000], deliveryPence: 1500 })).toBe(250);
  });

  it("is unknown with mixed or missing rates", () => {
    expect(deliveryVatPence({ lineRatesBp: [2000, 500], deliveryPence: 1500 })).toBeNull();
    expect(deliveryVatPence({ lineRatesBp: [null], deliveryPence: 1500 })).toBeNull();
    expect(deliveryVatPence({ lineRatesBp: [], deliveryPence: 1500 })).toBeNull();
  });
});

describe("orderVatBreakdown", () => {
  it("adds the stored VAT of the lines and the delivery charge", () => {
    expect(
      orderVatBreakdown({
        lines: [{ vatPence: 2000, vatRateBp: 2000 }],
        deliveryVatPence: 250,
        totalPence: 13_500,
      }),
    ).toEqual({
      rateBp: 2000,
      goodsVatPence: 2000,
      deliveryVatPence: 250,
      vatPence: 2250,
      netPence: 11_250,
    });
  });

  it("names no single rate when the lines were charged at different rates", () => {
    const breakdown = orderVatBreakdown({
      lines: [
        { vatPence: 2000, vatRateBp: 2000 },
        { vatPence: 500, vatRateBp: 500 },
      ],
      deliveryVatPence: 0,
      totalPence: 22_500,
    });
    expect(breakdown).toMatchObject({ rateBp: null, goodsVatPence: 2500, vatPence: 2500 });
  });

  it("has no figure when a line or the delivery has no stored VAT", () => {
    expect(
      orderVatBreakdown({
        lines: [
          { vatPence: 2000, vatRateBp: 2000 },
          { vatPence: null, vatRateBp: null },
        ],
        deliveryVatPence: 0,
        totalPence: 21_500,
      }),
    ).toBeNull();
    expect(
      orderVatBreakdown({
        lines: [{ vatPence: 2000, vatRateBp: 2000 }],
        deliveryVatPence: null,
        totalPence: 13_500,
      }),
    ).toBeNull();
    expect(orderVatBreakdown({ lines: [], deliveryVatPence: 0, totalPence: 1500 })).toBeNull();
  });
});
