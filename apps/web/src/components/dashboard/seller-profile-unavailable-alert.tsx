import { DashboardSliceErrorAlert } from "@/components/dashboard/dashboard-slice-error-alert";
import { buildDashboardSliceFailure } from "@/lib/dashboard/dashboard-fetch-errors";

type Props = {
  bootstrapFailed?: boolean;
};

/** Shown when the account being sold as could not be loaded or provisioned. */
export function SellerProfileUnavailableAlert({ bootstrapFailed = false }: Props) {
  const failure = buildDashboardSliceFailure(
    "submissions",
    bootstrapFailed ? 503 : 403,
    bootstrapFailed ? "personal_entity_unavailable" : "no_valid_legal_entity_for_submissions",
  );
  return <DashboardSliceErrorAlert failure={failure} />;
}
