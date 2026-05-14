import { DashboardErrorAlert } from "@/components/dashboard/primitives/dashboard-error-alert";
import type { DashboardOverviewErrors } from "@/lib/data/view-models/dashboard-overview.vm";

type OverviewErrorsAlertProps = {
  errors: DashboardOverviewErrors;
};

export function OverviewErrorsAlert({ errors }: OverviewErrorsAlertProps) {
  const hasErrors = Boolean(
    errors.session ||
      errors.active ||
      errors.portfolio ||
      errors.watchlist ||
      errors.artistFollow ||
      errors.bids ||
      errors.submissions,
  );

  if (!hasErrors) return null;

  return (
    <DashboardErrorAlert
      title="Some data could not load"
      message="The dashboard could not refresh every section."
    >
      <ul className="mt-2 list-inside list-disc space-y-1 font-body text-sm">
        {errors.session ? <li>Account session: {errors.session}</li> : null}
        {errors.active ? <li>Live inventory: {errors.active}</li> : null}
        {errors.portfolio ? <li>Portfolio: {errors.portfolio}</li> : null}
        {errors.watchlist ? <li>Watchlist: {errors.watchlist}</li> : null}
        {errors.artistFollow ? <li>Followed artists: {errors.artistFollow}</li> : null}
        {errors.bids ? <li>Bids: {errors.bids}</li> : null}
        {errors.submissions ? <li>Submissions: {errors.submissions}</li> : null}
      </ul>
    </DashboardErrorAlert>
  );
}
