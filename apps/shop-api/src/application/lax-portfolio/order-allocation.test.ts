import { describe, expect, it } from "vitest";
import { type OrderToAllocate, allocateOrder } from "./order-allocation.js";

const line = (id: string, pricePence: number, held = true) => ({ id, pricePence, held });
const order = (patch: Partial<OrderToAllocate>): OrderToAllocate => ({
  totalPence: null,
  shippingPence: 0,
  lines: [],
  refunds: [],
  ...patch,
});
const sum = (
  key: "pricePence" | "shippingPence" | "refundedPence",
  shares: { [k: string]: unknown }[],
) => shares.reduce((total, share) => total + (share[key] as number), 0);

describe("allocateOrder", () => {
  it("allocates nothing for an order without lines", () => {
    expect(allocateOrder(order({ totalPence: 100 }))).toEqual([]);
  });

  it("charges delivery on the first held line, never on a released one", () => {
    const shares = allocateOrder(
      order({ shippingPence: 2_500, lines: [line("a", 100, false), line("b", 200)] }),
    );
    expect(shares.map((share) => share.shippingPence)).toEqual([0, 2_500]);
  });

  it("falls back to the first line when none is held", () => {
    const shares = allocateOrder(
      order({ shippingPence: 500, lines: [line("a", 100, false), line("b", 200, false)] }),
    );
    expect(shares.map((share) => share.shippingPence)).toEqual([500, 0]);
  });

  it("gives the carrier what the lines do not cover, so shares add up to the total", () => {
    const shares = allocateOrder(
      order({
        totalPence: 10_000,
        shippingPence: 1_000,
        lines: [line("a", 6_000), line("b", 1_000)],
      }),
    );
    expect(shares.map((share) => share.pricePence)).toEqual([8_000, 1_000]);
    expect(sum("pricePence", shares) + sum("shippingPence", shares)).toBe(10_000);
  });

  it("never lets delivery exceed what the lines leave of the total", () => {
    const shares = allocateOrder(
      order({ totalPence: 1_000, shippingPence: 5_000, lines: [line("a", 900)] }),
    );
    expect(shares[0]).toMatchObject({ pricePence: 900, shippingPence: 100 });
  });

  it("takes a refund off the line it was made against", () => {
    const shares = allocateOrder(
      order({
        lines: [line("a", 100), line("b", 200)],
        refunds: [{ lineId: "b", amountPence: 150 }],
      }),
    );
    expect(shares.map((share) => share.refundedPence)).toEqual([0, 150]);
  });

  it("carries a line refund's excess to the order, released works first", () => {
    const shares = allocateOrder(
      order({
        lines: [line("held", 100), line("gone", 100, false), line("other", 100)],
        refunds: [{ lineId: "other", amountPence: 130 }],
      }),
    );
    expect(shares.map((share) => share.refundedPence)).toEqual([0, 30, 100]);
  });

  it("spreads a whole-order refund over released works, then held ones in order", () => {
    const shares = allocateOrder(
      order({
        shippingPence: 50,
        totalPence: 350,
        lines: [line("a", 100), line("b", 100, false), line("c", 100)],
        refunds: [{ lineId: null, amountPence: 220 }],
      }),
    );
    expect(shares.map((share) => share.refundedPence)).toEqual([120, 100, 0]);
  });

  it("never refunds a line more than it was charged", () => {
    const shares = allocateOrder(
      order({ lines: [line("a", 100)], refunds: [{ lineId: null, amountPence: 900 }] }),
    );
    expect(shares[0]?.refundedPence).toBe(100);
  });
});
