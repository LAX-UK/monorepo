import { DashboardSliceErrorAlert } from "@/components/dashboard/dashboard-slice-error-alert";
import { supportMailto } from "@/lib/dashboard/dashboard-copy";
import { buildSellerConnectFailure } from "@/lib/dashboard/dashboard-fetch-errors";
import type { StripeConnectLoadError } from "@/lib/data/http/stripe-connect.types";
import { ButtonLink, Notice } from "@auction/ui/lax";

/**
 * Payout setup that did not load. An account LAX cannot reach is not the visitor's doing and
 * needs our team, so it reads as a calm notice with a way to contact us, not as an error.
 */
export function ConnectLoadFailure({ error }: { error: StripeConnectLoadError }) {
  if (error === "account_unreachable") {
    return (
      <div data-testid="payout-account-unreachable">
        <Notice
          title="We can't reach your payout account right now"
          actions={<ButtonLink href={supportMailto("Payout account")}>Contact us</ButtonLink>}
        >
          Your payout details are safe. Contact us and we will sort it out with you.
        </Notice>
      </div>
    );
  }
  return <DashboardSliceErrorAlert failure={buildSellerConnectFailure(error)} />;
}
