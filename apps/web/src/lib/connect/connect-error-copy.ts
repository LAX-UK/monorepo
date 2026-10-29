import { SITE_SUPPORT_EMAIL } from "@/lib/brand";
/** Shown when the secure payout form cannot start in the browser. */
export const PAYOUT_SETUP_LOAD_FAILED = "We couldn't load payout setup. Try again.";

export type ConnectErrorKind =
  | "sync_degraded"
  | "init_failed"
  | "role_blocked"
  | "polling_timed_out"
  | "generic";

const CONNECT_API_ERROR_MESSAGES: Record<string, string> = {
  stripe_platform_profile_incomplete: `Payout setup is temporarily unavailable while we finish payment configuration. Please try again later or contact ${SITE_SUPPORT_EMAIL}.`,
  stripe_upstream_error:
    "We couldn't reach our payment partner. Wait a moment, then use Try again or Refresh status.",
  stripe_rate_limited:
    "Payout setup is busy right now. Wait a moment, then use Try again or Refresh status.",
  stripe_invalid_request: `We couldn't create your payout account. Contact ${SITE_SUPPORT_EMAIL} if this continues.`,
  stripe_not_configured: `Payout setup is not available yet. Contact ${SITE_SUPPORT_EMAIL} if you need help.`,
  kyc_not_approved: "Complete identity verification before starting payout setup.",
  insufficient_role:
    "You do not have permission to complete this step. Ask an organisation owner or admin.",
  stripe_account_missing:
    "Payout account is still being created. Wait a moment, then use Try again or Refresh status.",
  account_session_failed:
    "Could not load the secure payout form. Use Refresh status or reload the page.",
  finance_awaiting_owner:
    "Payout setup has not started. Ask an organisation owner or admin to begin setup on this page.",
  connect_restricted: `This payout account cannot be used right now. Contact ${SITE_SUPPORT_EMAIL} for help.`,
  preparing_timed_out:
    "Payout account setup is taking longer than expected. Try again or reload the page.",
  stripe_connect_failed: `We could not start payout setup. Wait a moment, then try again, or contact ${SITE_SUPPORT_EMAIL} if this continues.`,
  stripe_sync_failed:
    "We could not refresh your payout status. Wait a moment, then use Refresh status.",
  legal_entity_update_failed: `Your payout account was created but we could not save it. Try again or contact ${SITE_SUPPORT_EMAIL}.`,
  legal_entity_not_found: `We could not find your seller profile. Reload the page or contact ${SITE_SUPPORT_EMAIL}.`,
  missing_legal_entity_context:
    "We could not determine which seller profile to use. Reload the page and try again.",
  session_required: "Your session expired. Sign in again, then return to payout setup.",
  dashboard_link_not_supported: `Payout details are managed in the secure form on this page. Contact ${SITE_SUPPORT_EMAIL} if you need help.`,
  dashboard_link_failed: `We couldn't open your payout account. Use the secure form above or contact ${SITE_SUPPORT_EMAIL}.`,
  stripe_onboarding_failed: `Could not open the payout setup link. Use the secure form above or contact ${SITE_SUPPORT_EMAIL}.`,
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
      return "We couldn't check your payout status just now, so this is the last status we had. Use Refresh status to try again.";
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
