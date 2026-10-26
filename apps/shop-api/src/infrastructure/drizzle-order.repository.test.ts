import { ORDER_STATUS_VALUES } from "@auction/shop-contracts";
import { SHOP_ORDER_STATUSES } from "@auction/shop-domain";
import { describe, expect, it } from "vitest";
import { sampleOrderLine } from "../test-support/order-record.fixture.js";
import {
  type LineRow,
  parseOrderStatus,
  visibleEditionNumber,
} from "./drizzle-order.repository.js";

describe("parseOrderStatus", () => {
  it.each(SHOP_ORDER_STATUSES)("accepts the %s status", (status) => {
    expect(parseOrderStatus(status)).toBe(status);
  });

  it("accepts the statuses staff refunds set", () => {
    expect(parseOrderStatus("refunded")).toBe("refunded");
    expect(parseOrderStatus("partially_refunded")).toBe("partially_refunded");
  });

  it("fails loudly for a status it does not know", () => {
    expect(() => parseOrderStatus("disputed")).toThrow(/Unknown shop order status "disputed"/);
  });

  it("matches the statuses the public contract allows", () => {
    expect([...ORDER_STATUS_VALUES].sort()).toEqual([...SHOP_ORDER_STATUSES].sort());
  });
});

describe("visibleEditionNumber", () => {
  const line: LineRow = {
    ...sampleOrderLine({ editionNumber: 21 }),
    orderId: "550e8400-e29b-41d4-a716-846655440001",
    releasedAt: null,
  };

  it("names the edition on a paid order that still holds it", () => {
    expect(visibleEditionNumber("paid", line, [])).toBe(21);
    expect(visibleEditionNumber("partially_refunded", line, [])).toBe(21);
  });

  it.each(["pending_payment", "cancelled", "expired", "payment_failed", "refunded"] as const)(
    "names no edition on a %s order",
    (status) => {
      expect(visibleEditionNumber(status, line, [])).toBeNull();
    },
  );

  it("names no edition once the line was released or refunded in full", () => {
    expect(visibleEditionNumber("paid", { ...line, releasedAt: new Date() }, [])).toBeNull();
    const refund = {
      orderLineId: line.orderLineId,
      amountPence: line.unitPricePence,
      source: "cancellation" as const,
      status: "succeeded" as const,
      requestedAt: new Date(),
      refundedAt: new Date(),
    };
    expect(visibleEditionNumber("partially_refunded", line, [refund])).toBeNull();
    expect(visibleEditionNumber("paid", line, [{ ...refund, status: "pending" }])).toBe(21);
  });
});
