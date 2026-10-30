import { DashboardSliceErrorAlert } from "@/components/dashboard/dashboard-slice-error-alert";
import { supportMailto } from "@/lib/dashboard/dashboard-copy";
import { buildSellerConnectFailure } from "@/lib/dashboard/dashboard-fetch-errors";
import type { StripeConnectLoadError } from "@/lib/data/http/stripe-connect.types";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import { Button } from "@auction/ui/components/button";

/**
 * Payout setup that did not load. An account LAX cannot reach is not the visitor's doing and
 * needs our team, so it reads as a calm notice with a way to contact us, not as an error.
 */
export function ConnectLoadFailure({ error }: { error: StripeConnectLoadError }) {
  if (error === "account_unreachable") {
    return (
      <Alert data-testid="payout-account-unreachable">
        <AlertTitle>We can&apos;t reach your payout account right now</AlertTitle>
        <AlertDescription className="flex flex-col gap-3 text-on-surface">
          <span>Your payout details are safe. Contact us and we will sort it out with you.</span>
          <div>
            <Button variant="secondary" asChild>
              <a href={supportMailto("Payout account")}>Contact us</a>
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    );
  }
  return <DashboardSliceErrorAlert failure={buildSellerConnectFailure(error)} />;
}
