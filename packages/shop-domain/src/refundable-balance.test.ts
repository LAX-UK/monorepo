import { describe, expect, it } from "vitest";
import { remainingRefundablePence } from "./refundable-balance.js";

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
