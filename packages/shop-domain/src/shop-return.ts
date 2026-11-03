import type { ShopFulfilmentStatus } from "./fulfilment-state.js";

/** Where a returned item is on its way back to the gallery. Mirrors `shop_return_status`. */
export const SHOP_RETURN_STATUSES = ["requested", "in_transit", "received", "cancelled"] as const;
export type ShopReturnStatus = (typeof SHOP_RETURN_STATUSES)[number];

/** What staff decide for an item once it is back. Mirrors `shop_return.disposition`. */
export const SHOP_RETURN_DISPOSITIONS = ["back_on_sale", "withdrawn_damaged"] as const;
export type ShopReturnDisposition = (typeof SHOP_RETURN_DISPOSITIONS)[number];

const ALLOWED: Readonly<Record<ShopReturnStatus, readonly ShopReturnStatus[]>> = {
  requested: ["in_transit"],
  in_transit: ["received"],
  received: [],
  cancelled: [],
};

export function isShopReturnStatus(value: string): value is ShopReturnStatus {
  return (SHOP_RETURN_STATUSES as readonly string[]).includes(value);
}

export function isShopReturnDisposition(value: string): value is ShopReturnDisposition {
  return (SHOP_RETURN_DISPOSITIONS as readonly string[]).includes(value);
}

/** The statuses a return can move to from `from`; empty once received or closed. */
export function nextReturnStatuses(from: ShopReturnStatus): readonly ShopReturnStatus[] {
  return ALLOWED[from];
}

export function canTransitionReturn(from: ShopReturnStatus, to: ShopReturnStatus): boolean {
  return ALLOWED[from].includes(to);
}

/** Fulfilment stages at which the item is with a carrier or the customer, not in the gallery. */
const LEFT_THE_GALLERY: readonly ShopFulfilmentStatus[] = ["in_transit", "delivered", "collected"];

/**
 * What cancelling an item does to stock. An item that never left the gallery is back on sale at
 * once; one that was dispatched or collected has to come back first, tracked as a return.
 */
export type CancellationStockOutcome = "restock_now" | "await_return";

export function cancellationStockOutcome(
  fulfilment: ShopFulfilmentStatus,
): CancellationStockOutcome {
  return LEFT_THE_GALLERY.includes(fulfilment) ? "await_return" : "restock_now";
}

/** What an item that has come back does next. A refund on its own never decides this. */
export type ReturnedItemListing = "authorised" | "withdrawn";

export function listingAfterReturn(disposition: ShopReturnDisposition): ReturnedItemListing {
  return disposition === "back_on_sale" ? "authorised" : "withdrawn";
}
