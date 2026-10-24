export const SHOP_FULFILMENT_STATUSES = [
  "pending_production",
  "in_production",
  "awaiting_dispatch",
  "in_transit",
  "ready_for_collection",
  "collected",
  "in_storage",
  "delivered",
  "cancelled",
] as const;

export type ShopFulfilmentStatus = (typeof SHOP_FULFILMENT_STATUSES)[number];

const ALLOWED: Readonly<Record<ShopFulfilmentStatus, readonly ShopFulfilmentStatus[]>> = {
  pending_production: ["in_production", "cancelled"],
  in_production: ["awaiting_dispatch", "cancelled"],
  awaiting_dispatch: ["in_transit", "ready_for_collection", "in_storage", "cancelled"],
  in_transit: ["delivered", "cancelled"],
  ready_for_collection: ["collected", "cancelled"],
  collected: [],
  in_storage: ["awaiting_dispatch", "cancelled"],
  delivered: [],
  cancelled: [],
};

/** The statuses a fulfilment can move to from `from`, in workflow order; empty when final. */
export function nextFulfilmentStatuses(
  from: ShopFulfilmentStatus,
): readonly ShopFulfilmentStatus[] {
  return ALLOWED[from];
}

export function isShopFulfilmentStatus(value: string): value is ShopFulfilmentStatus {
  return (SHOP_FULFILMENT_STATUSES as readonly string[]).includes(value);
}

export function canTransitionFulfilmentStatus(
  from: ShopFulfilmentStatus,
  to: ShopFulfilmentStatus,
): boolean {
  if (from === to) return true;
  return ALLOWED[from].includes(to);
}
