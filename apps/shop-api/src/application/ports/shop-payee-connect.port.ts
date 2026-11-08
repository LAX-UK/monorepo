export type ShopPayeeConnectStatus = {
  /** Whether a Stripe account exists; the seller is never told its id. */
  accountLinked: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  requirementsCurrentlyDue: string[];
  disabledReason: string | null;
  ready: boolean;
};

export type ShopPayeeConnectAccountLink = {
  url: string;
  expiresAt: string;
};

export type ShopPayeeConnectSessionSurface = "onboarding" | "management";

export type ShopPayeeConnectClientConfig = {
  publishableKey: string | null;
  connectConfigured: boolean;
};

/** Portal use cases for a payee's lax.art payout account. */
export interface ShopPayeeConnectPort {
  getClientConfig(): ShopPayeeConnectClientConfig;
  getStatusForSubject(identitySubjectId: string): Promise<ShopPayeeConnectStatus>;
  ensureAccountForSubject(identitySubjectId: string): Promise<{ stripeAccountId: string }>;
  createOnboardingLinkForSubject(
    identitySubjectId: string,
    returnUrl: string,
    refreshUrl: string,
  ): Promise<ShopPayeeConnectAccountLink>;
  createAccountSessionForSubject(
    identitySubjectId: string,
    surface: ShopPayeeConnectSessionSurface,
  ): Promise<{ clientSecret: string }>;
}
