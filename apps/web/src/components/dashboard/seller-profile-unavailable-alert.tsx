import { DashboardSliceErrorAlert } from "@/components/dashboard/dashboard-slice-error-alert";
import { buildDashboardSliceFailure } from "@/lib/dashboard/dashboard-fetch-errors";

/**
 * Shown when there is no account to sell as. An outage reading the accounts never reaches here:
 * the client area shows its retry state for that.
 */
export function SellerProfileUnavailableAlert() {
  const failure = buildDashboardSliceFailure(
    "submissions",
    403,
    "no_valid_legal_entity_for_submissions",
  );
  return <DashboardSliceErrorAlert failure={failure} />;
}
