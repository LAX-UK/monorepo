import { DashboardSliceErrorAlert } from "@/components/dashboard/dashboard-slice-error-alert";
import { TelephoneBidsBoard } from "@/components/dashboard/telephone-bids/telephone-bids-board";
import { describeDashboardSliceFailure } from "@/lib/dashboard/dashboard-fetch-errors";
import { getServerMyTelephoneBookings } from "@/lib/data/http/telephone-booking.server";

export async function TelephoneBidsPageContent() {
  let rows: Awaited<ReturnType<typeof getServerMyTelephoneBookings>> = [];
  let loadFailure: ReturnType<typeof describeDashboardSliceFailure> | null = null;

  try {
    rows = await getServerMyTelephoneBookings();
  } catch (e) {
    loadFailure = describeDashboardSliceFailure(
      e,
      "telephoneBids",
      "Could not load your telephone bookings.",
    );
  }

  if (loadFailure) {
    return <DashboardSliceErrorAlert failure={loadFailure} />;
  }

  return <TelephoneBidsBoard rows={rows} />;
}
