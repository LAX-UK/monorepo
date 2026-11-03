import { describe, expect, it } from "vitest";
import { cancelledLineIds, remainingRefundablePence } from "./refundable-balance.js";

const LINE_A = "11111111-1111-4111-8111-111111111111";
const LINE_B = "22222222-2222-4222-8222-222222222222";

describe("remainingRefundablePence", () => {
  it("leaves the whole order refundable when nothing has been refunded", () => {
    expect(remainingRefundablePence({ orderTotalPence: 10_000, refunds: [] })).toBe(10_000);
  });

  it("caps a line at its own total", () => {
    expect(
      remainingRefundablePence({
        orderTotalPence: 10_000,
        lineTotalPence: 6_000,
        orderLineId: LINE_A,
        refunds: [],
      }),
    ).toBe(6_000);
  });

  it("allows no line refund after the whole order was refunded", () => {
    expect(
      remainingRefundablePence({
        orderTotalPence: 10_000,
        lineTotalPence: 6_000,
        orderLineId: LINE_A,
        refunds: [{ amountPence: 10_000, status: "succeeded", orderLineId: null }],
      }),
    ).toBe(0);
  });

  it("limits a line to what is left on the order after a partial order refund", () => {
    expect(
      remainingRefundablePence({
        orderTotalPence: 10_000,
        lineTotalPence: 6_000,
        orderLineId: LINE_A,
        refunds: [{ amountPence: 7_000, status: "pending", orderLineId: null }],
      }),
    ).toBe(3_000);
  });

  it("counts other lines' refunds against the order, not against this line", () => {
    expect(
      remainingRefundablePence({
        orderTotalPence: 10_000,
        lineTotalPence: 6_000,
        orderLineId: LINE_A,
        refunds: [{ amountPence: 4_000, status: "succeeded", orderLineId: LINE_B }],
      }),
    ).toBe(6_000);
  });

  it("allows no order refund after every line was refunded in full", () => {
    expect(
      remainingRefundablePence({
        orderTotalPence: 10_000,
        refunds: [
          { amountPence: 6_000, status: "succeeded", orderLineId: LINE_A },
          { amountPence: 4_000, status: "succeeded", orderLineId: LINE_B },
        ],
      }),
    ).toBe(0);
  });

  it("ignores failed and cancelled refunds", () => {
    expect(
      remainingRefundablePence({
        orderTotalPence: 10_000,
        lineTotalPence: 6_000,
        orderLineId: LINE_A,
        refunds: [
          { amountPence: 10_000, status: "failed", orderLineId: null },
          { amountPence: 6_000, status: "cancelled", orderLineId: LINE_A },
        ],
      }),
    ).toBe(6_000);
  });
});

describe("refunds after a cancellation", () => {
  const LINE_C = "33333333-3333-4333-8333-333333333333";
  // Three items of 30.00 and a 10.00 delivery charge.
  const orderLines = [
    { orderLineId: LINE_A, totalPence: 3_000 },
    { orderLineId: LINE_B, totalPence: 3_000 },
    { orderLineId: LINE_C, totalPence: 3_000 },
  ];
  const cancellation = (status: "pending" | "succeeded" | "failed" | "cancelled") => ({
    amountPence: 3_000,
    status,
    orderLineId: LINE_A,
    source: "cancellation" as const,
  });

  it("finds the lines cancelled after possession, including one waiting for a retry", () => {
    expect([...cancelledLineIds([cancellation("pending")])]).toEqual([LINE_A]);
    expect([...cancelledLineIds([cancellation("failed")])]).toEqual([LINE_A]);
    expect(cancelledLineIds([cancellation("cancelled")]).size).toBe(0);
    expect(
      cancelledLineIds([{ amountPence: 3_000, status: "pending", orderLineId: LINE_A }]).size,
    ).toBe(0);
  });

  it("leaves the rest of the order refundable after a pending cancellation refund", () => {
    expect(
      remainingRefundablePence({
        orderTotalPence: 10_000,
        orderLines,
        refunds: [cancellation("pending")],
      }),
    ).toBe(7_000);
  });

  it("keeps a cancelled item's price out of a whole-order refund while its refund waits for a retry", () => {
    // Without the exclusion the failed refund counted for nothing, and a whole-order refund
    // could take the full 100.00, so the retry would pay the item a second time.
    expect(
      remainingRefundablePence({
        orderTotalPence: 10_000,
        orderLines,
        refunds: [cancellation("failed")],
      }),
    ).toBe(7_000);
  });

  it("does not let a whole-order refund reach into a cancelled item after other refunds", () => {
    expect(
      remainingRefundablePence({
        orderTotalPence: 10_000,
        orderLines,
        refunds: [
          cancellation("succeeded"),
          { amountPence: 2_000, status: "pending", orderLineId: null, source: "admin" },
          { amountPence: 1_000, status: "succeeded", orderLineId: LINE_B, source: "admin" },
        ],
      }),
    ).toBe(4_000);
  });

  it("allows nothing more on a cancelled line, whatever the state of its refund", () => {
    for (const status of ["pending", "succeeded", "failed"] as const) {
      expect(
        remainingRefundablePence({
          orderTotalPence: 10_000,
          lineTotalPence: 3_000,
          orderLineId: LINE_A,
          orderLines,
          refunds: [cancellation(status)],
        }),
      ).toBe(0);
    }
  });

  it("still lets staff refund another line in full", () => {
    expect(
      remainingRefundablePence({
        orderTotalPence: 10_000,
        lineTotalPence: 3_000,
        orderLineId: LINE_B,
        orderLines,
        refunds: [cancellation("failed")],
      }),
    ).toBe(3_000);
  });

  it("treats a voided cancellation refund as if it never happened", () => {
    expect(
      remainingRefundablePence({
        orderTotalPence: 10_000,
        orderLines,
        refunds: [cancellation("cancelled")],
      }),
    ).toBe(10_000);
  });
});
