import type { ReofferClosedOutcome, ReofferStaffOutcome } from "../../reoffer-copy.js";
import type { ReofferSellerOutcome } from "../../reoffer-copy.js";
import type { TemplateDomainSlice } from "./shared.js";

const names = [
  "reoffer-seller-consent-request",
  "reoffer-offer-made",
  "reoffer-offer-reminder",
  "reoffer-offer-accepted",
  "reoffer-offer-closed",
  "reoffer-seller-outcome",
  "reoffer-staff-notice",
] as const;

type ReofferTemplateName = (typeof names)[number];

/**
 * Dates are ISO instants and money is formatted for display. Seller and bidder variables never
 * carry the other party's identity; only the staff notice names the bidder.
 */
type ReofferTemplateVars = {
  /** To the seller: we would like to sell to the next bidder, and need their agreement. */
  "reoffer-seller-consent-request": {
    userName?: string | null;
    lotTitle: string;
    price: string;
    /** The end of the seller's time to answer (17:00 London). */
    answerBy: string;
    /** Where the seller answers. */
    actionUrl: string;
    supportContactEmail: string;
  };
  /** To the bidder: the offer, with the binding terms. The link opens the workspace; it never accepts. */
  "reoffer-offer-made": {
    userName?: string | null;
    lotTitle: string;
    price: string;
    /** The end of the offer (17:00 London). */
    windowEndsAt: string;
    workspaceUrl: string;
    supportContactEmail: string;
  };
  "reoffer-offer-reminder": {
    userName?: string | null;
    lotTitle: string;
    price: string;
    windowEndsAt: string;
    workspaceUrl: string;
    supportContactEmail: string;
  };
  "reoffer-offer-accepted": {
    userName?: string | null;
    lotTitle: string;
    price: string;
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
    price: string;
    outcome: ReofferSellerOutcome;
    actionUrl: string;
    supportContactEmail: string;
  };
  /** To staff: the bidder's answer, with the bidder named. */
  "reoffer-staff-notice": {
    lotTitle: string;
    lotReference?: string | null;
    price: string;
    bidderName: string;
    outcome: ReofferStaffOutcome;
    adminUrl: string;
    supportContactEmail: string;
  };
};

export const reofferTemplates = {
  names,
  vars: {} as ReofferTemplateVars,
  recipientResolution: {
    "reoffer-seller-consent-request": "live",
    "reoffer-offer-made": "live",
    "reoffer-offer-reminder": "live",
    "reoffer-offer-accepted": "live",
    "reoffer-offer-closed": "live",
    "reoffer-seller-outcome": "live",
    "reoffer-staff-notice": "live",
  },
} satisfies TemplateDomainSlice<ReofferTemplateName, ReofferTemplateVars>;

export type { ReofferTemplateName, ReofferTemplateVars };
