import { ORDER_STATUS_VALUES } from "@auction/shop-contracts";
import { SHOP_ORDER_STATUSES } from "@auction/shop-domain";
import { describe, expect, it } from "vitest";
import { parseOrderStatus } from "./drizzle-order.repository.js";

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
