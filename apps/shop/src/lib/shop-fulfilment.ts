import type { ShopFulfilmentOption } from "@auction/shop-contracts";

export type { ShopFulfilmentOption };

export type ShopDeliveryAddressInput = {
  recipientName: string;
  line1: string;
  line2?: string;
  city: string;
  postcode: string;
  country: string;
};
