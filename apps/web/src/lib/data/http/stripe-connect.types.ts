import type { StripeConnectRequirementError } from "@auction/types";

export type StripeConnectStatus = {
  stripeAccountId: string | null;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  requirementsCurrentlyDue: string[];
  requirementsErrors: StripeConnectRequirementError[];
  disabledReason: string | null;
  ready: boolean;
  syncDegraded?: boolean;
};

export type StripeConnectClientConfig = {
  publishableKey: string | null;
  connectEnforced: boolean;
};

export type StripeConnectLoadError = "unauthorized" | "not_connected" | "server_error";

export type StripeConnectStatusLoadResult =
  | { ok: true; data: StripeConnectStatus }
  | { ok: false; error: StripeConnectLoadError };
