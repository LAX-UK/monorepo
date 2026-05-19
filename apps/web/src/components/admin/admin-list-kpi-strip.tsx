import { KpiRow, type KpiRowTile } from "@/components/dashboard/primitives/kpi-row";

type Props = {
  tiles: readonly KpiRowTile[];
  ariaLabel?: string;
  className?: string;
};

/** Standard KPI row for admin list pages (page-scoped counts). */
export function AdminListKpiStrip({ tiles, ariaLabel = "List summary", className }: Props) {
  if (tiles.length === 0) return null;
  const columns = tiles.length >= 6 ? 6 : tiles.length >= 5 ? 5 : 4;
  return (
    <KpiRow
      className={className ?? "mb-4"}
      tiles={[...tiles]}
      aria-label={ariaLabel}
      columns={columns}
    />
  );
}
