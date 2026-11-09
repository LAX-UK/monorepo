import type { ShopFetchResult } from "@/lib/shop-fetch-result";
import type { BasketView } from "@auction/shop-contracts";

/** True only when the basket is known to be empty; failures and 401s are not "empty". */
export function basketKnownEmpty(result: ShopFetchResult<BasketView>): boolean {
  return result.status === "empty" || (result.status === "ok" && result.data.lines.length === 0);
}

/**
 * Where the basket's checkout button leads. Signed-in and signed-out shoppers both go to
 * checkout, which offers a signed-out shopper guest checkout or sign-in. Only a session that
 * cannot be read (or a disabled account) is sent to sign in first.
 */
export function basketCheckoutEntry(
  viewerKind: "guest" | "authenticated" | "disabled" | "unavailable",
): "checkout" | "sign_in" {
  return viewerKind === "guest" || viewerKind === "authenticated" ? "checkout" : "sign_in";
}

export type BasketCheckoutBlockReason =
  | "price_changed"
  | "out_of_stock"
  | "framing_unavailable"
  | "framing_not_orderable";

export function basketCheckoutBlockReasons(basket: BasketView): BasketCheckoutBlockReason[] {
  const reasons = new Set<BasketCheckoutBlockReason>();
  for (const line of basket.lines) {
    if (line.priceChanged) reasons.add("price_changed");
    if (line.outOfStock) reasons.add("out_of_stock");
    // A frame that is no longer offered must be chosen again, or the print taken unframed.
    if (line.framing && !line.framing.available) reasons.add("framing_unavailable");
    // Orders do not carry framing yet, and shop-api refuses a framed print at checkout. Say so
    // here, so a shopper is told in the basket instead of meeting a raw refusal. Remove with that
    // guard once orders price framing.
    if (line.framing) reasons.add("framing_not_orderable");
  }
  return [...reasons];
}

export function canProceedToCheckout(basket: BasketView): boolean {
  return basketCheckoutBlockReasons(basket).length === 0;
}

export function basketCheckoutBlockMessage(reasons: BasketCheckoutBlockReason[]): string {
  if (reasons.includes("framing_not_orderable")) {
    return "Framing can't be ordered yet. Choose unframed for the prints that have a frame, then check out.";
  }
  if (reasons.includes("framing_unavailable") && reasons.length === 1) {
    return "A frame in your basket is no longer offered. Choose another framing or unframed before checkout.";
  }
  if (reasons.includes("price_changed") && reasons.includes("out_of_stock")) {
    return "Some lines are out of stock and others have price changes. Update your basket before checkout.";
  }
  if (reasons.includes("price_changed")) {
    return "Prices changed since these items were added. Update quantities or refresh before checkout.";
  }
  if (reasons.includes("out_of_stock")) {
    return "Some editions are no longer available. Remove or reduce quantities before checkout.";
  }
  return "";
}
