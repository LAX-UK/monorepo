import {
  ConditionReportsSectionView,
  TelephoneBidsSectionView,
} from "@/components/dashboard/bids/extra-section-views";
import { DashboardSliceErrorAlert } from "@/components/dashboard/dashboard-slice-error-alert";
import { mapBuyerConditionReportRequestsVM } from "@/lib/condition-report/map-buyer-condition-report-requests.vm";
import { describeDashboardSliceFailure } from "@/lib/dashboard/dashboard-fetch-errors";
import { getServerMyConditionReportRequests } from "@/lib/data/http/condition-report.server";
import { getServerMyTelephoneBookings } from "@/lib/data/http/telephone-booking.server";

/**
 * Telephone bookings, shown on My bids only when the person has made any. Most people never
 * book a line, so an always-present empty section would be noise.
 */
export async function TelephoneBidsSection() {
  try {
    const rows = await getServerMyTelephoneBookings();
    if (rows.length === 0) return null;
    return <TelephoneBidsSectionView rows={rows} />;
  } catch (e) {
    return (
      <DashboardSliceErrorAlert
        failure={describeDashboardSliceFailure(
          e,
          "telephoneBids",
          "Could not load your telephone bookings.",
        )}
      />
    );
  }
}

/** Condition report requests, shown on My bids only when the person has made any. */
export async function ConditionReportsSection() {
  try {
    const result = await getServerMyConditionReportRequests(50, 0);
    const rows = mapBuyerConditionReportRequestsVM(result.items);
    if (rows.length === 0) return null;
    return <ConditionReportsSectionView rows={rows} />;
  } catch (e) {
    return (
      <DashboardSliceErrorAlert
        failure={describeDashboardSliceFailure(
          e,
          "conditionReports",
          "Could not load your condition report requests.",
        )}
      />
    );
  }
}
