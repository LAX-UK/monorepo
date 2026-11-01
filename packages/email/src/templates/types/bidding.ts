import type { OptOutableLotVars, TemplateDomainSlice } from "./shared.js";

const names = [
  "bid-outbid",
  "lot-won",
  "lot-ended-seller",
  "lot-fulfilment-update",
  "proxy-cancelled-notice",
  "lot-voided-notice",
  "lot-withdrawal-declined-notice",
  "watched-lot-reminder",
] as const;

type BiddingTemplateName = (typeof names)[number];

type BiddingTemplateVars = {
  "bid-outbid": OptOutableLotVars & {
    /** Formatted for display ("£1,250.00"); left out when the amount is unknown. */
    currentBid?: string | null;
  };
  "lot-won": OptOutableLotVars & {
    /** Formatted for display; left out when the amount is unknown. */
    winningBid?: string | null;
    /** Checkout for this lot. */
    paymentUrl?: string | null;
    hammerPrice?: string;
    totalDue?: string;
  };
  "lot-ended-seller": OptOutableLotVars & {
    outcome: "sold" | "unsold";
    /** Formatted for display ("£1,250.00"); present when the lot sold. */
    hammerPrice?: string | null;
    /** Where the seller reviews the result: their consignments in Bid. */
    saleUrl?: string | null;
  };
  "lot-fulfilment-update": {
    userName?: string | null;
    lotTitle: string;
    /** What happened to the lot, as a heading, and what it means for the buyer. */
    heading: string;
    message: string;
    /** The buyer's purchase in Bid. */
    purchaseUrl: string;
  };
  "proxy-cancelled-notice": {
    userName?: string | null;
    lotTitle: string;
    reason: string;
    supportContactEmail: string;
  };
  "lot-voided-notice": {
    recipientFirstName?: string | null;
    lotTitle: string;
    reason: string;
    supportContactEmail: string;
  };
  "lot-withdrawal-declined-notice": {
    recipientFirstName?: string | null;
    lotTitle: string;
    /** Staff-written explanation, shown as written. */
    reason: string;
    supportContactEmail: string;
  };
  /** The reminder a person set on a watched lot, with their note. */
  "watched-lot-reminder": OptOutableLotVars & {
    kind: "sale_start" | "day_before_close" | "hour_before_close";
    note?: string | null;
    /** When the lot closes, formatted for display ("26 Nov 2026, 18:00"). */
    closesAt?: string | null;
  };
};

export const biddingTemplates = {
  names,
  vars: {} as BiddingTemplateVars,
  recipientResolution: {
    "bid-outbid": "live",
    "lot-won": "live",
    "lot-ended-seller": "live",
    "lot-fulfilment-update": "live",
    "proxy-cancelled-notice": "live",
    "lot-voided-notice": "live",
    "lot-withdrawal-declined-notice": "live",
    "watched-lot-reminder": "live",
  },
} satisfies TemplateDomainSlice<BiddingTemplateName, BiddingTemplateVars>;

export type { BiddingTemplateName, BiddingTemplateVars };
