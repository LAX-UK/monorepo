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
