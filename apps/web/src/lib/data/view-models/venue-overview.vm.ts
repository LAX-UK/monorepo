import type { AdminKpiPeriodDays } from "@/lib/admin/admin-kpi-period";
import { applyFlatKpiTrendOverlay } from "@/lib/admin/apply-flat-kpi-trend-overlay";
import type { DetailBoardKpiTile } from "@/lib/admin/detail-board/types";
import type { VenueDetail } from "@/lib/services/interfaces/admin-venue-service";

export type VenueOverviewViewModel = {
  kpiTiles: readonly DetailBoardKpiTile[];
  salesUsingCount: number;
  legalEntityDisplayName: string | null;
};

function withFlatKpiOverlay(
  tile: DetailBoardKpiTile,
  snapshot: number,
  periodDays: AdminKpiPeriodDays,
): DetailBoardKpiTile {
  return { ...tile, ...applyFlatKpiTrendOverlay(snapshot, periodDays) };
}

export function buildVenueOverviewViewModel(
  detail: VenueDetail,
  periodDays: AdminKpiPeriodDays = 30,
): VenueOverviewViewModel {
  const { venue, salesUsingCount, legalEntityDisplayName = null } = detail;

  return {
    salesUsingCount,
    legalEntityDisplayName,
    kpiTiles: [
      withFlatKpiOverlay(
        {
          id: "sales",
          label: "Linked sales",
          value: String(salesUsingCount),
          trendTone: salesUsingCount > 0 ? "primary" : "muted",
        },
        salesUsingCount,
        periodDays,
      ),
      withFlatKpiOverlay(
        {
          id: "status",
          label: "Status",
          value: venue.status === "active" ? "Active" : "Archived",
          trendTone: venue.status === "active" ? "info" : "muted",
        },
        venue.status === "active" ? 1 : 0,
        periodDays,
      ),
    ],
  };
}
