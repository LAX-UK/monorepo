import { describe, expect, it } from "vitest";
import {
  SHOP_FULFILMENT_STATUSES,
  type ShopFulfilmentStatus,
  canTransitionFulfilmentStatus,
} from "./fulfilment-state.js";

const ALL = SHOP_FULFILMENT_STATUSES;

function expectedAllowed(from: ShopFulfilmentStatus): Set<ShopFulfilmentStatus> {
  const base: Record<ShopFulfilmentStatus, readonly ShopFulfilmentStatus[]> = {
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
  return new Set([from, ...base[from]]);
}

describe("fulfilment transitions", () => {
  it.each(ALL.flatMap((from) => ALL.map((to) => [from, to] as const)))("%s -> %s", (from, to) => {
    expect(canTransitionFulfilmentStatus(from, to)).toBe(expectedAllowed(from).has(to));
  });
});
