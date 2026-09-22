import type { TemplateDomainSlice } from "./shared.js";

const names = [
  "shop-order-receipt",
  "shop-artwork-enquiry-alert",
  "shop-edition-available-notify",
] as const;

type ShopTemplateName = (typeof names)[number];

type ShopTemplateVars = {
  "shop-order-receipt": {
    orderId: string;
    totalAmount: string;
    orderUrl: string;
    lineSummary: string;
  };
  "shop-artwork-enquiry-alert": {
    artworkTitle: string;
    artworkSlug: string;
    buyerEmail: string;
  };
  "shop-edition-available-notify": {
    artworkTitle: string;
    artworkUrl: string;
  };
};

export const shopTemplates = {
  names,
  vars: {} as ShopTemplateVars,
  recipientResolution: {
    "shop-order-receipt": "snapshot",
    "shop-artwork-enquiry-alert": "snapshot",
    "shop-edition-available-notify": "snapshot",
  },
} satisfies TemplateDomainSlice<ShopTemplateName, ShopTemplateVars>;

export type { ShopTemplateName, ShopTemplateVars };
