import type { TemplateDomainSlice } from "./shared.js";

const names = [
  "shop-order-receipt",
  "shop-artwork-enquiry-alert",
  "shop-edition-available-notify",
  "shop-zoho-dead-letter-notice",
  "shop-production-started",
  "shop-dispatch-notice",
  "shop-checkout-ops-alert",
  "shop-refund-issued",
  "shop-cancellation-confirmed",
] as const;

type ShopTemplateName = (typeof names)[number];

type ShopTemplateVars = {
  "shop-order-receipt": {
    orderId: string;
    totalAmount: string;
    vatAmount: string;
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
  "shop-zoho-dead-letter-notice": {
    eventId: string;
    deliveryId: string;
    eventType: string;
    lastError: string;
  };
  "shop-production-started": {
    artworkTitle: string;
    editionLabel: string;
  };
  "shop-dispatch-notice": {
    artworkTitle: string;
    trackingUrl: string | null;
    fulfilmentSummary: string;
  };
  "shop-checkout-ops-alert": {
    alertKind: string;
    orderId: string;
    detail: string;
  };
  "shop-refund-issued": {
    orderId: string;
    amountPence: number;
    buyerEmail: string;
  };
  "shop-cancellation-confirmed": {
    orderId: string;
    refundPeriodEndsAt: string;
  };
};

export const shopTemplates = {
  names,
  vars: {} as ShopTemplateVars,
  recipientResolution: {
    "shop-order-receipt": "snapshot",
    "shop-artwork-enquiry-alert": "snapshot",
    "shop-edition-available-notify": "snapshot",
    "shop-zoho-dead-letter-notice": "snapshot",
    "shop-production-started": "snapshot",
    "shop-dispatch-notice": "snapshot",
    "shop-checkout-ops-alert": "snapshot",
    "shop-refund-issued": "snapshot",
    "shop-cancellation-confirmed": "snapshot",
  },
} satisfies TemplateDomainSlice<ShopTemplateName, ShopTemplateVars>;

export type { ShopTemplateName, ShopTemplateVars };
