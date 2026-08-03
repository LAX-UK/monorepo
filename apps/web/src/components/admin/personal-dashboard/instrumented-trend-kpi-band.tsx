"use client";

import { AdminTrendKpiBand } from "@/components/admin/admin-trend-kpi-band";
import { logDashboardKpiDrilldownAction } from "@/lib/actions/log-dashboard-interaction";
import type { KpiRowTile } from "@/lib/admin/kpi-row-tile.types";
import type { ReactNode } from "react";

type Props = {
  tiles: readonly KpiRowTile[];
  profileId: string;
  ariaLabel?: string;
  toolbarEnd?: ReactNode;
};

export function InstrumentedTrendKpiBand({ tiles, profileId, ariaLabel, toolbarEnd }: Props) {
  return (
    <div
      onClickCapture={(event) => {
        const target = event.target;
        if (!(target instanceof Element)) return;
        const anchor = target.closest("a[href]");
        if (!anchor) return;
        const tileIndex = anchor
          .closest("[data-kpi-tile-index]")
          ?.getAttribute("data-kpi-tile-index");
        if (tileIndex == null) return;
        const tile = tiles[Number(tileIndex)];
        if (tile?.id) {
          void logDashboardKpiDrilldownAction(profileId, tile.id);
        }
      }}
    >
      <AdminTrendKpiBand
        tiles={tiles.map((tile, index) => ({
          ...tile,
          id: tile.id ?? `kpi-${index}`,
        }))}
        {...(ariaLabel ? { ariaLabel } : {})}
        {...(toolbarEnd ? { toolbarEnd } : {})}
      />
    </div>
  );
}
