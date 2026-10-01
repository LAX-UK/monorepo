export const SHOP_ORDER_STATUSES = [
  "pending_payment",
  "paid",
  "cancelled",
  "expired",
  "payment_failed",
  "partially_refunded",
  "refunded",
] as const;

export type ShopOrderStatus = (typeof SHOP_ORDER_STATUSES)[number];

const transitions: Record<ShopOrderStatus, readonly ShopOrderStatus[]> = {
  pending_payment: ["paid", "cancelled", "expired", "payment_failed"],
  paid: ["partially_refunded", "refunded"],
  cancelled: [],
  expired: [],
  payment_failed: [],
  partially_refunded: ["refunded"],
  refunded: [],
};

export function canTransitionOrder(from: ShopOrderStatus, to: ShopOrderStatus): boolean {
  return transitions[from].includes(to);
}

export function assertOrderTransition(from: ShopOrderStatus, to: ShopOrderStatus): void {
  if (!canTransitionOrder(from, to)) {
    throw new Error(`Invalid order transition ${from} -> ${to}`);
  }
}
