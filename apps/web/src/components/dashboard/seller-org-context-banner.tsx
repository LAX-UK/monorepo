import { DashboardSliceErrorAlert } from "@/components/dashboard/dashboard-slice-error-alert";
import { Button } from "@/components/ui/button";
import { DASHBOARD_CTA } from "@/lib/dashboard/dashboard-copy";
import { buildDashboardSliceFailure } from "@/lib/dashboard/dashboard-fetch-errors";
import { usePersonalProfileForSubmissions } from "@/lib/legal-entity/submissions-access-actions";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";

/** Shown on seller routes when the user is acting as an organisation. */
export function SellerOrgContextBanner() {
  return (
    <Alert variant="default" className="border-outline-variant/40 bg-surface-container-low">
      <AlertTitle>Seller workspace uses your personal profile</AlertTitle>
      <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <span>
          You are viewing as an organisation. Switch to your personal profile to see your
          submissions, lots, and payouts.
        </span>
        <form action={usePersonalProfileForSubmissions}>
          <Button type="submit" variant="primary" size="sm">
            {DASHBOARD_CTA.usePersonalProfile}
          </Button>
        </form>
      </AlertDescription>
    </Alert>
  );
}

type SellerProfileUnavailableProps = {
  bootstrapFailed?: boolean;
};

/** Shown when the personal seller entity could not be loaded or provisioned. */
export function SellerProfileUnavailableAlert({
  bootstrapFailed = false,
}: SellerProfileUnavailableProps) {
  const failure = buildDashboardSliceFailure(
    "submissions",
    bootstrapFailed ? 503 : 403,
    bootstrapFailed ? "personal_entity_unavailable" : "no_valid_legal_entity_for_submissions",
  );
  return <DashboardSliceErrorAlert failure={failure} />;
}
