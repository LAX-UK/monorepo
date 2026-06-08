import type { BillToContext } from "@auction/types";

export const templateNames = [
  "account-suspended",
  "welcome",
  "verify-email",
  "account-activation",
  "reset-password",
  "oauth-account-reset-attempt",
  "password-changed",
  "2fa-enabled",
  "2fa-disabled",
  "new-device-login",
  "password-changed-elsewhere",
  "password-changed-sessions-not-revoked",
  "change-email",
  "invite",
  "bid-outbid",
  "lot-won",
  "lot-ended-seller",
  "payment-receipt",
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
  "kyc-resubmission-required",
  "aml-compliance-review-notice",
  "submission-approved",
  "submission-converted",
  "submission-rejected",
  "submission-draft-reminder",
] as const;

export type TemplateName = (typeof templateNames)[number];

export type TemplateVarsByName = {
  "account-suspended": {
    userName?: string | null;
    supportContactEmail: string;
  };
  welcome: {
    userName?: string | null;
  };
  "verify-email": {
    verificationUrl: string;
    userName?: string | null;
  };
  "account-activation": {
    activationUrl: string;
    userName?: string | null;
    expirationMinutes: number;
  };
  "reset-password": {
    resetLink: string;
    userEmail: string;
    userName?: string | null;
    expirationMinutes: number;
  };
  /** Sent when a forgot-password is requested for an account that exists
   * but has no credential row (i.e. was created via Google/Apple). The
   * privacy contract requires the public response to be identical to other
   * branches; tailored guidance is delivered only to the inbox owner.
   */
  "oauth-account-reset-attempt": {
    provider: "google" | "apple";
    signInUrl: string;
    settingsUrl: string;
    userEmail: string;
    userName?: string | null;
  };
  "password-changed": {
    userName?: string | null;
  };
  "2fa-enabled": {
    userName?: string | null;
  };
  "2fa-disabled": {
    userName?: string | null;
  };
  "new-device-login": {
    userName?: string | null;
    whenDisplay?: string | null;
    deviceSummary?: string | null;
  };
  "password-changed-elsewhere": {
    userName?: string | null;
  };
  "password-changed-sessions-not-revoked": {
    userName?: string | null;
    sessionsSettingsUrl: string;
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
  "kyc-resubmission-required": {
    userName?: string | null;
    issueDetail?: string | null;
    verifyUrl: string;
  };
  /**
   * MLRO / compliance escalation for a sanctions/PEP/adverse-media match or a
   * Source-of-Funds case requiring review. Deliberately PII-light (references +
   * a short detail line); full context lives behind the admin review queue.
   */
  "aml-compliance-review-notice": {
    recipientFirstName?: string | null;
    /** "screening" (watchlist match) or "source_of_funds". */
    kind: "screening" | "source_of_funds";
    /** Screening id or Source-of-Funds case id. */
    caseReference: string;
    detail: string;
    adminReviewUrl: string;
    supportContactEmail: string;
  };
  "submission-approved": {
    userName?: string | null;
    submissionTitle: string;
    submissionUrl: string;
    unsubscribeUrl: string;
  };
  "submission-converted": {
    userName?: string | null;
    submissionTitle: string;
    submissionUrl: string;
    unsubscribeUrl: string;
  };
  "submission-rejected": {
    userName?: string | null;
    submissionTitle: string;
    submissionUrl: string;
    resubmitUrl: string;
    reasonSummary?: string | null;
    unsubscribeUrl: string;
  };
  "submission-draft-reminder": {
    userName?: string | null;
    submissionTitle: string;
    submissionUrl: string;
    staleDays: number;
    unsubscribeUrl: string;
  };
};

export type RecipientResolution = "live" | "snapshot";

export const RECIPIENT_RESOLUTION: Record<TemplateName, RecipientResolution> = {
  "account-suspended": "live",
  welcome: "live",
  "verify-email": "live",
  "account-activation": "live",
  "reset-password": "live",
  "oauth-account-reset-attempt": "live",
  "password-changed": "live",
  "2fa-enabled": "live",
  "2fa-disabled": "live",
  "new-device-login": "live",
  "password-changed-elsewhere": "live",
  "password-changed-sessions-not-revoked": "live",
  "change-email": "snapshot",
  invite: "live",
  "bid-outbid": "live",
  "lot-won": "live",
  "lot-ended-seller": "live",
  "payment-receipt": "live",
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
  "kyc-resubmission-required": "live",
  "aml-compliance-review-notice": "live",
  "submission-approved": "live",
  "submission-converted": "live",
  "submission-rejected": "live",
  "submission-draft-reminder": "live",
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
