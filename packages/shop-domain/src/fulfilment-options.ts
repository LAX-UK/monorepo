export const SHOP_FULFILMENT_OPTIONS = [
  "uk_insured_delivery",
  "collect_new_cavendish",
  "collect_brunswick",
  "lax_storage",
  "international_quotation",
] as const;

export type ShopFulfilmentOption = (typeof SHOP_FULFILMENT_OPTIONS)[number];

/** Fixed delivery surcharges in pence (tax-inclusive). International is not purchasable online. */
export const FULFILMENT_SURCHARGE_PENCE: Record<
  Exclude<ShopFulfilmentOption, "international_quotation">,
  number
> = {
  uk_insured_delivery: 1500,
  collect_new_cavendish: 0,
  collect_brunswick: 0,
  lax_storage: 500,
};

export function isOnlineCheckoutFulfilment(option: ShopFulfilmentOption): boolean {
  return option !== "international_quotation";
}

export function fulfilmentSurchargePence(option: ShopFulfilmentOption): number {
  if (option === "international_quotation") {
    return 0;
  }
  return FULFILMENT_SURCHARGE_PENCE[option];
}
