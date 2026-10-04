import { describe, expect, it } from "vitest";
import {
  SHOP_ORDER_STATUSES,
  type ShopOrderStatus,
  assertOrderTransition,
  canTransitionOrder,
} from "./order-state.js";

const transitions: Record<ShopOrderStatus, readonly ShopOrderStatus[]> = {
  pending_payment: ["paid", "cancelled", "expired", "payment_failed"],
  paid: ["partially_refunded", "refunded"],
  cancelled: [],
  expired: [],
  payment_failed: [],
  partially_refunded: ["refunded"],
  refunded: [],
};

describe("order transitions", () => {
  it.each(
    SHOP_ORDER_STATUSES.flatMap((from) =>
      SHOP_ORDER_STATUSES.map((to) => [from, to, transitions[from].includes(to)] as const),
    ),
  )("%s -> %s allowed=%s", (from, to, allowed) => {
    expect(canTransitionOrder(from, to)).toBe(allowed);
    if (allowed) {
      expect(() => assertOrderTransition(from, to)).not.toThrow();
    } else {
      expect(() => assertOrderTransition(from, to)).toThrow();
    }
  });
});
