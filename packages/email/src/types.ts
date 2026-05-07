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
  "payment-refund-notice",
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
  };
  invite: {
    inviteUrl: string;
    inviterName?: string | null;
    inviteeEmail: string;
    role?: string | null;
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
  "payment-refund-notice": "live",
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
