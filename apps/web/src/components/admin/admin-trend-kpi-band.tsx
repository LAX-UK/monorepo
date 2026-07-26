import { KpiRow, type KpiRowTile } from "@/components/dashboard/primitives/kpi-row";
import { cn } from "@auction/ui";
import type { ReactNode } from "react";

type Props = {
  tiles: readonly KpiRowTile[];
  ariaLabel?: string;
  className?: string;
  /** Period toggle or export actions aligned to the KPI band (desktop). */
  toolbarEnd?: ReactNode;
};

/**
 * Admin catalog KPI band — flat grid of dashboard tiles.
 * Six-tile bands stay 3-wide through xl and expand to 6 columns only at 2xl
 * so values + sparklines are not truncated in sidebar-constrained admin layouts.
 */
export function AdminTrendKpiBand({ tiles, ariaLabel, className, toolbarEnd }: Props) {
  if (tiles.length === 0) return null;

  const columns = tiles.length >= 6 ? 6 : tiles.length >= 5 ? 5 : tiles.length <= 3 ? 3 : 4;
  const stripClassName =
    tiles.length >= 6 ? "md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-6" : undefined;

  return (
    <div className={cn("space-y-3", className)}>
      {toolbarEnd ? (
        <div className="flex flex-wrap items-center justify-end gap-2">{toolbarEnd}</div>
      ) : null}
      <KpiRow
        tiles={tiles.map((tile) => ({ ...tile, variant: tile.variant ?? "dashboard" }))}
        columns={columns}
        {...(stripClassName ? { stripClassName } : {})}
        aria-label={ariaLabel ?? "Summary at a glance"}
        className="mb-0"
      />
    </div>
  );
}
