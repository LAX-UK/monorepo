import type { DetailBoardKpiTile } from "@/lib/admin/detail-board/types";
import { StatGrid } from "@auction/staff-ui";
import type { ReactNode } from "react";

type Props = {
  kpiTiles: readonly DetailBoardKpiTile[];
  ariaLabel?: string;
  children: ReactNode;
};

/** Overview tab body for people detail: headline numbers, then the section content. */
export function PeopleOverviewTab({ kpiTiles, ariaLabel = "Summary", children }: Props) {
  return (
    <div className="flex flex-col gap-6">
      {kpiTiles.length > 0 ? (
        <StatGrid
          label={ariaLabel}
          items={kpiTiles.slice(0, 4).map((tile) => ({
            id: tile.id,
            label: tile.label,
            value: tile.value,
            ...(tile.compareHint ? { hint: tile.compareHint } : {}),
          }))}
        />
      ) : null}
      {children}
    </div>
  );
}
