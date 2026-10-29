import { SITE_SUPPORT_EMAIL } from "@/lib/brand";
/** Human-readable copy for organisation onboarding Connect step API codes. */
export function humanizeOrgConnectStepError(code: string | undefined | null): string {
  switch (code) {
    case "connect_not_started":
      return "Start payout setup using the embedded form above.";
    case "connect_not_complete":
      return "Finish your payout details, then use Refresh status before continuing.";
    case "connect_requirements_pending":
      return "We still need a few details. Complete the items in the form above.";
    case "connect_restricted":
      return `This payout account is restricted. Contact ${SITE_SUPPORT_EMAIL} before continuing.`;
    case "connect_sync_failed":
      return "We couldn't check your payout setup. Try Refresh status, then continue.";
    case "stripe_not_configured":
      return "Payout setup is temporarily unavailable. Try again later or contact support.";
    case "insufficient_role":
      return "Ask an organisation owner or admin to complete payout setup.";
    default:
      return code
        ? `Could not continue: ${code.replaceAll("_", " ")}.`
        : "Finish payout setup first.";
  }
}
