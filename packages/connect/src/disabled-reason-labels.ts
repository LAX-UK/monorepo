import type { ConnectRequirementLabel } from "./types.js";

const ACTIONABLE_DISABLED_REASONS = new Set([
  "requirements.past_due",
  "requirements.pending_verification",
  "under_review",
]);

/** True when the seller can usually resolve the restriction via embedded onboarding. */
export function isActionableStripeDisabledReason(reason: string | null | undefined): boolean {
  if (!reason?.trim()) return false;
  return ACTIONABLE_DISABLED_REASONS.has(reason.trim());
}

export function humanizeStripeDisabledReason(reason: string): ConnectRequirementLabel {
  switch (reason.trim()) {
    case "requirements.past_due":
      return {
        label: "Overdue payout details",
        hint: "Some required information passed its deadline. Complete the payout form below to restore transfers.",
        severity: "warning",
      };
    case "requirements.pending_verification":
      return {
        label: "Verification in progress",
        hint: "Stripe is reviewing your details. You can still update information in the form below if prompted.",
        severity: "warning",
      };
    case "under_review":
      return {
        label: "Account under review",
        hint: "Stripe is reviewing this payout account. Check the form below for any outstanding items.",
        severity: "warning",
      };
    case "rejected.fraud":
      return {
        label: "Account blocked",
        hint: "This payout account was blocked for security reasons. Contact support for help.",
        severity: "error",
      };
    case "rejected.listed":
    case "listed":
      return {
        label: "Account blocked",
        hint: "This payout account is restricted. Contact support for help.",
        severity: "error",
      };
    case "rejected.terms_of_service":
      return {
        label: "Account blocked",
        hint: "This payout account was closed due to terms-of-service issues. Contact support for help.",
        severity: "error",
      };
    case "rejected.other":
      return {
        label: "Account blocked",
        hint: "This payout account was declined. Contact support for help.",
        severity: "error",
      };
    case "platform_paused":
      return {
        label: "Payouts paused",
        hint: "Payouts are paused on this account. Contact support for help.",
        severity: "error",
      };
    default:
      if (reason.startsWith("rejected.")) {
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
}
