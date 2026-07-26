import type { KpiTileProps } from "@auction/ui/components/kpi-tile";

/** KPI tile contract for admin/dashboard summary rows. */
export type KpiRowTile = KpiTileProps & { id?: string; href?: string };
