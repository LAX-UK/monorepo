import type { ShopFulfilmentOption } from "@auction/shop-contracts";

/** How each delivery choice reads to a shopper, as checkout names it. */
const FULFILMENT_LABELS: Record<ShopFulfilmentOption, string> = {
  uk_insured_delivery: "UK insured delivery",
  collect_new_cavendish: "Collect from our London gallery",
  collect_brunswick: "Collection in London",
  lax_storage: "Storage with LAX",
  international_quotation: "Delivery outside the UK",
};

export function resolveShopFulfilmentLabel(option: ShopFulfilmentOption): string {
  return FULFILMENT_LABELS[option];
}

/** Whether the shopper collects the order rather than having it delivered. */
export function isShopCollectionFulfilment(option: ShopFulfilmentOption): boolean {
  return option === "collect_new_cavendish" || option === "collect_brunswick";
}
