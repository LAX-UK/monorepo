import { DashboardSliceErrorAlert } from "@/components/dashboard/dashboard-slice-error-alert";
import type { DashboardSliceFailure } from "@/lib/dashboard/dashboard-fetch-errors";

type SubmissionsAccessErrorAlertProps = {
  failure: DashboardSliceFailure;
};

/** @deprecated Use DashboardSliceErrorAlert */
export function SubmissionsAccessErrorAlert({ failure }: SubmissionsAccessErrorAlertProps) {
  return <DashboardSliceErrorAlert failure={failure} />;
}
