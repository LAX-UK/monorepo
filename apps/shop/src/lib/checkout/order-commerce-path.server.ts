import { loadShopViewerState } from "@/lib/shop-viewer-state.server";

/** What can be done to one order from the storefront. */
export type OrderCommerceAction = "cancel" | "problem-reports" | "resume-checkout";

/**
 * Where an order action goes. A signed-in shopper acts on the order by id; a guest has no account,
 * so the action goes through the order token their browser holds from checkout or the emailed
 * link, and Shop Identity reads it from the httpOnly cookie.
 */
export async function orderCommercePath(
  orderId: string,
  action: OrderCommerceAction,
): Promise<string> {
  const viewer = await loadShopViewerState();
  return viewer.kind === "guest"
    ? `/commerce/guest-orders/current/${action}`
    : `/commerce/orders/${encodeURIComponent(orderId)}/${action}`;
}
