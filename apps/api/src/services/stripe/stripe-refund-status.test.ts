import { describe, expect, it } from "vitest";
import {
  allocateRefundReversal,
  chargeRefundTotals,
  isCountedRefund,
  isReturnedNothing,
  isUnsettledRefund,
  refundCorrectionPence,
  reversibleRefunds,
} from "./stripe-refund-status.js";

describe("the refund counting rule", () => {
  it("counts only succeeded refunds, watches pending and requires_action, and treats failed and canceled as nothing returned", () => {
    expect(["succeeded"].filter(isCountedRefund)).toEqual(["succeeded"]);
    for (const status of [
      "pending",
      "requires_action",
      "failed",
      "canceled",
      "",
      null,
      undefined,
    ]) {
      expect(isCountedRefund(status)).toBe(false);
    }
    expect(["pending", "requires_action", "succeeded", "failed"].filter(isUnsettledRefund)).toEqual(
      ["pending", "requires_action"],
    );
    expect(["pending", "succeeded", "failed", "canceled"].filter(isReturnedNothing)).toEqual([
      "failed",
      "canceled",
    ]);
  });

  it("adds a charge's refunds up by status", () => {
    expect(
      chargeRefundTotals([
        { amountPence: 1_000, status: "succeeded" },
        { amountPence: 200, status: "pending" },
        { amountPence: 300, status: "requires_action" },
        { amountPence: 400, status: "failed" },
        { amountPence: 500, status: "canceled" },
        { amountPence: 600, status: "succeeded" },
      ]),
    ).toEqual({ countedPence: 1_600, unsettledPence: 500, returnedNothingPence: 900 });
  });

  it("raises a record up to what succeeded", () => {
    expect(
      refundCorrectionPence({ recordedPence: 0, countedPence: 2_500, reversiblePence: 0 }),
    ).toBe(2_500);
  });

  it("takes back only as much as failed refunds explain, and nothing when none failed", () => {
    // Counted while pending, then failed: all of it comes back.
    expect(
      refundCorrectionPence({ recordedPence: 2_500, countedPence: 0, reversiblePence: 2_500 }),
    ).toBe(-2_500);
    // Recorded above Stripe with no failed refund (money returned outside Stripe): left alone.
    expect(
      refundCorrectionPence({ recordedPence: 2_500, countedPence: 0, reversiblePence: 0 }),
    ).toBe(0);
    // Partly explained: only the failed part.
    expect(
      refundCorrectionPence({
        recordedPence: 3_000,
        countedPence: 1_000,
        reversiblePence: 500,
      }),
    ).toBe(-500);
    expect(
      refundCorrectionPence({
        recordedPence: 1_000,
        countedPence: 1_000,
        reversiblePence: 900,
      }),
    ).toBe(0);
  });

  it("offers each failed or cancelled refund once: one already taken back explains nothing more", () => {
    const refunds = [
      { id: "re_b", amountPence: 2_500, status: "failed" },
      { id: "re_a", amountPence: 1_000, status: "canceled" },
      { id: "re_c", amountPence: 4_000, status: "succeeded" },
      { id: "re_d", amountPence: 700, status: "pending" },
    ];
    expect(reversibleRefunds(refunds, new Set())).toEqual([
      { stripeRefundId: "re_a", amountPence: 1_000 },
      { stripeRefundId: "re_b", amountPence: 2_500 },
    ]);
    expect(reversibleRefunds(refunds, new Set(["re_b"]))).toEqual([
      { stripeRefundId: "re_a", amountPence: 1_000 },
    ]);
    expect(reversibleRefunds(refunds, new Set(["re_a", "re_b"]))).toEqual([]);
  });

  it("splits what is taken back across the refunds that explain it, each up to its amount", () => {
    const refunds = [
      { stripeRefundId: "re_a", amountPence: 1_000 },
      { stripeRefundId: "re_b", amountPence: 2_500 },
    ];
    expect(allocateRefundReversal(3_500, refunds)).toEqual(refunds);
    expect(allocateRefundReversal(1_200, refunds)).toEqual([
      { stripeRefundId: "re_a", amountPence: 1_000 },
      { stripeRefundId: "re_b", amountPence: 200 },
    ]);
    expect(allocateRefundReversal(0, refunds)).toEqual([]);
  });
});
