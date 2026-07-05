import {
  type StripeConnectRequirementError,
  normalizeStripeConnectRequirementErrors,
  normalizeStripeConnectRequirementKeys,
} from "@auction/types";

/** Minimal Stripe account shape — no stripe npm dependency in connect. */
export type StripeAccountConnectSnapshot = {
  charges_enabled?: boolean;
  payouts_enabled?: boolean;
  requirements?: {
    currently_due?: string[] | null;
    disabled_reason?: string | null;
    errors?: unknown;
  } | null;
};

export type StripeConnectFlagPatch = {
  stripeConnectChargesEnabled: boolean;
  stripeConnectPayoutsEnabled: boolean;
  stripeConnectRequirementsCurrentlyDue: string[];
  stripeConnectRequirementsErrors: StripeConnectRequirementError[];
  stripeConnectDisabledReason: string | null;
};

export function buildStripeConnectFlagPatch(
  account: StripeAccountConnectSnapshot,
): StripeConnectFlagPatch {
  const requirementsCurrentlyDue = normalizeStripeConnectRequirementKeys(
    account.requirements?.currently_due,
  );
  const disabledReasonRaw = account.requirements?.disabled_reason;
  const disabledReason =
    typeof disabledReasonRaw === "string" && disabledReasonRaw.trim()
      ? disabledReasonRaw.trim()
      : null;

  return {
    stripeConnectChargesEnabled: Boolean(account.charges_enabled),
    stripeConnectPayoutsEnabled: Boolean(account.payouts_enabled),
    stripeConnectRequirementsCurrentlyDue: requirementsCurrentlyDue,
    stripeConnectRequirementsErrors: normalizeStripeConnectRequirementErrors(
      account.requirements?.errors,
    ),
    stripeConnectDisabledReason: disabledReason,
  };
}
