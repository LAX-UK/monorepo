import type { TemplateDomainSlice } from "./shared.js";

const names = [
  "payout-transfer-failed-notice",
  "payout-transfer-blocked-notice",
  "payout-initiated-notice",
  "payout-clawback-required-notice",
] as const;

type PayoutTemplateName = (typeof names)[number];

type PayoutTemplateVars = {
  /** notify finance-role members when a payout transfer fails after retries. */
  "payout-transfer-failed-notice": {
    recipientFirstName?: string | null;
    entityName: string;
    payoutId: string;
    payoutAmount: string;
    payoutCurrency: string;
    failureReason: string;
    supportContactEmail: string;
    adminPayoutsUrl: string;
    sellerPayoutSetupUrl?: string | null;
  };
  /** notify finance-role members when a payout cannot start because Connect is not payout-ready. */
  "payout-transfer-blocked-notice": {
    recipientFirstName?: string | null;
    entityName: string;
    payoutId: string;
    payoutAmount: string;
    payoutCurrency: string;
    blockReason: string;
    supportContactEmail: string;
    adminPayoutsUrl: string;
  };
  "payout-initiated-notice": {
    recipientFirstName?: string | null;
    entityName: string;
    payoutId: string;
    amount: string;
    currency: string;
    adminPayoutsUrl: string;
  };
  "payout-clawback-required-notice": {
    recipientFirstName?: string | null;
    entityName: string;
    payoutId: string;
    netAmount: string;
    currency: string;
    adminPayoutsUrl: string;
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
  },
} satisfies TemplateDomainSlice<PayoutTemplateName, PayoutTemplateVars>;

export type { PayoutTemplateName, PayoutTemplateVars };
