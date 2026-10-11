import type { ShopPayeeConnectSessionSurface } from "./shop-payee-connect.port.js";

export type ShopConnectAccountPrefill = {
  partyId: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
};

export type ShopConnectAccountFlags = {
  stripeAccountId: string;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  requirementsCurrentlyDue: string[];
  disabledReason: string | null;
};

/** Stripe Connect calls on the LAX Art platform; one adapter per Stripe platform account. */
export interface ShopConnectGateway {
  createAccount(prefill: ShopConnectAccountPrefill): Promise<{ stripeAccountId: string }>;
  retrieveAccountFlags(stripeAccountId: string): Promise<ShopConnectAccountFlags>;
  createOnboardingLink(input: {
    stripeAccountId: string;
    returnUrl: string;
    refreshUrl: string;
  }): Promise<{ url: string; expiresAt: Date }>;
  createAccountSession(input: {
    stripeAccountId: string;
    surface: ShopPayeeConnectSessionSurface;
  }): Promise<string | null>;
  createTransfer(input: {
    payoutId: string;
    destinationAccountId: string;
    amountPence: number;
    idempotencyKey: string;
  }): Promise<{ transferId: string }>;
}
