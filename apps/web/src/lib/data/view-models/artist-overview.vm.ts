import type { AdminKpiPeriodDays } from "@/lib/admin/admin-kpi-period";
import { applyFlatKpiTrendOverlay } from "@/lib/admin/apply-flat-kpi-trend-overlay";
import { buildArtistSummaryItems } from "@/lib/admin/build-artist-summary-items";
import type { CatalogDetailSummaryItem } from "@/lib/admin/catalog/types";
import type { DetailBoardKpiTile } from "@/lib/admin/detail-board/types";
import type { ArtistProfile } from "@auction/types";

export type ArtistOverviewViewModel = {
  summaryItems: readonly CatalogDetailSummaryItem[];
  kpiTiles: readonly DetailBoardKpiTile[];
};

function withFlatKpiOverlay(
  tile: DetailBoardKpiTile,
  snapshot: number,
  periodDays: AdminKpiPeriodDays,
): DetailBoardKpiTile {
  return { ...tile, ...applyFlatKpiTrendOverlay(snapshot, periodDays) };
}

export function buildArtistOverviewViewModel(
  artistId: string,
  artist: ArtistProfile,
  lotCount: number,
  duplicateCount: number,
  periodDays: AdminKpiPeriodDays = 30,
): ArtistOverviewViewModel {
  const summaryItems = buildArtistSummaryItems(artistId, artist, lotCount, duplicateCount);

  return {
    summaryItems,
    kpiTiles: [
      withFlatKpiOverlay(
        {
          id: "lots",
          label: "Lots",
          value: String(lotCount),
          trendTone: "accent-gold",
        },
        lotCount,
        periodDays,
      ),
      withFlatKpiOverlay(
        {
          id: "duplicates",
          label: "Duplicate candidates",
          value: String(duplicateCount),
          trendTone: duplicateCount > 0 ? "accent-gold" : "muted",
        },
        duplicateCount,
        periodDays,
      ),
      withFlatKpiOverlay(
        {
          id: "categories",
          label: "Categories",
          value: String(artist.categories?.length ?? 0),
          trendTone: "secondary",
        },
        artist.categories?.length ?? 0,
        periodDays,
      ),
    ],
  };
}
