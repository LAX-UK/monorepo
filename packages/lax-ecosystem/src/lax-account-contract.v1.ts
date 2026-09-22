import type { LaxProductId } from "./product-directory.js";

export const LAX_ACCOUNT_CONTRACT_VERSION = 1 as const;

export type LaxAccountProfileSummaryV1 = {
  displayName: string;
  email: string | null;
  locale: string | null;
};

export type LaxAccountSecuritySummaryV1 = {
  mfaEnabled: boolean;
  lastPasswordChangeAt: string | null;
  lastSignInAt: string | null;
};

export type LaxGlobalCommunicationConsentV1 = {
  marketingEmail: boolean;
  productUpdatesEmail: boolean;
};

export type LaxConnectedProductV1 = {
  productId: LaxProductId;
  label: string;
  settingsHref: string;
  connected: boolean;
};

/** Neutral portal aggregate — products map their APIs into this shape at the portal BFF. */
export type LaxAccountPortalSummaryV1 = {
  version: typeof LAX_ACCOUNT_CONTRACT_VERSION;
  subject: string;
  profile: LaxAccountProfileSummaryV1;
  security: LaxAccountSecuritySummaryV1;
  communication: LaxGlobalCommunicationConsentV1;
  connectedProducts: LaxConnectedProductV1[];
};
