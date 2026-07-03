import type { OptOutableLotVars, TemplateDomainSlice } from "./shared.js";

const names = [
  "bid-outbid",
  "lot-won",
  "lot-ended-seller",
  "proxy-cancelled-notice",
  "lot-voided-notice",
] as const;

type BiddingTemplateName = (typeof names)[number];

type BiddingTemplateVars = {
  "bid-outbid": OptOutableLotVars & {
    currentBid: string;
  };
  "lot-won": OptOutableLotVars & {
    winningBid: string;
    paymentUrl?: string | null;
    hammerPrice?: string;
    totalDue?: string;
  };
  "lot-ended-seller": OptOutableLotVars & {
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
  },
} satisfies TemplateDomainSlice<BiddingTemplateName, BiddingTemplateVars>;

export type { BiddingTemplateName, BiddingTemplateVars };
