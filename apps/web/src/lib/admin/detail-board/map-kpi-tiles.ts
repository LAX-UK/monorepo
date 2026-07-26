import type { DetailBoardKpiTile } from "@/lib/admin/detail-board/types";
import type { KpiRowTile } from "@/lib/admin/kpi-row-tile.types";

const deltaToneMap = {
  up: "positive",
  down: "negative",
  neutral: "neutral",
} as const;

/** Maps generic detail-board KPI tiles to KpiRow props. */
export function mapDetailBoardKpiTiles(tiles: readonly DetailBoardKpiTile[]): KpiRowTile[] {
  return tiles.map((tile) => ({
    id: tile.id,
    label: tile.label,
    value: tile.value,
    ...(tile.compareHint ? { compareHint: tile.compareHint } : {}),
    ...(tile.deltaPercent && tile.deltaDirection
      ? {
          deltaPercent: tile.deltaPercent,
          deltaDirection:
            tile.deltaDirection === "neutral" ? ("flat" as const) : tile.deltaDirection,
          deltaTone: deltaToneMap[tile.deltaDirection],
        }
      : {}),
    ...(tile.trend?.length
      ? { trend: tile.trend, trendTone: tile.trendTone ?? ("info" as const) }
      : {}),
    variant: "dashboard" as const,
  }));
}
