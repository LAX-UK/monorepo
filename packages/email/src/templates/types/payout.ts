import type { TemplateDomainSlice } from "./shared.js";

const names = [
  "payout-transfer-failed-notice",
  "payout-transfer-blocked-notice",
  "payout-initiated-notice",
  "payout-clawback-required-notice",
  "payout-bank-changed-notice",
] as const;

type PayoutTemplateName = (typeof names)[number];

/**
 * Who a payout notice is written for. Sellers read about their own payout and are sent to Sold &
 * payouts in Bid; staff get the operational wording and are sent to the admin payouts queue.
 */
type PayoutAudience = "seller" | "staff";

type PayoutTemplateVars = {
  /** Tells the seller's finance members a payout could not be paid; a staff copy goes to ops. */
  "payout-transfer-failed-notice": {
    audience: PayoutAudience;
    recipientFirstName?: string | null;
    entityName: string;
    payoutId: string;
    payoutAmount: string;
    payoutCurrency: string;
    /** Raw payment-provider error; shown to staff only. */
    failureReason: string;
    supportContactEmail: string;
    /** Sold & payouts for sellers, the admin payouts queue for staff. */
    payoutsUrl: string;
    sellerPayoutSetupUrl?: string | null;
  };
  /** Tells the seller's members a payout cannot start because their payout account is not ready. */
  "payout-transfer-blocked-notice": {
    audience: PayoutAudience;
    recipientFirstName?: string | null;
    entityName: string;
    payoutId: string;
    payoutAmount: string;
    payoutCurrency: string;
    blockReason: string;
    supportContactEmail: string;
    payoutsUrl: string;
    sellerPayoutSetupUrl?: string | null;
  };
  "payout-initiated-notice": {
    recipientFirstName?: string | null;
    entityName: string;
    payoutId: string;
    amount: string;
    currency: string;
    payoutsUrl: string;
  };
  /** Tells every owner, admin and finance member that the payout bank account changed. */
  "payout-bank-changed-notice": {
    userName: string;
    entityName: string;
    /** Last four digits of the new account, when Stripe gave them. */
    bankLast4: string | null;
    payoutsUrl: string;
  };
  "payout-clawback-required-notice": {
    audience: PayoutAudience;
    recipientFirstName?: string | null;
    entityName: string;
    payoutId: string;
    netAmount: string;
    currency: string;
    payoutsUrl: string;
  };
};

export const payoutTemplates = {
  names,
  vars: {} as PayoutTemplateVars,
  recipientResolution: {
    "payout-transfer-failed-notice": "live",
    "payout-transfer-blocked-notice": "live",
    "payout-initiated-notice": "live",
    "payout-clawback-required-notice": "live",
    "payout-bank-changed-notice": "live",
  },
} satisfies TemplateDomainSlice<PayoutTemplateName, PayoutTemplateVars>;

export type { PayoutAudience, PayoutTemplateName, PayoutTemplateVars };
