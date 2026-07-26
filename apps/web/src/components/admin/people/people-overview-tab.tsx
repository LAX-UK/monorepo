import { DetailBoardKpiStrip } from "@/components/admin/catalog/detail-board";
import type { DetailBoardKpiTile } from "@/lib/admin/detail-board/types";
import type { ReactNode } from "react";

type Props = {
  kpiTiles: readonly DetailBoardKpiTile[];
  ariaLabel?: string;
  children: ReactNode;
};

/** Overview tab body for people detail — KPI band then section content. */
export function PeopleOverviewTab({ kpiTiles, ariaLabel = "Summary", children }: Props) {
  return (
    <div className="space-y-6">
      {kpiTiles.length > 0 ? (
        <DetailBoardKpiStrip ariaLabel={ariaLabel} tiles={kpiTiles} className="mb-0" />
      ) : null}
      {children}
    </div>
  );
}
