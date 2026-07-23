import { AdminTrendKpiBand } from "@/components/admin/admin-trend-kpi-band";
import { mapDetailBoardKpiTiles } from "@/lib/admin/detail-board/map-kpi-tiles";
import type { DetailBoardKpiTile } from "@/lib/admin/detail-board/types";
import type { ReactNode } from "react";

export type DetailBoardKpiStripProps = {
  tiles: readonly DetailBoardKpiTile[];
  ariaLabel?: string;
  className?: string;
  toolbarEnd?: ReactNode;
};

/** KPI row for detail tabs — hero elevation + dashboard tile variant. */
export function DetailBoardKpiStrip({
  tiles,
  ariaLabel = "Summary",
  className,
  toolbarEnd,
}: DetailBoardKpiStripProps) {
  if (tiles.length === 0) return null;
  return (
    <AdminTrendKpiBand
      tiles={mapDetailBoardKpiTiles(tiles)}
      ariaLabel={ariaLabel}
      {...(className ? { className } : {})}
      {...(toolbarEnd ? { toolbarEnd } : {})}
    />
  );
}
