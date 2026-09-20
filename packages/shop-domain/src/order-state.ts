export const SHOP_ORDER_STATUSES = ["pending_payment", "paid", "cancelled", "expired"] as const;

export type ShopOrderStatus = (typeof SHOP_ORDER_STATUSES)[number];

const transitions: Record<ShopOrderStatus, readonly ShopOrderStatus[]> = {
  pending_payment: ["paid", "cancelled", "expired"],
  paid: [],
  cancelled: [],
  expired: [],
};

export function canTransitionOrder(from: ShopOrderStatus, to: ShopOrderStatus): boolean {
  return transitions[from].includes(to);
}

export function assertOrderTransition(from: ShopOrderStatus, to: ShopOrderStatus): void {
  if (!canTransitionOrder(from, to)) {
    throw new Error(`Invalid order transition ${from} -> ${to}`);
  }
}
