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

export function canTransitionFulfilmentStatus(
  from: ShopFulfilmentStatus,
  to: ShopFulfilmentStatus,
): boolean {
  if (from === to) return true;
  return ALLOWED[from].includes(to);
}
