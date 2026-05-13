import type { DashboardOverviewErrors } from "@/lib/data/view-models/dashboard-overview.vm";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";

type OverviewErrorsAlertProps = {
  errors: DashboardOverviewErrors;
};

export function OverviewErrorsAlert({ errors }: OverviewErrorsAlertProps) {
  const hasErrors = Boolean(
    errors.active ||
      errors.portfolio ||
      errors.watchlist ||
      errors.artistFollow ||
      errors.bids ||
      errors.submissions,
  );

  if (!hasErrors) return null;

  return (
    <Alert variant="destructive" className="rounded-xl border-error/40 shadow-sm">
      <AlertTitle>Some data could not load</AlertTitle>
      <AlertDescription>
        <ul className="mt-2 list-inside list-disc space-y-1">
          {errors.active ? <li>Live inventory: {errors.active}</li> : null}
          {errors.portfolio ? <li>Portfolio: {errors.portfolio}</li> : null}
          {errors.watchlist ? <li>Watchlist: {errors.watchlist}</li> : null}
          {errors.artistFollow ? <li>Followed artists: {errors.artistFollow}</li> : null}
          {errors.bids ? <li>Bids: {errors.bids}</li> : null}
          {errors.submissions ? <li>Submissions: {errors.submissions}</li> : null}
        </ul>
      </AlertDescription>
    </Alert>
  );
}
