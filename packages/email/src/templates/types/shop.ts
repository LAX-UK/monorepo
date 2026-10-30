import type { TemplateDomainSlice } from "./shared.js";

const names = [
  "shop-order-receipt",
  "shop-guest-order-link",
  "shop-artwork-enquiry-alert",
  "shop-edition-available-notify",
  "shop-zoho-dead-letter-notice",
  "shop-production-started",
  "shop-dispatch-notice",
  "shop-checkout-ops-alert",
  "shop-refund-issued",
  "shop-cancellation-confirmed",
  "art-general-enquiry-alert",
  "art-enquiry-received",
  "art-artist-application-received",
  "art-artist-application-more-info",
  "art-artist-application-declined",
  "art-artist-application-welcome",
] as const;

type ShopTemplateName = (typeof names)[number];

type ShopTemplateVars = {
  "shop-order-receipt": {
    orderId: string;
    /** "LAX-S-10482"; absent on receipts queued before orders had references. */
    orderReference?: string;
    totalAmount: string;
    /** Absent when the order recorded no VAT rate. */
    vatAmount?: string;
    orderUrl: string;
    lineSummary: string;
    /** True for a guest order: the link opens it without an account. */
    guest?: boolean;
  };
  "shop-guest-order-link": {
    orderReference: string;
    orderUrl: string;
    /** "29 November 2026": when the link stops opening the order. */
    expiresOn: string;
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
    /** Absent on alerts queued before the artist was named in the email. */
    artistName?: string;
    /**
     * Stops every waiting alert for the address without signing in. Absent on alerts queued
     * before guest alerts existed.
     */
    unsubscribeUrl?: string;
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
    /** "LAX-S-10482"; absent on notices queued before orders had references. */
    orderReference?: string;
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
    /** "LAX-S-10482"; absent on emails queued before orders had references. */
    orderReference?: string;
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
  /** The sender's copy of an enquiry: its reference, what happens next, the gallery's lines. */
  "art-enquiry-received": {
    /** "E-2041". */
    reference: string;
    /** The name typed in the form, if any. */
    recipientName?: string;
    /** A work on its page, or the topic of a general enquiry. */
    topic: "artwork" | "general" | "private_viewing" | "art_advisory" | "selling" | "exhibition";
    artworkTitle?: string;
    artworkUrl?: string;
    /** Where it was sent; decides which storefront's footer the email carries. */
    storefront: "shop" | "art";
  };
  /** The applicant's copy of an artist application they sent. */
  "art-artist-application-received": {
    artistName: string;
    reference: string;
    /** How long the gallery takes to reply, in weeks. */
    replyWeeks: number;
    applicationUrl: string;
  };
  /** The gallery asks the applicant something before deciding. */
  "art-artist-application-more-info": {
    artistName: string;
    reference: string;
    message: string;
    applicationUrl: string;
  };
  "art-artist-application-declined": {
    artistName: string;
    reference: string;
    reason: string;
    /** The date a new application may be sent, written out ("28 April 2027"). */
    reapplyFrom: string;
    applicationUrl: string;
  };
  /** Acceptance: the artist portal is open to the applicant's account. */
  "art-artist-application-welcome": {
    artistName: string;
    reference: string;
    portalUrl: string;
  };
};

export const shopTemplates = {
  names,
  vars: {} as ShopTemplateVars,
  recipientResolution: {
    "shop-order-receipt": "snapshot",
    "shop-guest-order-link": "snapshot",
    "shop-artwork-enquiry-alert": "snapshot",
    "shop-edition-available-notify": "snapshot",
    "shop-zoho-dead-letter-notice": "snapshot",
    "shop-production-started": "snapshot",
    "shop-dispatch-notice": "snapshot",
    "shop-checkout-ops-alert": "snapshot",
    "shop-refund-issued": "snapshot",
    "shop-cancellation-confirmed": "snapshot",
    "art-general-enquiry-alert": "snapshot",
    "art-enquiry-received": "snapshot",
    "art-artist-application-received": "snapshot",
    "art-artist-application-more-info": "snapshot",
    "art-artist-application-declined": "snapshot",
    "art-artist-application-welcome": "snapshot",
  },
} satisfies TemplateDomainSlice<ShopTemplateName, ShopTemplateVars>;

export type { ShopTemplateName, ShopTemplateVars };
