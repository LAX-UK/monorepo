import { describe, expect, it } from "vitest";
import { legacyCheckoutTarget } from "./pay-legacy";
import { LOT_A, LOT_B, payable, planOf } from "./pay-plan-fixtures.test-util";

const payableNow = planOf([payable(LOT_A, 100_000, 25_000)]);
const paid = planOf([], { leftOut: [{ lotId: LOT_A, reason: "paid" }] });

describe("legacyCheckoutTarget", () => {
  it("opens the Pay page for a link with a lot to pay", () => {
    expect(legacyCheckoutTarget([LOT_A], undefined, payableNow)).toBe(
      `/purchases/pay?lots=${LOT_A}`,
    );
  });

  it("opens the Pay page without a plan, so the lot is still reachable", () => {
    expect(legacyCheckoutTarget([LOT_A], undefined, null)).toBe(`/purchases/pay?lots=${LOT_A}`);
    expect(legacyCheckoutTarget([], undefined, null)).toBe("/purchases/pay");
  });

  it("opens the purchase of a single lot that is already paid", () => {
    expect(legacyCheckoutTarget([LOT_A], undefined, paid)).toBe(`/purchases/${LOT_A}`);
  });

  it("returns from a payment to the purchase, never to a fresh Pay button", () => {
    // Even if the plan still shows the lot payable (the payment has not landed yet).
    expect(legacyCheckoutTarget([LOT_A], "success", payableNow)).toBe(`/purchases/${LOT_A}`);
    expect(legacyCheckoutTarget([LOT_A], "success", null)).toBe(`/purchases/${LOT_A}`);
    expect(legacyCheckoutTarget([LOT_A, LOT_B], "success", null)).toBe("/purchases");
    expect(legacyCheckoutTarget([], ["success"], null)).toBe("/purchases");
  });

  it("returns from a payment not completed to the Pay page with a note", () => {
    expect(legacyCheckoutTarget([LOT_A], "cancelled", payableNow)).toBe(
      `/purchases/pay?lots=${LOT_A}&returned=cancelled`,
    );
    expect(legacyCheckoutTarget([], "cancelled", null)).toBe("/purchases/pay?returned=cancelled");
  });

  it("opens the purchase when the lot turns out to be paid, even after a cancel", () => {
    expect(legacyCheckoutTarget([LOT_A], "cancelled", paid)).toBe(`/purchases/${LOT_A}`);
  });

  it("ignores any other value of payment", () => {
    expect(legacyCheckoutTarget([LOT_A], "other", payableNow)).toBe(`/purchases/pay?lots=${LOT_A}`);
  });
});
