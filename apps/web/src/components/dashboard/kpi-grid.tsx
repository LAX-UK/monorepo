import { KpiRow, type KpiRowProps } from "@/components/dashboard/primitives/kpi-row";
import type { KpiTileProps } from "@auction/ui";

type KpiGridProps = {
  tiles: readonly KpiTileProps[];
  columns?: 4 | 6;
  className?: string;
};

/** @deprecated Prefer `KpiRow` — thin wrapper for backwards compatibility. */
export function KpiGrid({ tiles, columns = 4, className }: KpiGridProps) {
  const rowProps: KpiRowProps = {
    tiles,
    columns,
    variant: "default",
  };
  if (className) rowProps.className = className;
  return <KpiRow {...rowProps} />;
}
