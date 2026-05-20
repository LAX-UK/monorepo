import { AdminListKpiStrip } from "@/components/admin/admin-list-kpi-strip";
import { KpiPeriodControl } from "@/components/admin/kpi-period-control";
import type { KpiRowTile } from "@/components/dashboard/primitives/kpi-row";
import { Suspense } from "react";

type Props = {
  tiles: readonly KpiRowTile[];
  ariaLabel?: string;
  className?: string;
};

/** Period toggle + trend-aware KPI strip for admin list pages. */
export function AdminTrendKpiBand({ tiles, ariaLabel, className }: Props) {
  if (tiles.length === 0) return null;
  return (
    <div className={className ?? "mb-4 space-y-2"}>
      <div className="flex justify-end">
        <Suspense fallback={null}>
          <KpiPeriodControl />
        </Suspense>
      </div>
      <AdminListKpiStrip tiles={[...tiles]} {...(ariaLabel ? { ariaLabel } : {})} />
    </div>
  );
}
