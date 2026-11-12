import type {
  ReofferClosedOutcome,
  ReofferMoney,
  ReofferSellerKind,
  ReofferSellerOutcome,
  ReofferStaffOutcome,
} from "../../reoffer-copy.js";
import type { TemplateDomainSlice } from "./shared.js";

const names = [
  "reoffer-seller-consent-request",
  "reoffer-seller-consent-reminder",
  "reoffer-offer-made",
  "reoffer-offer-reminder",
  "reoffer-offer-accepted",
  "reoffer-offer-closed",
  "reoffer-seller-outcome",
  "reoffer-staff-notice",
] as const;

type ReofferTemplateName = (typeof names)[number];

/**
 * Dates are ISO instants and money is typed (formatted by the shared money formatter). Seller and bidder variables never
 * carry the other party's identity; only the staff notice names the bidder.
 */
type ReofferTemplateVars = {
  /** To the seller: we would like to sell to the next bidder, and need their agreement. */
  "reoffer-seller-consent-request": {
    userName?: string | null;
    lotTitle: string;
    /** The offer price: the bidder's stored highest placed bid, never a maximum bid. */
    placedBidPrice: ReofferMoney;
    /** The end of the seller's time to answer (17:00 London). */
    answerBy: string;
    /** Where the seller answers. */
    actionUrl: string;
    supportContactEmail: string;
  };
  /** To the seller: the one reminder, if they have not yet answered. */
  "reoffer-seller-consent-reminder": {
    userName?: string | null;
    lotTitle: string;
    /** The offer price: the bidder's stored highest placed bid, never a maximum bid. */
    placedBidPrice: ReofferMoney;
    /** The end of the seller's time to answer (17:00 London). */
    answerBy: string;
    /** Where the seller answers. */
    actionUrl: string;
    supportContactEmail: string;
  };
  /** To the bidder: the offer, with the binding terms. The link opens the workspace; it never accepts. */
  "reoffer-offer-made": {
    userName?: string | null;
    /** Whose lot it is: a seller who has agreed, or a LAX-owned lot with no seller. */
    sellerKind: ReofferSellerKind;
    lotTitle: string;
    /** The offer price: the bidder's stored highest placed bid, never a maximum bid. */
    placedBidPrice: ReofferMoney;
    /** The end of the offer (17:00 London). */
    windowEndsAt: string;
    workspaceUrl: string;
    supportContactEmail: string;
  };
  "reoffer-offer-reminder": {
    userName?: string | null;
    lotTitle: string;
    /** The offer price: the bidder's stored highest placed bid, never a maximum bid. */
    placedBidPrice: ReofferMoney;
    windowEndsAt: string;
    workspaceUrl: string;
    supportContactEmail: string;
  };
  "reoffer-offer-accepted": {
    userName?: string | null;
    lotTitle: string;
    /** The offer price: the bidder's stored highest placed bid, never a maximum bid. */
    placedBidPrice: ReofferMoney;
    /** When the invoice falls due, seven days after acceptance. */
    invoiceDueAt: string;
    workspaceUrl: string;
    supportContactEmail: string;
  };
  /** To the bidder: the offer ended without a sale. */
  "reoffer-offer-closed": {
    userName?: string | null;
    lotTitle: string;
    outcome: ReofferClosedOutcome;
    workspaceUrl: string;
    supportContactEmail: string;
  };
  /** To the seller: how the offer ended. Never names the bidder. */
  "reoffer-seller-outcome": {
    userName?: string | null;
    lotTitle: string;
    /** The offer price: the bidder's stored highest placed bid, never a maximum bid. */
    placedBidPrice: ReofferMoney;
    outcome: ReofferSellerOutcome;
    actionUrl: string;
    supportContactEmail: string;
  };
  /** To staff: the bidder's answer, with the bidder named. */
  "reoffer-staff-notice": {
    lotTitle: string;
    lotReference?: string | null;
    /** The offer price: the bidder's stored highest placed bid, never a maximum bid. */
    placedBidPrice: ReofferMoney;
    bidderName: string;
    outcome: ReofferStaffOutcome;
    sellerKind: ReofferSellerKind;
    adminUrl: string;
    supportContactEmail: string;
  };
};

export const reofferTemplates = {
  names,
  vars: {} as ReofferTemplateVars,
  recipientResolution: {
    "reoffer-seller-consent-request": "live",
    "reoffer-seller-consent-reminder": "live",
    "reoffer-offer-made": "live",
    "reoffer-offer-reminder": "live",
    "reoffer-offer-accepted": "live",
    "reoffer-offer-closed": "live",
    "reoffer-seller-outcome": "live",
    "reoffer-staff-notice": "live",
  },
} satisfies TemplateDomainSlice<ReofferTemplateName, ReofferTemplateVars>;

export type { ReofferTemplateName, ReofferTemplateVars };
