import type { ShopFulfilmentOption } from "@auction/shop-contracts";

const FULFILMENT_LABELS: Record<ShopFulfilmentOption, string> = {
  uk_insured_delivery: "UK insured delivery",
  collect_new_cavendish: "Collect at New Cavendish Street",
  collect_brunswick: "Collect at Brunswick Place",
  lax_storage: "LAX storage",
  international_quotation: "International delivery (quotation)",
};

export function resolveShopFulfilmentLabel(option: ShopFulfilmentOption): string {
  return FULFILMENT_LABELS[option];
}
