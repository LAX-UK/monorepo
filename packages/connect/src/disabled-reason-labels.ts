import {
  STRIPE_ACCOUNT_DISABLED_REASONS,
  isStripeAccountDisabledReason,
} from "./stripe-disabled-reason-codes.js";
import type { ConnectRequirementLabel } from "./types.js";

const ACTIONABLE_DISABLED_REASONS = new Set<string>([
  "requirements.past_due",
  "requirements.pending_verification",
  "under_review",
]);

/** True when the seller can usually resolve the restriction via embedded onboarding. */
export function isActionableStripeDisabledReason(reason: string | null | undefined): boolean {
  if (!reason?.trim()) return false;
  return ACTIONABLE_DISABLED_REASONS.has(reason.trim());
}

const DISABLED_REASON_LABELS: Record<
  (typeof STRIPE_ACCOUNT_DISABLED_REASONS)[number],
  ConnectRequirementLabel
> = {
  "action_required.requested_capabilities": {
    label: "Capabilities not requested",
    hint: "The platform must request the required capabilities for this Connect account before it can be enabled.",
    severity: "warning",
  },
  listed: {
    label: "Under compliance review",
    hint: "This account may be on a prohibited persons or companies list. Stripe is investigating and will either reject or reinstate the account.",
    severity: "error",
  },
  other: {
    label: "Account disabled",
    hint: "This Connect account was disabled for another reason. Contact support if you need help.",
    severity: "error",
  },
  platform_paused: {
    label: "Payouts paused by platform",
    hint: "Payouts are paused on this account by the platform. Contact support for help.",
    severity: "error",
  },
  "rejected.fraud": {
    label: "Account rejected (fraud)",
    hint: "This account was rejected because of suspected fraud or illegal activity. Contact support for help.",
    severity: "error",
  },
  "rejected.incomplete_verification": {
    label: "Account rejected (incomplete verification)",
    hint: "This account was rejected because required verification was not completed in time. Contact support for help.",
    severity: "error",
  },
  "rejected.listed": {
    label: "Account rejected (prohibited list)",
    hint: "This account was rejected because it appears on a prohibited persons or companies list. Contact support for help.",
    severity: "error",
  },
  "rejected.other": {
    label: "Account rejected",
    hint: "This account was rejected for another reason. Contact support for help.",
    severity: "error",
  },
  "rejected.platform_fraud": {
    label: "Account rejected by platform (fraud)",
    hint: "The platform rejected this account for suspected fraud. Contact support for help.",
    severity: "error",
  },
  "rejected.platform_other": {
    label: "Account rejected by platform",
    hint: "The platform rejected this Connect account. Contact support for help.",
    severity: "error",
  },
  "rejected.platform_terms_of_service": {
    label: "Account rejected by platform (terms)",
    hint: "The platform rejected this account for violating the Stripe services agreement. Contact support for help.",
    severity: "error",
  },
  "rejected.terms_of_service": {
    label: "Account rejected (terms of service)",
    hint: "This account was rejected because of suspected terms-of-service violations. Contact support for help.",
    severity: "error",
  },
  "requirements.past_due": {
    label: "Overdue payout details",
    hint: "Additional verification information is required to enable capabilities on this account. Complete the payout form to restore transfers.",
    severity: "warning",
  },
  "requirements.pending_verification": {
    label: "Verification in progress",
    hint: "Stripe is verifying information on this account. No action is required unless prompted below.",
    severity: "warning",
  },
  under_review: {
    label: "Account under review",
    hint: "Stripe is reviewing this Connect account. Check the form below for any outstanding items.",
    severity: "warning",
  },
};

export function humanizeStripeDisabledReason(reason: string): ConnectRequirementLabel {
  const trimmed = reason.trim();
  if (isStripeAccountDisabledReason(trimmed)) {
    return DISABLED_REASON_LABELS[trimmed];
  }

  if (trimmed.startsWith("rejected.")) {
    return {
      label: "Account blocked",
      hint: "This payout account can't receive payouts right now. Contact support for help.",
      severity: "error",
    };
  }

  return {
    label: "Account restricted",
    hint: "This payout account has restrictions. Contact support for help.",
    severity: "error",
  };
}

export { STRIPE_ACCOUNT_DISABLED_REASONS, isStripeAccountDisabledReason };
