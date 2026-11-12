import { describe, expect, it } from "vitest";
import { type PaidBuckets, planRefund, refundableOf, splitRefundTotal } from "./refund.js";
import { forAll, int } from "./testing/generate.js";

const buckets = (over: Partial<PaidBuckets> = {}): PaidBuckets => ({
  paidGoodsPence: 10_000,
  paidDeliveryPence: 1_500,
  refundedGoodsPence: 0,
  refundedDeliveryPence: 0,
  ...over,
});

describe("planRefund", () => {
  it("accepts an explicit split within each bucket", () => {
    expect(planRefund(buckets(), { goodsPence: 10_000, deliveryPence: 1_500 })).toEqual({
      ok: true,
      value: { goodsPence: 10_000, deliveryPence: 1_500 },
    });
  });
  it("counts earlier refunds against what can still go back", () => {
    const b = buckets({ refundedGoodsPence: 9_000 });
    expect(planRefund(b, { goodsPence: 1_001, deliveryPence: 0 })).toMatchObject({
      ok: false,
      refusal: { code: "exceeds_paid_goods" },
    });
    expect(planRefund(b, { goodsPence: 1_000, deliveryPence: 0 }).ok).toBe(true);
  });
  it("refuses delivery over what was paid for delivery, even if goods have room", () => {
    expect(planRefund(buckets(), { goodsPence: 0, deliveryPence: 1_501 })).toMatchObject({
      refusal: { code: "exceeds_paid_delivery" },
    });
  });
  it("refuses fractional or negative amounts", () => {
    expect(planRefund(buckets(), { goodsPence: -1, deliveryPence: 0 }).ok).toBe(false);
    expect(planRefund(buckets(), { goodsPence: 0.5, deliveryPence: 0 }).ok).toBe(false);
    expect(
      planRefund(buckets({ paidGoodsPence: -1 }), { goodsPence: 0, deliveryPence: 0 }).ok,
    ).toBe(false);
  });
});

describe("splitRefundTotal", () => {
  it("refunds goods first, then delivery", () => {
    expect(splitRefundTotal(buckets(), 10_500)).toEqual({
      ok: true,
      value: { goodsPence: 10_000, deliveryPence: 500 },
    });
    expect(splitRefundTotal(buckets(), 400)).toEqual({
      ok: true,
      value: { goodsPence: 400, deliveryPence: 0 },
    });
  });
  it("refuses more than is left", () => {
    expect(splitRefundTotal(buckets(), 11_501)).toMatchObject({
      refusal: { code: "exceeds_paid" },
    });
    expect(splitRefundTotal(buckets(), -1).ok).toBe(false);
  });
  it("property: split sums to the request and never exceeds what was paid", () => {
    forAll(500, (rng) => {
      const b: PaidBuckets = {
        paidGoodsPence: int(rng, 0, 100_000),
        paidDeliveryPence: int(rng, 0, 5_000),
        refundedGoodsPence: 0,
        refundedDeliveryPence: 0,
      };
      const b2 = {
        ...b,
        refundedGoodsPence: int(rng, 0, b.paidGoodsPence),
        refundedDeliveryPence: int(rng, 0, b.paidDeliveryPence),
      };
      const left = refundableOf(b2);
      const total = int(rng, 0, left.goodsPence + left.deliveryPence + 2_000);
      const r = splitRefundTotal(b2, total);
      if (total > left.goodsPence + left.deliveryPence) {
        expect(r.ok).toBe(false);
      } else {
        expect(r.ok).toBe(true);
        if (r.ok) {
          expect(r.value.goodsPence + r.value.deliveryPence).toBe(total);
          expect(r.value.goodsPence).toBeLessThanOrEqual(left.goodsPence);
          expect(r.value.deliveryPence).toBeLessThanOrEqual(left.deliveryPence);
          expect(b2.refundedGoodsPence + r.value.goodsPence).toBeLessThanOrEqual(b2.paidGoodsPence);
        }
      }
    });
  });
});
