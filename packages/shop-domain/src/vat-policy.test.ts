import { describe, expect, it } from "vitest";
import { computeLineVat, orderVatBreakdown, vatIncludedIn } from "./vat-policy.js";

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

describe("orderVatBreakdown", () => {
  it("adds the delivery charge at the goods' rate", () => {
    expect(
      orderVatBreakdown({
        lines: [{ grossPence: 12_000, vatRateBp: 2000 }],
        deliveryPence: 1500,
      }),
    ).toEqual({
      rateBp: 2000,
      goodsVatPence: 2000,
      deliveryVatPence: 250,
      vatPence: 2250,
      netPence: 11_250,
    });
  });

  it("leaves delivery without VAT when the lines were charged at different rates", () => {
    const breakdown = orderVatBreakdown({
      lines: [
        { grossPence: 12_000, vatRateBp: 2000 },
        { grossPence: 10_500, vatRateBp: 500 },
      ],
      deliveryPence: 1500,
    });
    expect(breakdown).toMatchObject({ rateBp: null, goodsVatPence: 2500, deliveryVatPence: 0 });
  });

  it("has no figure when a line was sold without a VAT rate", () => {
    expect(
      orderVatBreakdown({
        lines: [
          { grossPence: 12_000, vatRateBp: 2000 },
          { grossPence: 9500, vatRateBp: null },
        ],
        deliveryPence: 0,
      }),
    ).toBeNull();
    expect(orderVatBreakdown({ lines: [], deliveryPence: 1500 })).toBeNull();
  });
});
