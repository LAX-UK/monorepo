import type { StripeConnectRequirementError } from "@auction/types";

export type StripeConnectStatus = {
  /** Whether a payout account is linked; its id is not shared with members. */
  accountLinked: boolean;
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

/**
 * Why the payout account did not load. `account_unreachable`: LAX holds an account id that
 * Stripe will not show us (revoked access, a wrong key, or no such account); ops are alerted.
 */
export type StripeConnectLoadError =
  | "unauthorized"
  | "not_connected"
  | "account_unreachable"
  | "server_error";

export type StripeConnectStatusLoadResult =
  | { ok: true; data: StripeConnectStatus }
  | { ok: false; error: StripeConnectLoadError };
