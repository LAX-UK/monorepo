import type { OptOutableLotVars, TemplateDomainSlice } from "./shared.js";

const names = [
  "bid-outbid",
  "lot-won",
  "lot-ended-seller",
  "proxy-cancelled-notice",
  "lot-voided-notice",
  "lot-withdrawal-declined-notice",
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
};

export const biddingTemplates = {
  names,
  vars: {} as BiddingTemplateVars,
  recipientResolution: {
    "bid-outbid": "live",
    "lot-won": "live",
    "lot-ended-seller": "live",
    "proxy-cancelled-notice": "live",
    "lot-voided-notice": "live",
    "lot-withdrawal-declined-notice": "live",
  },
} satisfies TemplateDomainSlice<BiddingTemplateName, BiddingTemplateVars>;

export type { BiddingTemplateName, BiddingTemplateVars };
