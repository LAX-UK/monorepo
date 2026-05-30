export type ConnectErrorKind =
  | "sync_degraded"
  | "init_failed"
  | "role_blocked"
  | "polling_timed_out"
  | "generic";

export function connectErrorMessage(kind: ConnectErrorKind, detail?: string | null): string {
  switch (kind) {
    case "sync_degraded":
      return "We could not reach Stripe for a live status check. Showing the last known state — use Refresh status to try again.";
    case "init_failed":
      return (
        detail?.trim() ||
        "Could not load the payout setup form. Try Refresh status or reload the page."
      );
    case "role_blocked":
      return "Ask an organisation owner or admin to complete initial payout setup.";
    case "polling_timed_out":
      return "Verification is still processing. Refresh status or check back in a few minutes.";
    default:
      return detail?.trim() || "Something went wrong.";
  }
}
