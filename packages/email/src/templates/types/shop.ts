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
  "art-general-enquiry-alert",
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
    artworkUrl: string;
    buyerEmail: string;
    /** Name typed in the enquiry form. */
    buyerName?: string;
    /** True when the enquiry was sent without a LAX account. */
    guest?: boolean;
    message?: string;
    contactPhone?: string;
    /** Storefront the enquiry came from; absent on alerts queued before lax.art branding. */
    storefront?: "shop" | "art";
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
  "art-general-enquiry-alert": {
    topicLabel: string;
    buyerEmail: string;
    /** Name typed in the enquiry form. */
    buyerName?: string;
    /** True when the enquiry was sent without a LAX account. */
    guest?: boolean;
    message: string;
    contextSlug?: string;
    contactPhone?: string;
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
    "art-general-enquiry-alert": "snapshot",
  },
} satisfies TemplateDomainSlice<ShopTemplateName, ShopTemplateVars>;

export type { ShopTemplateName, ShopTemplateVars };
