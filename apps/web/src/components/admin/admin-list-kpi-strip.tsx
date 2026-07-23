import { KpiRow, type KpiRowTile } from "@/components/dashboard/primitives/kpi-row";

type Props = {
  tiles: readonly KpiRowTile[];
  ariaLabel?: string;
  className?: string;
};

/** Standard KPI row for admin list pages (page-scoped counts). */
export function AdminListKpiStrip({ tiles, ariaLabel = "List summary", className }: Props) {
  if (tiles.length === 0) return null;
  const columns = tiles.length >= 6 ? 6 : tiles.length >= 5 ? 5 : tiles.length <= 3 ? 3 : 4;
  return (
    <KpiRow
      className={className ?? "mb-4"}
      tiles={tiles.map((tile) => ({ ...tile, variant: tile.variant ?? ("dashboard" as const) }))}
      aria-label={ariaLabel}
      columns={columns}
      stripClassName="md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6"
    />
  );
}
