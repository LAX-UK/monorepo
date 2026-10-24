import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";
import { ORDER_STATUS_VALUES, OrderStatusSchema, OrderSummarySchema } from "./commerce-public.js";
import { parseOrderSummary } from "./parse-public.js";

describe("OrderSummarySchema", () => {
  it("accepts a null delivery address", () => {
    const payload = {
      orderId: "550e8400-e29b-41d4-a716-846655440001",
      status: "paid" as const,
      fulfilment: "uk_insured_delivery" as const,
      merchandiseSubtotalPence: 100,
      fulfilmentSurchargePence: 0,
      totalPence: 100,
      createdAt: "2026-01-01T00:00:00.000Z",
      paidAt: "2026-01-01T00:01:00.000Z",
      deliveryAddress: null,
      lines: [],
    };
    expect(Value.Check(OrderSummarySchema, payload)).toBe(true);
    expect(parseOrderSummary(payload).orderId).toBe(payload.orderId);
  });

  const base = {
    orderId: "550e8400-e29b-41d4-a716-846655440001",
    fulfilment: "uk_insured_delivery" as const,
    merchandiseSubtotalPence: 100,
    fulfilmentSurchargePence: 0,
    totalPence: 100,
    createdAt: "2026-01-01T00:00:00.000Z",
    paidAt: "2026-01-01T00:01:00.000Z",
    deliveryAddress: null,
    lines: [],
  };

  it.each(["refunded", "partially_refunded"] as const)("accepts a %s order", (status) => {
    const payload = { ...base, status, refundedPence: 40 };
    expect(Value.Check(OrderSummarySchema, payload)).toBe(true);
    expect(parseOrderSummary(payload).refundedPence).toBe(40);
  });

  it("treats the refunded amount as optional but never negative", () => {
    expect(Value.Check(OrderSummarySchema, { ...base, status: "paid" })).toBe(true);
    expect(Value.Check(OrderSummarySchema, { ...base, status: "paid", refundedPence: -1 })).toBe(
      false,
    );
  });

  it("rejects a status the contract does not know", () => {
    expect(Value.Check(OrderSummarySchema, { ...base, status: "disputed" })).toBe(false);
  });

  it("lists every status the schema accepts", () => {
    for (const status of ORDER_STATUS_VALUES) {
      expect(Value.Check(OrderStatusSchema, status)).toBe(true);
    }
  });
});
