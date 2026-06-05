export type ConnectErrorKind =
  | "sync_degraded"
  | "init_failed"
  | "role_blocked"
  | "polling_timed_out"
  | "generic";

const CONNECT_API_ERROR_MESSAGES: Record<string, string> = {
  stripe_platform_profile_incomplete:
    "Payout setup is temporarily unavailable while we finish payment configuration. Please try again later or contact support@lax.bid.",
  stripe_upstream_error:
    "We could not reach Stripe right now. Wait a moment, then use Try again or Refresh status.",
  stripe_rate_limited:
    "Stripe is busy right now. Wait a moment, then use Try again or Refresh status.",
  stripe_invalid_request:
    "Stripe could not create your payout account. Contact support@lax.bid if this continues.",
  stripe_not_configured:
    "Payout setup is not available yet. Contact support@lax.bid if you need help.",
  kyc_not_approved: "Complete identity verification before starting payout setup.",
  insufficient_role:
    "You do not have permission to complete this step. Ask an organisation owner or admin.",
  stripe_account_missing:
    "Payout account is still being created. Wait a moment, then use Try again or Refresh status.",
  account_session_failed:
    "Could not load the secure payout form. Use Refresh status or reload the page.",
  finance_awaiting_owner:
    "Payout setup has not started. Ask an organisation owner or admin to begin setup on this page.",
  connect_restricted:
    "This payout account cannot be used right now. Contact support@lax.bid for help.",
  preparing_timed_out:
    "Payout account setup is taking longer than expected. Try again or reload the page.",
};

/** Maps stable API error codes from /stripe-connect routes to seller-facing copy. */
export function connectApiErrorMessage(code: string | null | undefined): string | null {
  if (!code?.trim()) return null;
  return CONNECT_API_ERROR_MESSAGES[code] ?? null;
}

export function connectErrorMessage(kind: ConnectErrorKind, detail?: string | null): string {
  const mappedApiError = connectApiErrorMessage(detail);
  if (mappedApiError) return mappedApiError;

  switch (kind) {
    case "sync_degraded":
      return "We could not reach Stripe for a live status check. Showing the last known state — use Refresh status to try again.";
    case "init_failed":
      return (
        detail?.trim() ||
        "Could not load the payout setup form. Try Refresh status or reload the page."
      );
    case "role_blocked":
      return (
        connectApiErrorMessage(detail) ??
        "Ask an organisation owner or admin to complete initial payout setup."
      );
    case "polling_timed_out":
      return "Verification is still processing. Refresh status or check back in a few minutes.";
    default:
      return detail?.trim() || "Something went wrong.";
  }
}
