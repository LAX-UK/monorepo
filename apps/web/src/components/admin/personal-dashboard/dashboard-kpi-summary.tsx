"use client";

import { InstrumentedTrendKpiBand } from "@/components/admin/personal-dashboard/instrumented-trend-kpi-band";
import type { AdminKpiPeriodDays } from "@/lib/admin/admin-kpi-period";
import { buildDashboardKpiTiles } from "@/lib/admin/build-dashboard-kpi-tiles";
import type { RoleKpiDefinitionId } from "@/lib/admin/dashboard/role-kpis.slice";
import type { RoleKpisSlice } from "@/lib/admin/dashboard/role-kpis.slice";
import type { KpiRowTile } from "@/lib/admin/kpi-row-tile.types";
import type { AdminHomeKpiTrends } from "@/lib/data/http/admin-kpi-trends.server";
import type { AdminTodayMetricsPayload } from "@/lib/data/http/admin.server";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@auction/ui/components/collapsible";
import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

const SUMMARY_COUNT = 4;

function KpiCellContent({ tile }: { tile: KpiRowTile }) {
  return (
    <>
      <p className="font-body text-xs text-on-surface-variant">{tile.label}</p>
      <p
        className={`mt-1 font-headline text-2xl font-semibold tabular-nums tracking-tight text-on-surface ${
          tile.semanticTone === "warning" ? "text-warning" : ""
        }`}
      >
        {tile.value}
      </p>
    </>
  );
}

type Props = {
  periodDays: AdminKpiPeriodDays;
  metrics: AdminTodayMetricsPayload;
  trends: AdminHomeKpiTrends;
  bidsPerMinute: number;
  roleKpis?: RoleKpisSlice;
  profileId: string;
  anomalyTones?: Partial<Record<RoleKpiDefinitionId, "warning">>;
};

export function DashboardKpiSummary({
  periodDays,
  metrics,
  trends,
  bidsPerMinute,
  roleKpis,
  profileId,
  anomalyTones = {},
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const tiles = useMemo(
    () =>
      buildDashboardKpiTiles({
        periodDays,
        metrics,
        trends,
        bidsPerMinute,
        roleKpis,
        anomalyTones,
      }),
    [periodDays, metrics, trends, bidsPerMinute, roleKpis, anomalyTones],
  );
  const summaryTiles = tiles.slice(0, SUMMARY_COUNT);
  const hasMore = tiles.length > SUMMARY_COUNT;

  return (
    <div className="space-y-3">
      <div
        className="divide-y divide-shell-stroke rounded-xl border border-shell-stroke bg-surface-container-lowest"
        aria-label="Key metrics"
      >
        <div className="grid grid-cols-2 gap-px bg-shell-stroke sm:grid-cols-4">
          {summaryTiles.map((tile) => {
            const cellClass =
              "bg-surface-container-lowest px-4 py-4 transition-colors hover:bg-surface-container-low/80";
            return tile.href ? (
              <Link key={tile.id} href={tile.href} className={cellClass}>
                <KpiCellContent tile={tile} />
              </Link>
            ) : (
              <div key={tile.id} className={cellClass}>
                <KpiCellContent tile={tile} />
              </div>
            );
          })}
        </div>
      </div>

      {hasMore ? (
        <Collapsible open={expanded} onOpenChange={setExpanded}>
          <CollapsibleTrigger className="flex min-h-9 items-center gap-1 font-body text-sm text-on-surface-variant hover:text-on-surface">
            {expanded ? "Hide metrics" : "View all metrics"}
            <ChevronDown
              className={`size-4 transition-transform ${expanded ? "rotate-180" : ""}`}
              aria-hidden
            />
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-4">
            <InstrumentedTrendKpiBand
              profileId={profileId}
              tiles={tiles}
              ariaLabel="All role metrics"
            />
          </CollapsibleContent>
        </Collapsible>
      ) : null}
    </div>
  );
}
