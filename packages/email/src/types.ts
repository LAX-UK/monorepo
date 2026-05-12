import type { BillToContext } from "@auction/types";

export const templateNames = [
  "welcome",
  "verify-email",
  "reset-password",
  "password-changed",
  "change-email",
  "invite",
  "bid-outbid",
  "lot-won",
  "lot-ended-seller",
  "payment-receipt",
  "invoice-issued",
  "payment-invoice",
  "admin-impersonation-notice",
  "payout-transfer-failed-notice",
  "payout-transfer-blocked-notice",
  "payment-refund-notice",
  "payment-manual-review-buyer-notice",
  "payment-manual-review-admin-notice",
  "payout-initiated-notice",
  "dispute-opened-notice",
  "dispute-closed-notice",
  "proxy-cancelled-notice",
  "lot-voided-notice",
  "payout-clawback-required-notice",
  "legal-entity-archived-notice",
  "lot-voided-anti-shilling-admin",
] as const;

export type TemplateName = (typeof templateNames)[number];

export type TemplateVarsByName = {
  welcome: {
    userName?: string | null;
  };
  "verify-email": {
    verificationUrl: string;
    userName?: string | null;
  };
  "reset-password": {
    resetLink: string;
    userEmail: string;
    userName?: string | null;
    expirationMinutes: number;
  };
  "password-changed": {
    userName?: string | null;
  };
  "change-email": {
    confirmationUrl: string;
    oldEmail: string;
    newEmail: string;
    userName?: string | null;
    /** Which inbox received this message — copy differs for current vs new address. */
    recipient: "current" | "new";
  };
  invite: {
    inviteUrl: string;
    inviterName?: string | null;
    inviteeEmail: string;
    role?: string | null;
    /** When inviting platform staff, internal specialization label for copy. */
    staffRole?: string | null;
    expiresAt?: string | null;
  };
  "bid-outbid": OptOutableLotVars & {
    currentBid: string;
  };
  "lot-won": OptOutableLotVars & {
    winningBid: string;
    paymentUrl?: string | null;
  };
  "lot-ended-seller": OptOutableLotVars & {
    saleUrl?: string | null;
  };
  "payment-receipt": {
    userName?: string | null;
    lotTitle: string;
    amount: string;
    receiptUrl?: string | null;
  };
  "invoice-issued": {
    userName?: string | null;
    invoiceNumber: string;
    amount: string;
    invoiceUrl: string;
  };
  "payment-invoice": {
    userName?: string | null;
    invoiceNumber: string;
    amount: string;
    invoiceUrl: string;
    billTo: BillToContext;
  };
  "admin-impersonation-notice": {
    recipientFirstName?: string | null;
    entityName: string;
    adminDisplayName: string;
    windowEndDisplay: string;
    supportContactEmail: string;
  };
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
  /** notify seller entity members when a payment is refunded or dispute is lost. */
  "payment-refund-notice": {
    recipientFirstName?: string | null;
    entityName: string;
    lotTitle: string;
    lotReference?: string | null;
    refundAmount: string;
    refundCurrency: string;
    /** 'refund' | 'dispute_lost' */
    eventKind: string;
    /** Optional reason from Stripe (e.g. dispute reason). */
    reason?: string | null;
    supportContactEmail: string;
  };
  "payment-manual-review-buyer-notice": {
    userName?: string | null;
    lotTitle: string;
    lotReference?: string | null;
    supportContactEmail: string;
  };
  "payment-manual-review-admin-notice": {
    paymentId: string;
    lotTitle: string;
    lotReference?: string | null;
    sellerEntityName: string;
    amount: string;
    currency: string;
    adminReviewUrl: string;
  };
  "payout-initiated-notice": {
    recipientFirstName?: string | null;
    entityName: string;
    payoutId: string;
    amount: string;
    currency: string;
    adminPayoutsUrl: string;
  };
  "dispute-opened-notice": {
    recipientFirstName?: string | null;
    entityName: string;
    amount: string;
    currency: string;
    reason?: string | null;
    supportContactEmail: string;
  };
  "dispute-closed-notice": {
    recipientFirstName?: string | null;
    entityName: string;
    amount: string;
    currency: string;
    outcome: string;
    supportContactEmail: string;
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
  "payout-clawback-required-notice": {
    recipientFirstName?: string | null;
    entityName: string;
    payoutId: string;
    netAmount: string;
    currency: string;
    adminPayoutsUrl: string;
  };
  "legal-entity-archived-notice": {
    recipientFirstName?: string | null;
    entityName: string;
    legalEntityId: string;
    dashboardUrl: string;
    supportContactEmail: string;
  };
  "lot-voided-anti-shilling-admin": {
    lotTitle: string;
    lotId: string;
    adminLotUrl: string;
    supportContactEmail: string;
  };
};

export type RecipientResolution = "live" | "snapshot";

export const RECIPIENT_RESOLUTION: Record<TemplateName, RecipientResolution> = {
  welcome: "live",
  "verify-email": "live",
  "reset-password": "live",
  "password-changed": "live",
  "change-email": "snapshot",
  invite: "live",
  "bid-outbid": "live",
  "lot-won": "live",
  "lot-ended-seller": "live",
  "payment-receipt": "live",
  "invoice-issued": "live",
  "payment-invoice": "live",
  "admin-impersonation-notice": "live",
  "payout-transfer-failed-notice": "live",
  "payout-transfer-blocked-notice": "live",
  "payment-refund-notice": "live",
  "payment-manual-review-buyer-notice": "live",
  "payment-manual-review-admin-notice": "live",
  "payout-initiated-notice": "live",
  "dispute-opened-notice": "live",
  "dispute-closed-notice": "live",
  "proxy-cancelled-notice": "live",
  "lot-voided-notice": "live",
  "payout-clawback-required-notice": "live",
  "legal-entity-archived-notice": "live",
  "lot-voided-anti-shilling-admin": "live",
};

export type RenderedEmail = {
  subject: string;
  html: string;
  text: string;
};

type OptOutableLotVars = {
  userName?: string | null;
  lotTitle: string;
  lotUrl: string;
  unsubscribeUrl: string;
};
