import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";
import { OrderSummarySchema } from "./commerce-public.js";
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
});
