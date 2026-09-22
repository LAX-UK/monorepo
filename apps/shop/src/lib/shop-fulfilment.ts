import type { ShopFulfilmentOption } from "@auction/shop-contracts";

export type { ShopFulfilmentOption };

export type ShopDeliveryAddressInput = {
  line1: string;
  line2?: string;
  city: string;
  postcode: string;
  country: string;
};
