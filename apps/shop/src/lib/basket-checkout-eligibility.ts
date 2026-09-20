import type { BasketView } from "@auction/shop-contracts";

export type BasketCheckoutBlockReason = "price_changed" | "out_of_stock";

export function basketCheckoutBlockReasons(basket: BasketView): BasketCheckoutBlockReason[] {
  const reasons = new Set<BasketCheckoutBlockReason>();
  for (const line of basket.lines) {
    if (line.priceChanged) reasons.add("price_changed");
    if (line.outOfStock) reasons.add("out_of_stock");
  }
  return [...reasons];
}

export function canProceedToCheckout(basket: BasketView): boolean {
  return basketCheckoutBlockReasons(basket).length === 0;
}

export function basketCheckoutBlockMessage(reasons: BasketCheckoutBlockReason[]): string {
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
