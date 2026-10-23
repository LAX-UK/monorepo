import { ConditionReportsBoard } from "@/components/dashboard/condition-reports/condition-reports-board";
import { DashboardSection } from "@/components/dashboard/primitives";
import { TelephoneBidsBoard } from "@/components/dashboard/telephone-bids/telephone-bids-board";
import type { BuyerConditionReportRequestVM } from "@/lib/condition-report/map-buyer-condition-report-requests.vm";
import type { TelephoneBookingListItem } from "@/lib/telephone/telephone-booking-types";

export function TelephoneBidsSectionView({ rows }: { rows: TelephoneBookingListItem[] }) {
  return (
    <DashboardSection
      id="telephone-bids"
      title="Telephone bids"
      description="Live telephone lines you have booked for onsite sales."
    >
      <TelephoneBidsBoard rows={rows} />
    </DashboardSection>
  );
}

export function ConditionReportsSectionView({ rows }: { rows: BuyerConditionReportRequestVM[] }) {
  return (
    <DashboardSection
      id="condition-reports"
      title="Condition reports"
      description="Specialist reports you have requested. Download them when they are ready."
    >
      <ConditionReportsBoard rows={rows} />
    </DashboardSection>
  );
}
